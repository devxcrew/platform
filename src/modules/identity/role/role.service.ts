import { randomUUID } from "node:crypto";
import type { IdentityRolePermissionProvider } from "../role-permission/index.js";
import { sql, type Kysely, type Transaction } from "kysely";
import type { IdentityMutation, IdentitySchema, Portal, Principal } from "../identity.types.js";
import { IdentityError } from "../support/identity.error.js";
import { checkIdentityRequest } from "../support/identity.request-context.js";
import { customRoleCreateSchema, customRoleUpdateSchema, roleUpdateSchema } from "./role.schema.js";
import { listRoles, showRole } from "./role.repository.js";
import type { IdentityListQuery } from "../support/pagination.schema.js";

export class IdentityRolesService {
  constructor(
    private readonly db: Kysely<IdentitySchema>,
    private readonly rolePermissions: IdentityRolePermissionProvider,
    private readonly mutate: IdentityMutation,
    private readonly recordAudit: (
      trx: Transaction<IdentitySchema>,
      actor: Principal,
      tenantId: string,
      action: string,
      id: string
    ) => Promise<void>,
    private readonly revokeRoleSessions: (
      trx: Transaction<IdentitySchema>,
      appId: string,
      tenantId: string,
      roleId: string
    ) => Promise<void>
  ) {}

  list(actor: Principal, query: IdentityListQuery) {
    if (actor.portal === "user") throw new IdentityError(403, "Access denied.");
    return listRoles(this.db, actor, query);
  }

  show(actor: Principal, id: string) {
    if (actor.portal === "user") throw new IdentityError(403, "Access denied.");
    return showRole(this.db, actor, id);
  }

  async resolve(
    database: Kysely<IdentitySchema>,
    actor: Principal,
    roleId: string,
    tenantId: string
  ) {
    if (["user", "admin", "super-admin"].includes(roleId)) {
      if (actor.portal !== "super-admin" && roleId !== "user")
        throw new IdentityError(403, "Only super administrators can assign privileged roles.");
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
    if (!role) throw new IdentityError(422, "Select an active role in this organization.");
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
      if (!tenant) throw new IdentityError(422, "Organization is inactive or unavailable.");
      await this.rolePermissions.validate(trx, input.permissionIds, actor.appId);
      await this.uniqueName(trx, actor.appId, tenantId, input.name);
      const id = randomUUID();
      await trx
        .insertInto("identity_custom_roles")
        .values({
          id,
          app_id: actor.appId,
          tenant_id: tenantId,
          name: input.name
        })
        .execute();
      await this.rolePermissions.replace(trx, id, input.permissionIds);
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
        permissionIds: [...new Set(input.permissionIds)]
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
      if (!role || (actor.portal !== "super-admin" && role.tenant_id !== actor.tenant.id))
        throw new IdentityError(404, "Role not found.");
      if (Number(role.version) !== input.expectedVersion)
        throw new IdentityError(409, "This record changed. Reload before saving.");
      if (input.permissionIds)
        await this.rolePermissions.validate(trx, input.permissionIds, actor.appId);
      if (input.name) await this.uniqueName(trx, actor.appId, role.tenant_id, input.name, id);
      const updated = await trx
        .updateTable("identity_custom_roles")
        .set({
          name: input.name ?? role.name,
          active: input.active === undefined ? role.active : Number(input.active),
          version: input.expectedVersion + 1
        })
        .where("id", "=", id)
        .where("version", "=", input.expectedVersion)
        .executeTakeFirst();
      if (updated.numUpdatedRows !== 1n)
        throw new IdentityError(409, "This record changed. Reload before saving.");
      if (input.permissionIds) await this.rolePermissions.replace(trx, id, input.permissionIds);
      await this.revokeRoleSessions(trx, actor.appId, role.tenant_id, id);
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
        permissionIds: permissions.map((row) => row.permission_id)
      };
    });
  }

  async updateSystemPermissions(actor: Principal, id: string, raw: unknown) {
    this.manage(actor);
    if (actor.portal !== "super-admin")
      throw new IdentityError(403, "Only super administrators can change this resource.");
    const input = roleUpdateSchema.parse(raw);
    return this.mutate(actor, "roles", id, async (trx) => {
      const current = await trx
        .selectFrom("identity_roles")
        .select("version")
        .where("id", "=", id)
        .executeTakeFirst();
      if (!current) throw new IdentityError(404, "Role not found.");
      if (Number(current.version) !== input.expectedVersion)
        throw new IdentityError(409, "This record changed. Reload before saving.");
      await this.rolePermissions.replaceSystem(trx, id, actor.appId, input.permissionIds);
      await trx
        .updateTable("identity_roles")
        .set({ version: sql`version + 1` })
        .where("id", "=", id)
        .execute();
      return {
        id,
        permissionIds: [...new Set(input.permissionIds)],
        version: input.expectedVersion + 1
      };
    });
  }

  private manage(actor: Principal) {
    if (actor.portal === "user" || !actor.permissions.includes("identity.manage"))
      throw new IdentityError(403, "Access denied.");
  }
  private scope(actor: Principal, tenantId: string) {
    if (actor.portal !== "super-admin" && tenantId !== actor.tenant.id)
      throw new IdentityError(403, "Access denied.");
  }

  private async uniqueName(
    trx: Transaction<IdentitySchema>,
    appId: string,
    tenantId: string,
    name: string,
    exceptId = ""
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

  private async audit(
    trx: Transaction<IdentitySchema>,
    actor: Principal,
    tenantId: string,
    action: string,
    resourceId: string
  ) {
    await this.recordAudit(trx, actor, tenantId, action, resourceId);
  }
}
