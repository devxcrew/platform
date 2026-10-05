import { sql, type Kysely, type RawBuilder } from "kysely";
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

export function listRoles(
  db: Kysely<IdentitySchema>,
  actor: Principal,
  query: IdentityListQuery,
  permissionJson: {
    system(id: RawBuilder<unknown>): RawBuilder<unknown>;
    custom(id: RawBuilder<unknown>): RawBuilder<unknown>;
  }
) {
  return listRows(db, roleListSource(actor, permissionJson), ["id", "name"], query, presentRole);
}

export function showRole(
  db: Kysely<IdentitySchema>,
  actor: Principal,
  id: string,
  permissionJson: {
    system(id: RawBuilder<unknown>): RawBuilder<unknown>;
    custom(id: RawBuilder<unknown>): RawBuilder<unknown>;
  }
) {
  return showRow(db, roleListSource(actor, permissionJson), id, presentRole);
}

export async function verifyRoleSchema(db: Kysely<IdentitySchema>) {
  await db.selectFrom("identity_roles").select(["id", "version"]).limit(1).execute();
  await db
    .selectFrom("identity_custom_roles")
    .select(["app_id", "tenant_id", "version"])
    .limit(1)
    .execute();
}

export function activeCustomRole(
  db: Kysely<IdentitySchema>,
  id: string,
  appId: string,
  tenantId: string
) {
  return db
    .selectFrom("identity_custom_roles")
    .select("id")
    .where("id", "=", id)
    .where("app_id", "=", appId)
    .where("tenant_id", "=", tenantId)
    .where("active", "=", 1)
    .executeTakeFirst();
}

export function customRoleInApp(db: Kysely<IdentitySchema>, id: string, appId: string) {
  return db.selectFrom("identity_custom_roles").select("id")
    .where("id", "=", id).where("app_id", "=", appId).executeTakeFirst();
}

export const customRoleNameSource = () => sql`select id,name,app_id from identity_custom_roles`;
export const customRoleIdsSource = (appId: string) =>
  sql`select id from identity_custom_roles where app_id=${appId}`;

function roleListSource(
  actor: Principal,
  permissionJson: {
    system(id: RawBuilder<unknown>): RawBuilder<unknown>;
    custom(id: RawBuilder<unknown>): RawBuilder<unknown>;
  }
) {
  const global = actor.portal === "super-admin";
  return sql`select r.id,r.id as name,r.id as portal,1 as system,null as tenantId,1 as active,r.version,${permissionJson.system(sql.ref("r.id"))} as permissionIds from identity_roles r
    union all select c.id,c.name,'user' as portal,0 as system,c.tenant_id as tenantId,c.active,c.version,
    ${permissionJson.custom(sql.ref("c.id"))} as permissionIds
    from identity_custom_roles c where c.app_id=${actor.appId} ${global ? sql`` : sql`and c.tenant_id=${actor.tenant.id}`}`;
}
