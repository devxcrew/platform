import type { IdentityPermissionProvider } from "./permission/index.js";
import { IdentityAdministrationRepository } from "./identity.administration-repository.js";
import {
  createIdentityRoleProvider,
  type IdentityRoleProvider,
  customRoleCreateSchema,
  customRoleUpdateSchema
} from "./role/index.js";
import {
  createIdentityUserRoleProvider,
  type IdentityUserRoleProvider
} from "./user-role/index.js";
import { IdentityPresentationService } from "./identity.presentation-service.js";
import { sql, type Kysely } from "kysely";
import { createIdentityUserAdministrationProvider } from "./user/index.js";
import { IdentityError } from "./identity.error.js";
import type { IdentitySchema, Principal } from "./identity.types.js";
import { IdentityMutationService } from "./identity.mutation-service.js";
import {
  organizationCreateSchema,
  organizationUpdateSchema,
  settingsSchema,
  securitySettingsSchema,
  type IdentityListQuery,
  type IdentityResource
} from "./identity.administration-schema.js";

export class IdentityAdministrationService {
  private readonly repository: IdentityAdministrationRepository;
  private readonly roles: IdentityRoleProvider;
  private readonly userRoles: IdentityUserRoleProvider;
  private readonly userAdministration: ReturnType<typeof createIdentityUserAdministrationProvider>;
  private readonly mutations: IdentityMutationService;
  private readonly presentationService: IdentityPresentationService;
  constructor(
    private readonly db: Kysely<IdentitySchema>,
    private readonly appName: string,
    private readonly permissions: IdentityPermissionProvider
  ) {
    this.repository = new IdentityAdministrationRepository(db);
    this.mutations = new IdentityMutationService(db);
    this.roles = createIdentityRoleProvider(db, permissions, this.mutations.mutate);
    this.userRoles = createIdentityUserRoleProvider(
      db,
      this.roles.resolve,
      this.mutations.mutate,
      async (actor, userId) => {
        if (!(await this.repository.show(actor, "users", userId)))
          throw new IdentityError(404, "Resource not found.");
      }
    );
    this.userAdministration = createIdentityUserAdministrationProvider(
      db,
      this.roles.resolve,
      this.userRoles,
      this.mutations.mutate
    );
    this.presentationService = new IdentityPresentationService(db, appName);
  }

  async list(actor: Principal, resource: IdentityResource, query: IdentityListQuery) {
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
    if (resource === "users") return this.userAdministration.create(actor, raw);
    if (resource === "organizations") {
      const input = organizationCreateSchema.parse(raw);
      return this.mutations.mutate(actor, resource, input.id, async (trx) => {
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
            active: Number(input.active)
          })
          .execute();
        return { ...input, version: 0 };
      });
    }
    if (resource === "memberships") return this.userRoles.createMembership(actor, raw);
    throw new IdentityError(405, "Creation is not supported for this resource.");
  }

  async update(actor: Principal, resource: IdentityResource, id: string, raw: unknown) {
    if (resource === "memberships") return this.userRoles.updateMembership(actor, id, raw);
    if (resource === "roles" && !["user", "admin", "super-admin"].includes(id))
      return this.roles.update(actor, id, raw);
    if (resource === "roles") return this.roles.updateSystemPermissions(actor, id, raw);
    this.allow(actor, resource, true);
    await this.show(actor, resource, id);
    if (resource === "users") return this.userAdministration.update(actor, id, raw);
    if (resource === "organizations") {
      const input = organizationUpdateSchema.parse(raw);
      return this.mutations.mutate(actor, resource, id, async (trx) => {
        const current = await trx
          .selectFrom("identity_tenants")
          .select("version")
          .where("id", "=", id)
          .executeTakeFirstOrThrow();
        this.revision(current.version, input.expectedVersion);
        if (input.active === false && id === actor.tenant.id)
          throw new IdentityError(409, "Cannot deactivate your current organization.");
        const { expectedVersion, ...fields } = input;
        await trx
          .updateTable("identity_tenants")
          .set({
            ...fields,
            version: sql`version + 1`,
            active: input.active === undefined ? undefined : Number(input.active)
          })
          .where("id", "=", id)
          .execute();
        if (input.active === false)
          await trx.deleteFrom("identity_sessions").where("tenant_id", "=", id).execute();
        const row = await trx
          .selectFrom("identity_tenants")
          .selectAll()
          .where("id", "=", id)
          .executeTakeFirstOrThrow();
        return {
          ...row,
          active: Boolean(row.active),
          version: Number(row.version)
        };
      });
    }
    throw new IdentityError(405, "Update is not supported for this resource.");
  }

  async remove(actor: Principal, resource: IdentityResource, id: string, expectedVersion?: number) {
    if (resource === "memberships")
      return this.userRoles.removeMembership(actor, id, expectedVersion);
    this.allow(actor, resource, true);
    const row = await this.show(actor, resource, id);
    if (resource === "sessions") {
      await this.mutations.mutate(actor, resource, id, async (trx) => {
        await trx
          .deleteFrom("identity_sessions")
          .where("token_hash", "=", id)
          .where("app_id", "=", actor.appId)
          .execute();
      });
      return;
    }
    throw new IdentityError(405, "Deletion is not supported for this resource.");
  }

  async profile(actor: Principal, raw?: unknown) {
    return this.userAdministration.profile(actor, raw);
  }

  async settings(actor: Principal, raw?: unknown) {
    if (raw !== undefined) {
      this.allow(actor, "settings", true);
      const input = settingsSchema.parse(raw);
      await this.mutations.mutate(actor, "settings", actor.tenant.id, async (trx) => {
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
            version: input.expectedVersion + 1
          })
          .onConflict((c) =>
            c.column("tenant_id").doUpdateSet({
              display_name: input.displayName,
              locale: input.locale,
              time_zone: input.timeZone,
              version: input.expectedVersion + 1
            })
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
    fallbackSeconds: number
  ) {
    if (actor.portal === "user") throw new IdentityError(403, "Access denied.");
    if (raw !== undefined) {
      if (actor.portal !== "super-admin" || !actor.permissions.includes("identity.manage"))
        throw new IdentityError(403, "Access denied.");
      const input = security ? securitySettingsSchema.parse(raw) : settingsSchema.parse(raw);
      await this.mutations.mutate(
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
            version: input.expectedVersion + 1
          };
          if ("sessionSeconds" in input) row.session_seconds = input.sessionSeconds;
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
            await trx.deleteFrom("identity_sessions").where("app_id", "=", actor.appId).execute();
        }
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
          version: Number(row?.version ?? 0)
        }
      : {
          displayName: row?.display_name ?? this.appName,
          locale: row?.locale ?? "en",
          timeZone: row?.time_zone ?? "UTC",
          version: Number(row?.version ?? 0)
        };
  }

  private revision(current: number, expected: number) {
    if (Number(current) !== expected)
      throw new IdentityError(409, "This record changed. Reload before saving.");
  }

  async presentation(actor: Principal) {
    return this.presentationService.presentation(actor);
  }

  async configuration(appId: string, requiresOrganizationId: boolean) {
    return this.presentationService.configuration(appId, requiresOrganizationId);
  }

  private allow(actor: Principal, resource: string, write: boolean) {
    if (
      !write &&
      ["roles", "permissions", "organizations"].includes(resource) &&
      actor.portal !== "user"
    )
      return;
    if (resource === "sessions" && actor.portal === "user") return;
    if (actor.portal === "user" || !actor.permissions.includes("identity.manage"))
      throw new IdentityError(403, "Access denied.");
    if (
      write &&
      ["roles", "permissions", "organizations"].includes(resource) &&
      actor.portal !== "super-admin"
    )
      throw new IdentityError(403, "Only super administrators can change this resource.");
  }
}
