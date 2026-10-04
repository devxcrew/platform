import { randomUUID } from "node:crypto";
import { validateDeclaredPermissions } from "./identity.permission-declarations.js";
import type { Kysely, Transaction } from "kysely";
import type { IdentitySchema, Portal, Principal } from "./identity.types.js";
import { IdentityError } from "./identity.error.js";
import { checkIdentityRequest } from "./identity.request-context.js";
import { protectAdministrators } from "./identity.membership-policy.js";
import {
  customRoleCreateSchema,
  customRoleUpdateSchema,
  membershipUpdateSchema,
} from "./identity.administration-schema.js";

export class IdentityRolesService {
  constructor(private readonly db: Kysely<IdentitySchema>) {}

  async resolve(
    database: Kysely<IdentitySchema>,
    actor: Principal,
    roleId: string,
    tenantId: string,
  ) {
    if (["user", "admin", "super-admin"].includes(roleId)) {
      if (actor.portal !== "super-admin" && roleId !== "user")
        throw new IdentityError(
          403,
          "Only super administrators can assign privileged roles.",
        );
      return { portal: roleId as Portal, customRoleId: null };
    }
    const role = await database
      .selectFrom("identity_custom_roles")
      .select("id")
      .where("id", "=", roleId)
      .where("app_id", "=", actor.appId)
      .where("tenant_id", "=", tenantId)
      .where("active", "=", 1)
      .executeTakeFirst();
    if (!role)
      throw new IdentityError(
        422,
        "Select an active role in this organization.",
      );
    return { portal: "user" as const, customRoleId: role.id };
  }

  async create(actor: Principal, raw: unknown) {
    this.manage(actor);
    const input = customRoleCreateSchema.parse(raw);
    const tenantId = input.tenantId ?? actor.tenant.id;
    this.scope(actor, tenantId);
    return this.db.transaction().execute(async (trx) => {
      checkIdentityRequest();
      const tenant = await trx
        .selectFrom("identity_tenants")
        .select("id")
        .where("id", "=", tenantId)
        .where("active", "=", 1)
        .executeTakeFirst();
      if (!tenant)
        throw new IdentityError(
          422,
          "Organization is inactive or unavailable.",
        );
      await this.permissions(trx, input.permissionIds, actor.appId);
      await this.uniqueName(trx, actor.appId, tenantId, input.name);
      const id = randomUUID();
      await trx
        .insertInto("identity_custom_roles")
        .values({
          id,
          app_id: actor.appId,
          tenant_id: tenantId,
          name: input.name,
        })
        .execute();
      await this.replacePermissions(trx, id, input.permissionIds);
      await this.audit(trx, actor, tenantId, "identity.role.created", id);
      checkIdentityRequest();
      return {
        id,
        name: input.name,
        tenantId,
        portal: "user",
        system: false,
        active: true,
        version: 0,
        permissionIds: [...new Set(input.permissionIds)],
      };
    });
  }

  async update(actor: Principal, id: string, raw: unknown) {
    this.manage(actor);
    const input = customRoleUpdateSchema.parse(raw);
    return this.db.transaction().execute(async (trx) => {
      checkIdentityRequest();
      const role = await trx
        .selectFrom("identity_custom_roles")
        .selectAll()
        .where("id", "=", id)
        .where("app_id", "=", actor.appId)
        .executeTakeFirst();
      if (
        !role ||
        (actor.portal !== "super-admin" && role.tenant_id !== actor.tenant.id)
      )
        throw new IdentityError(404, "Role not found.");
      if (Number(role.version) !== input.expectedVersion)
        throw new IdentityError(
          409,
          "This record changed. Reload before saving.",
        );
      if (input.permissionIds) await this.permissions(trx, input.permissionIds, actor.appId);
      if (input.name)
        await this.uniqueName(trx, actor.appId, role.tenant_id, input.name, id);
      const updated = await trx
        .updateTable("identity_custom_roles")
        .set({
          name: input.name ?? role.name,
          active:
            input.active === undefined ? role.active : Number(input.active),
          version: input.expectedVersion + 1,
        })
        .where("id", "=", id)
        .where("version", "=", input.expectedVersion)
        .executeTakeFirst();
      if (updated.numUpdatedRows !== 1n)
        throw new IdentityError(
          409,
          "This record changed. Reload before saving.",
        );
      if (input.permissionIds)
        await this.replacePermissions(trx, id, input.permissionIds);
      await trx
        .deleteFrom("identity_sessions")
        .where("app_id", "=", actor.appId)
        .where("tenant_id", "=", role.tenant_id)
        .where(
          "user_id",
          "in",
          trx
            .selectFrom("identity_memberships")
            .select("user_id")
            .where("custom_role_id", "=", id),
        )
        .execute();
      await this.audit(trx, actor, role.tenant_id, "identity.role.changed", id);
      const permissions = await trx
        .selectFrom("identity_custom_role_permissions")
        .select("permission_id")
        .where("role_id", "=", id)
        .execute();
      checkIdentityRequest();
      return {
        id,
        name: input.name ?? role.name,
        tenantId: role.tenant_id,
        portal: "user",
        system: false,
        active: input.active ?? Boolean(role.active),
        version: input.expectedVersion + 1,
        permissionIds: permissions.map((row) => row.permission_id),
      };
    });
  }

  async updateMembership(actor: Principal, id: string, raw: unknown) {
    this.manage(actor);
    const input = membershipUpdateSchema.parse(raw);
    const [userId, tenantId, oldPortal, extra] = id.split("~");
    if (!userId || !tenantId || !oldPortal || extra)
      throw new IdentityError(404, "Membership not found.");
    this.scope(actor, tenantId);
    if (actor.portal !== "super-admin" && oldPortal !== "user")
      throw new IdentityError(
        403,
        "Only super administrators can change privileged memberships.",
      );
    return this.db.transaction().execute(async (trx) => {
      checkIdentityRequest();
      const current = await trx
        .selectFrom("identity_memberships")
        .selectAll()
        .where("user_id", "=", userId)
        .where("tenant_id", "=", tenantId)
        .where("role_id", "=", oldPortal)
        .executeTakeFirst();
      if (!current) throw new IdentityError(404, "Membership not found.");
      if (
        current.custom_role_id &&
        !(await trx
          .selectFrom("identity_custom_roles")
          .select("id")
          .where("id", "=", current.custom_role_id)
          .where("app_id", "=", actor.appId)
          .executeTakeFirst())
      )
        throw new IdentityError(404, "Membership not found.");
      if (
        input.active &&
        !(await trx
          .selectFrom("identity_tenants")
          .select("id")
          .where("id", "=", tenantId)
          .where("active", "=", 1)
          .executeTakeFirst())
      )
        throw new IdentityError(
          422,
          "Organization is inactive or unavailable.",
        );
      if (Number(current.version) !== input.expectedVersion)
        throw new IdentityError(
          409,
          "This record changed. Reload before saving.",
        );
      const selected = await this.resolve(trx, actor, input.roleId, tenantId);
      if (!input.active || selected.portal !== oldPortal)
        await protectAdministrators(trx, userId, tenantId, oldPortal);
      if (
        selected.portal !== oldPortal &&
        (await trx
          .selectFrom("identity_memberships")
          .select("user_id")
          .where("user_id", "=", userId)
          .where("tenant_id", "=", tenantId)
          .where("role_id", "=", selected.portal)
          .executeTakeFirst())
      )
        throw new IdentityError(
          409,
          "This account already has that portal membership.",
        );
      const changed = await trx
        .updateTable("identity_memberships")
        .set({
          role_id: selected.portal,
          custom_role_id: selected.customRoleId,
          active: Number(input.active),
          version: input.expectedVersion + 1,
        })
        .where("user_id", "=", userId)
        .where("tenant_id", "=", tenantId)
        .where("role_id", "=", oldPortal)
        .where("version", "=", input.expectedVersion)
        .executeTakeFirst();
      if (changed.numUpdatedRows !== 1n)
        throw new IdentityError(
          409,
          "This record changed. Reload before saving.",
        );
      await trx
        .deleteFrom("identity_sessions")
        .where("app_id", "=", actor.appId)
        .where("user_id", "=", userId)
        .where("tenant_id", "=", tenantId)
        .where("portal", "=", oldPortal as Portal)
        .execute();
      const nextId = `${userId}~${tenantId}~${selected.portal}`;
      await this.audit(
        trx,
        actor,
        tenantId,
        "identity.membership.changed",
        nextId,
      );
      checkIdentityRequest();
      return {
        id: nextId,
        userId,
        tenantId,
        roleId: selected.customRoleId ?? selected.portal,
        portal: selected.portal,
        active: input.active,
        version: input.expectedVersion + 1,
      };
    });
  }

  async removeMembership(
    actor: Principal,
    id: string,
    expectedVersion?: number,
  ) {
    this.manage(actor);
    if (!Number.isInteger(expectedVersion) || Number(expectedVersion) < 0)
      throw new IdentityError(422, "Provide the current membership version.");
    const [userId, tenantId, portal, extra] = id.split("~");
    if (!userId || !tenantId || !portal || extra)
      throw new IdentityError(404, "Membership not found.");
    this.scope(actor, tenantId);
    if (actor.portal !== "super-admin" && portal !== "user")
      throw new IdentityError(
        403,
        "Only super administrators can change privileged memberships.",
      );
    await this.db.transaction().execute(async (trx) => {
      checkIdentityRequest();
      const current = await trx
        .selectFrom("identity_memberships")
        .select(["custom_role_id", "version"])
        .where("user_id", "=", userId)
        .where("tenant_id", "=", tenantId)
        .where("role_id", "=", portal)
        .executeTakeFirst();
      if (
        !current ||
        (current.custom_role_id &&
          !(await trx
            .selectFrom("identity_custom_roles")
            .select("id")
            .where("id", "=", current.custom_role_id)
            .where("app_id", "=", actor.appId)
            .executeTakeFirst()))
      )
        throw new IdentityError(404, "Membership not found.");
      if (Number(current.version) !== expectedVersion)
        throw new IdentityError(
          409,
          "This record changed. Reload before saving.",
        );
      await protectAdministrators(trx, userId, tenantId, portal);
      await trx
        .deleteFrom("identity_memberships")
        .where("user_id", "=", userId)
        .where("tenant_id", "=", tenantId)
        .where("role_id", "=", portal)
        .execute();
      await trx
        .deleteFrom("identity_sessions")
        .where("app_id", "=", actor.appId)
        .where("user_id", "=", userId)
        .where("tenant_id", "=", tenantId)
        .where("portal", "=", portal as Portal)
        .execute();
      await this.audit(trx, actor, tenantId, "identity.membership.removed", id);
      checkIdentityRequest();
    });
  }

  private manage(actor: Principal) {
    if (
      actor.portal === "user" ||
      !actor.permissions.includes("identity.manage")
    )
      throw new IdentityError(403, "Access denied.");
  }
  private scope(actor: Principal, tenantId: string) {
    if (actor.portal !== "super-admin" && tenantId !== actor.tenant.id)
      throw new IdentityError(403, "Access denied.");
  }
  private async permissions(trx: Transaction<IdentitySchema>, ids: string[], appId: string) {
    await validateDeclaredPermissions(trx, appId, "user", ids);
    if (!ids.includes("desk.user"))
      throw new IdentityError(422, "Keep the user desk permission.");
    if (
      ids.some(
        (id) =>
          id === "identity.manage" ||
          (id.startsWith("desk.") && id !== "desk.user"),
      )
    )
      throw new IdentityError(
        403,
        "Custom user roles cannot grant administration access.",
      );
    const known = await trx
      .selectFrom("identity_permissions")
      .select("id")
      .execute();
    if (ids.some((id) => !known.some((row) => row.id === id)))
      throw new IdentityError(422, "Unknown permission.");
  }
  private async uniqueName(
    trx: Transaction<IdentitySchema>,
    appId: string,
    tenantId: string,
    name: string,
    exceptId = "",
  ) {
    if (
      await trx
        .selectFrom("identity_custom_roles")
        .select("id")
        .where("app_id", "=", appId)
        .where("tenant_id", "=", tenantId)
        .where("name", "=", name)
        .where("id", "!=", exceptId)
        .executeTakeFirst()
    )
      throw new IdentityError(409, "A role with this name already exists.");
  }
  private async replacePermissions(
    trx: Transaction<IdentitySchema>,
    id: string,
    permissions: string[],
  ) {
    await trx
      .deleteFrom("identity_custom_role_permissions")
      .where("role_id", "=", id)
      .execute();
    for (const permission of new Set(permissions))
      await trx
        .insertInto("identity_custom_role_permissions")
        .values({ role_id: id, permission_id: permission })
        .execute();
  }
  private async audit(
    trx: Transaction<IdentitySchema>,
    actor: Principal,
    tenantId: string,
    action: string,
    resourceId: string,
  ) {
    await trx
      .insertInto("identity_audit_events")
      .values({
        id: randomUUID(),
        app_id: actor.appId,
        actor_id: actor.user.id,
        tenant_id: tenantId,
        action,
        resource_id: resourceId,
        created_at: new Date().toISOString(),
      })
      .execute();
  }
}
