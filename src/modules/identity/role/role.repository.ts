import { sql, type Kysely } from "kysely";
import type { IdentitySchema, Principal } from "../identity.types.js";
import type { IdentityListQuery } from "../support/pagination.schema.js";
import { listRows, showRow } from "../support/pagination.js";

const presentRole = (row: Record<string, unknown>) => ({
  ...row,
  version: Number(row.version),
  active: Boolean(row.active),
  system: Boolean(row.system),
  permissionIds: JSON.parse(String(row.permissionIds)) as string[]
});

export function listRoles(db: Kysely<IdentitySchema>, actor: Principal, query: IdentityListQuery) {
  return listRows(db, roleListSource(actor), ["id", "name"], query, presentRole);
}

export function showRole(db: Kysely<IdentitySchema>, actor: Principal, id: string) {
  return showRow(db, roleListSource(actor), id, presentRole);
}

export async function verifyRoleSchema(db: Kysely<IdentitySchema>) {
  await db.selectFrom("identity_roles").select(["id", "version"]).limit(1).execute();
  await db
    .selectFrom("identity_custom_roles")
    .select(["app_id", "tenant_id", "version"])
    .limit(1)
    .execute();
}

function roleListSource(actor: Principal) {
  const global = actor.portal === "super-admin";
  return sql`select r.id,r.id as name,r.id as portal,1 as system,null as tenantId,1 as active,r.version,(select json_group_array(permission_id) from identity_role_permissions p where p.role_id=r.id) as permissionIds from identity_roles r
    union all select c.id,c.name,'user' as portal,0 as system,c.tenant_id as tenantId,c.active,c.version,
    (select json_group_array(permission_id) from identity_custom_role_permissions p where p.role_id=c.id) as permissionIds
    from identity_custom_roles c where c.app_id=${actor.appId} ${global ? sql`` : sql`and c.tenant_id=${actor.tenant.id}`}`;
}
