import { validateDeclaredPermissions } from "./identity.permission-declarations.js";
import { randomUUID } from "node:crypto";
import { IdentityAdministrationRepository } from "./identity.administration-repository.js";
import { IdentityRolesService } from "./identity.roles-service.js";
import { protectAdministrators } from "./identity.membership-policy.js";
import { IdentityPresentationService } from "./identity.presentation-service.js";
import { checkIdentityRequest } from "./identity.request-context.js";
import { sql, type Kysely, type Transaction } from "kysely";
import { hashPassword } from "./identity.password.js";
import { IdentityError } from "./identity.error.js";
import type { IdentitySchema, Principal } from "./identity.types.js";
import {
  userCreateSchema,
  userUpdateSchema,
  organizationCreateSchema,
  organizationUpdateSchema,
  membershipSchema,
  roleUpdateSchema,
  profileSchema,
  settingsSchema,
  securitySettingsSchema,
  type IdentityListQuery,
  type IdentityResource,
} from "./identity.administration-schema.js";

export class IdentityAdministrationService {
  private readonly repository: IdentityAdministrationRepository;
  private readonly roles: IdentityRolesService;
  private readonly presentationService: IdentityPresentationService;
  constructor(
    private readonly db: Kysely<IdentitySchema>,
    private readonly appName: string,
  ) {
    this.repository = new IdentityAdministrationRepository(db);
    this.roles = new IdentityRolesService(db);
    this.presentationService = new IdentityPresentationService(db, appName);
  }

  async list(
    actor: Principal,
    resource: IdentityResource,
    query: IdentityListQuery,
  ) {
    this.allow(actor, resource, false);
    return this.repository.list(actor, resource, query);
  }

  async show(actor: Principal, resource: IdentityResource, id: string) {
    this.allow(actor, resource, false);
    const row = await this.repository.show(actor, resource, id);
    if (!row) throw new IdentityError(404, "Resource not found.");
    return row;
  }

  async create(actor: Principal, resource: IdentityResource, raw: unknown) {
    if (resource === "roles") return this.roles.create(actor, raw);
    this.allow(actor, resource, true);
    if (resource === "users") {
      const input = userCreateSchema.parse(raw);
      const tenantId = this.tenant(actor, input.tenantId);
      await this.roles.resolve(this.db, actor, input.roleId, tenantId);
      const passwordHash = await hashPassword(input.password);
      return this.mutate(
        actor,
        resource,
        randomUUID(),
        async (trx, id) => {
          await this.activeTenant(trx, tenantId);
          const selected = await this.roles.resolve(
            trx,
            actor,
            input.roleId,
            tenantId,
          );
          if (
            await trx
              .selectFrom("identity_users")
              .select("id")
              .where("email", "=", input.email)
              .executeTakeFirst()
          )
            throw new IdentityError(409, "Email already exists.");
          await trx
            .insertInto("identity_users")
            .values({
              id,
              email: input.email,
              name: input.name,
              active: 1,
              password_hash: passwordHash,
            })
            .execute();
          await trx
            .insertInto("identity_memberships")
            .values({
              user_id: id,
              tenant_id: tenantId,
              role_id: selected.portal,
              custom_role_id: selected.customRoleId,
            })
            .execute();
          return {
            id,
            email: input.email,
            name: input.name,
            active: true,
            version: 0,
          };
        },
        tenantId,
      );
    }
    if (resource === "organizations") {
      const input = organizationCreateSchema.parse(raw);
      return this.mutate(actor, resource, input.id, async (trx) => {
        if (
          await trx
            .selectFrom("identity_tenants")
            .select("id")
            .where("id", "=", input.id)
            .executeTakeFirst()
        )
          throw new IdentityError(409, "Organization already exists.");
        await trx
          .insertInto("identity_tenants")
          .values({
            id: input.id,
            name: input.name,
            active: Number(input.active),
          })
          .execute();
        return { ...input, version: 0 };
      });
    }
    if (resource === "memberships") {
      const input = membershipSchema.parse(raw);
      const tenantId = this.tenant(actor, input.tenantId);
      const selected = await this.roles.resolve(
        this.db,
        actor,
        input.roleId,
        tenantId,
      );
      await this.show(actor, "users", input.userId);
      const id = `${input.userId}~${tenantId}~${selected.portal}`;
      return this.mutate(actor, resource, id, async (trx) => {
        await this.activeTenant(trx, tenantId);
        const currentRole = await this.roles.resolve(
          trx,
          actor,
          input.roleId,
          tenantId,
        );
        if (
          await trx
            .selectFrom("identity_memberships")
            .select("user_id")
            .where("user_id", "=", input.userId)
            .where("tenant_id", "=", tenantId)
            .where("role_id", "=", currentRole.portal)
            .executeTakeFirst()
        )
          throw new IdentityError(409, "Membership already exists.");
        await trx
          .insertInto("identity_memberships")
          .values({
            user_id: input.userId,
            tenant_id: tenantId,
            role_id: currentRole.portal,
            custom_role_id: currentRole.customRoleId,
          })
          .execute();
        return {
          id,
          userId: input.userId,
          tenantId,
          roleId: input.roleId,
          portal: currentRole.portal,
          active: true,
          version: 0,
        };
      });
    }
    throw new IdentityError(
      405,
      "Creation is not supported for this resource.",
    );
  }

  async update(
    actor: Principal,
    resource: IdentityResource,
    id: string,
    raw: unknown,
  ) {
    if (resource === "memberships")
      return this.roles.updateMembership(actor, id, raw);
    if (resource === "roles" && !["user", "admin", "super-admin"].includes(id))
      return this.roles.update(actor, id, raw);
    this.allow(actor, resource, true);
    await this.show(actor, resource, id);
    if (resource === "users") {
      const input = userUpdateSchema.parse(raw);
      return this.mutate(actor, resource, id, async (trx) => {
        const current = await trx
          .selectFrom("identity_users")
          .selectAll()
          .where("id", "=", id)
          .executeTakeFirstOrThrow();
        this.revision(current.version, input.expectedVersion);
        if (actor.portal !== "super-admin")
          await this.unprivilegedUser(trx, id);
        if (input.active === false) {
          await protectAdministrators(trx, id);
          await trx
            .deleteFrom("identity_sessions")
            .where("user_id", "=", id)
            .execute();
        }
        if (
          input.email &&
          (await trx
            .selectFrom("identity_users")
            .select("id")
            .where("email", "=", input.email)
            .where("id", "!=", id)
            .executeTakeFirst())
        )
          throw new IdentityError(409, "Email already exists.");
        const { expectedVersion, ...fields } = input;
        await trx
          .updateTable("identity_users")
          .set({
            ...fields,
            version: sql`version + 1`,
            active:
              input.active === undefined
                ? current.active
                : Number(input.active),
          })
          .where("id", "=", id)
          .execute();
        return {
          id,
          name: input.name ?? current.name,
          email: input.email ?? current.email,
          active: input.active ?? Boolean(current.active),
          version: expectedVersion + 1,
        };
      });
    }
    if (resource === "organizations") {
      const input = organizationUpdateSchema.parse(raw);
      return this.mutate(actor, resource, id, async (trx) => {
        const current = await trx
          .selectFrom("identity_tenants")
          .select("version")
          .where("id", "=", id)
          .executeTakeFirstOrThrow();
        this.revision(current.version, input.expectedVersion);
        if (input.active === false && id === actor.tenant.id)
          throw new IdentityError(
            409,
            "Cannot deactivate your current organization.",
          );
        const { expectedVersion, ...fields } = input;
        await trx
          .updateTable("identity_tenants")
          .set({
            ...fields,
            version: sql`version + 1`,
            active:
              input.active === undefined ? undefined : Number(input.active),
          })
          .where("id", "=", id)
          .execute();
        if (input.active === false)
          await trx
            .deleteFrom("identity_sessions")
            .where("tenant_id", "=", id)
            .execute();
        const row = await trx
          .selectFrom("identity_tenants")
          .selectAll()
          .where("id", "=", id)
          .executeTakeFirstOrThrow();
        return {
          ...row,
          active: Boolean(row.active),
          version: Number(row.version),
        };
      });
    }
    if (resource === "roles") {
      const input = roleUpdateSchema.parse(raw);
      if (
        !input.permissionIds.includes(`desk.${id}`) ||
        !input.permissionIds.includes("identity.password")
      )
        throw new IdentityError(
          409,
          "Keep required portal and password permissions.",
        );
      if (id !== "user" && !input.permissionIds.includes("identity.manage"))
        throw new IdentityError(
          409,
          "Keep administration permission on administrator roles.",
        );
      return this.mutate(actor, resource, id, async (trx) => {
        const current = await trx
          .selectFrom("identity_roles")
          .select("version")
          .where("id", "=", id)
          .executeTakeFirstOrThrow();
        this.revision(current.version, input.expectedVersion);
        await validateDeclaredPermissions(trx, actor.appId, id as Principal["portal"], input.permissionIds);
        const known = await trx
          .selectFrom("identity_permissions")
          .select("id")
          .execute();
        if (
          input.permissionIds.some(
            (permission) => !known.some((row) => row.id === permission),
          )
        )
          throw new IdentityError(422, "Unknown permission.");
        if (
          id === "user" &&
          input.permissionIds.some((permission) =>
            permission.startsWith("identity.manage"),
          )
        )
          throw new IdentityError(
            403,
            "User roles cannot receive administration permissions.",
          );
        await trx
          .deleteFrom("identity_role_permissions")
          .where("role_id", "=", id)
          .execute();
        for (const permission of new Set(input.permissionIds))
          await trx
            .insertInto("identity_role_permissions")
            .values({ role_id: id, permission_id: permission })
            .execute();
        await trx
          .updateTable("identity_roles")
          .set({ version: sql`version + 1` })
          .where("id", "=", id)
          .execute();
        return {
          id,
          permissionIds: [...new Set(input.permissionIds)],
          version: input.expectedVersion + 1,
        };
      });
    }
    throw new IdentityError(405, "Update is not supported for this resource.");
  }

  async remove(
    actor: Principal,
    resource: IdentityResource,
    id: string,
    expectedVersion?: number,
  ) {
    if (resource === "memberships")
      return this.roles.removeMembership(actor, id, expectedVersion);
    this.allow(actor, resource, true);
    const row = await this.show(actor, resource, id);
    if (resource === "sessions") {
      await this.mutate(actor, resource, id, async (trx) => {
        await trx
          .deleteFrom("identity_sessions")
          .where("token_hash", "=", id)
          .where("app_id", "=", actor.appId)
          .execute();
      });
      return;
    }
    throw new IdentityError(
      405,
      "Deletion is not supported for this resource.",
    );
  }

  async profile(actor: Principal, raw?: unknown) {
    if (!actor.permissions.includes("identity.self"))
      throw new IdentityError(403, "Access denied.");
    if (raw !== undefined) {
      const input = profileSchema.parse(raw);
      await this.mutate(actor, "profile", actor.user.id, async (trx) => {
        const changed = await trx
          .updateTable("identity_users")
          .set({ name: input.name, version: sql`version + 1` })
          .where("id", "=", actor.user.id)
          .where("version", "=", input.expectedVersion)
          .executeTakeFirst();
        if (changed.numUpdatedRows !== 1n)
          throw new IdentityError(
            409,
            "This record changed. Reload before saving.",
          );
      });
    }
    const user = await this.db
      .selectFrom("identity_users")
      .select(["id", "name", "email", "active", "version"])
      .where("id", "=", actor.user.id)
      .executeTakeFirstOrThrow();
    return {
      ...user,
      active: Boolean(user.active),
      version: Number(user.version),
    };
  }

  async settings(actor: Principal, raw?: unknown) {
    if (raw !== undefined) {
      this.allow(actor, "settings", true);
      const input = settingsSchema.parse(raw);
      await this.mutate(actor, "settings", actor.tenant.id, async (trx) => {
        const current = await trx
          .selectFrom("identity_settings")
          .select("version")
          .where("tenant_id", "=", actor.tenant.id)
          .executeTakeFirst();
        this.revision(current?.version ?? 0, input.expectedVersion);
        await trx
          .insertInto("identity_settings")
          .values({
            tenant_id: actor.tenant.id,
            display_name: input.displayName,
            locale: input.locale,
            time_zone: input.timeZone,
            version: input.expectedVersion + 1,
          })
          .onConflict((c) =>
            c.column("tenant_id").doUpdateSet({
              display_name: input.displayName,
              locale: input.locale,
              time_zone: input.timeZone,
              version: input.expectedVersion + 1,
            }),
          )
          .execute();
      });
    }
    return this.presentationService.organizationSettings(actor);
  }

  async applicationSettings(
    actor: Principal,
    security: boolean,
    raw: unknown,
    fallbackSeconds: number,
  ) {
    if (actor.portal === "user") throw new IdentityError(403, "Access denied.");
    if (raw !== undefined) {
      if (
        actor.portal !== "super-admin" ||
        !actor.permissions.includes("identity.manage")
      )
        throw new IdentityError(403, "Access denied.");
      const input = security
        ? securitySettingsSchema.parse(raw)
        : settingsSchema.parse(raw);
      await this.mutate(
        actor,
        security ? "security-settings" : "application-settings",
        actor.appId,
        async (trx) => {
          const current = await trx
            .selectFrom("identity_app_settings")
            .selectAll()
            .where("app_id", "=", actor.appId)
            .executeTakeFirst();
          this.revision(current?.version ?? 0, input.expectedVersion);
          const row = {
            app_id: actor.appId,
            display_name: current?.display_name ?? this.appName,
            locale: current?.locale ?? "en",
            time_zone: current?.time_zone ?? "UTC",
            session_seconds: current?.session_seconds ?? fallbackSeconds,
            version: input.expectedVersion + 1,
          };
          if ("sessionSeconds" in input)
            row.session_seconds = input.sessionSeconds;
          else {
            row.display_name = input.displayName;
            row.locale = input.locale;
            row.time_zone = input.timeZone;
          }
          await trx
            .insertInto("identity_app_settings")
            .values(row)
            .onConflict((c) => c.column("app_id").doUpdateSet(row))
            .execute();
          if (security)
            await trx
              .deleteFrom("identity_sessions")
              .where("app_id", "=", actor.appId)
              .execute();
        },
      );
    }
    const row = await this.db
      .selectFrom("identity_app_settings")
      .selectAll()
      .where("app_id", "=", actor.appId)
      .executeTakeFirst();
    return security
      ? {
          sessionSeconds: Number(row?.session_seconds ?? fallbackSeconds),
          version: Number(row?.version ?? 0),
        }
      : {
          displayName: row?.display_name ?? this.appName,
          locale: row?.locale ?? "en",
          timeZone: row?.time_zone ?? "UTC",
          version: Number(row?.version ?? 0),
        };
  }

  private revision(current: number, expected: number) {
    if (Number(current) !== expected)
      throw new IdentityError(
        409,
        "This record changed. Reload before saving.",
      );
  }

  async presentation(actor: Principal) {
    return this.presentationService.presentation(actor);
  }

  async configuration(appId: string, requiresOrganizationId: boolean) {
    return this.presentationService.configuration(
      appId,
      requiresOrganizationId,
    );
  }

  private allow(actor: Principal, resource: string, write: boolean) {
    if (
      !write &&
      ["roles", "permissions", "organizations"].includes(resource) &&
      actor.portal !== "user"
    )
      return;
    if (resource === "sessions" && actor.portal === "user") return;
    if (
      actor.portal === "user" ||
      !actor.permissions.includes("identity.manage")
    )
      throw new IdentityError(403, "Access denied.");
    if (
      write &&
      ["roles", "permissions", "organizations"].includes(resource) &&
      actor.portal !== "super-admin"
    )
      throw new IdentityError(
        403,
        "Only super administrators can change this resource.",
      );
  }

  private tenant(actor: Principal, requested?: string) {
    if (
      requested &&
      requested !== actor.tenant.id &&
      actor.portal !== "super-admin"
    )
      throw new IdentityError(403, "Access denied.");
    return requested ?? actor.tenant.id;
  }

  private assignableRole(actor: Principal, role: string) {
    if (actor.portal !== "super-admin" && role !== "user")
      throw new IdentityError(
        403,
        "Only super administrators can assign privileged roles.",
      );
  }

  private async activeTenant(trx: Transaction<IdentitySchema>, id: string) {
    if (
      !(await trx
        .selectFrom("identity_tenants")
        .select("id")
        .where("id", "=", id)
        .where("active", "=", 1)
        .executeTakeFirst())
    )
      throw new IdentityError(422, "Organization is inactive or unavailable.");
  }

  private async unprivilegedUser(trx: Transaction<IdentitySchema>, id: string) {
    const privileged = await trx
      .selectFrom("identity_memberships")
      .select("role_id")
      .where("user_id", "=", id)
      .where("role_id", "in", ["admin", "super-admin"])
      .executeTakeFirst();
    if (privileged)
      throw new IdentityError(
        403,
        "Only super administrators can change privileged accounts.",
      );
    const tenants = await trx
      .selectFrom("identity_memberships")
      .select("tenant_id")
      .where("user_id", "=", id)
      .distinct()
      .execute();
    if (tenants.length > 1)
      throw new IdentityError(
        403,
        "Only super administrators can change shared accounts.",
      );
  }

  private async mutate<T>(
    actor: Principal,
    resource: string,
    id: string,
    action: (trx: Transaction<IdentitySchema>, id: string) => Promise<T>,
    affectedTenant?: string,
  ) {
    return this.db.transaction().execute(async (trx) => {
      checkIdentityRequest();
      const result = await action(trx, id);
      checkIdentityRequest();
      const targetTenant =
        affectedTenant ??
        (resource === "organizations"
          ? id
          : resource === "memberships"
            ? id.split("~")[1]
            : actor.tenant.id);
      let targets = [targetTenant];
      if (!affectedTenant && ["users", "profile"].includes(resource))
        targets = (
          await trx
            .selectFrom("identity_memberships")
            .select("tenant_id")
            .where("user_id", "=", id)
            .distinct()
            .execute()
        ).map((row) => row.tenant_id);
      if (
        ["roles", "application-settings", "security-settings"].includes(
          resource,
        )
      )
        targets = (
          await trx.selectFrom("identity_tenants").select("id").execute()
        ).map((row) => row.id);
      for (const tenant of new Set(targets))
        await trx
          .insertInto("identity_audit_events")
          .values({
            id: randomUUID(),
            app_id: actor.appId,
            actor_id: actor.user.id,
            tenant_id: tenant,
            action: `identity.${resource}.changed`,
            resource_id: id,
            created_at: new Date().toISOString(),
          })
          .execute();
      checkIdentityRequest();
      return result;
    });
  }
}
