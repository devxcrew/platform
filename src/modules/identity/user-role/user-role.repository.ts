import { sql, type Kysely, type Transaction } from "kysely";
import type { IdentitySchema, Principal } from "../identity.types.js";
import type { IdentityListQuery } from "../support/pagination.schema.js";
import { listRows, showRow } from "../support/pagination.js";

const presentMembership = (row: Record<string, unknown>) => ({
  ...row,
  active: Boolean(row.active),
  version: Number(row.version)
});

export function listMemberships(
  db: Kysely<IdentitySchema>,
  actor: Principal,
  query: IdentityListQuery
) {
  return listRows(
    db,
    membershipListSource(actor),
    ["id", "userName", "organizationName", "roleName"],
    query,
    presentMembership
  );
}

export function showMembership(db: Kysely<IdentitySchema>, actor: Principal, id: string) {
  return showRow(db, membershipListSource(actor), id, presentMembership);
}

export async function verifyMembershipSchema(db: Kysely<IdentitySchema>) {
  await db
    .selectFrom("identity_memberships")
    .select(["custom_role_id", "active", "version"])
    .limit(1)
    .execute();
}

export async function membershipTenantIds(trx: Transaction<IdentitySchema>, userId: string) {
  const rows = await trx
    .selectFrom("identity_memberships")
    .select("tenant_id")
    .where("user_id", "=", userId)
    .distinct()
    .execute();
  return rows.map((row) => row.tenant_id);
}

export async function customRoleUserIds(trx: Transaction<IdentitySchema>, roleId: string) {
  const rows = await trx
    .selectFrom("identity_memberships")
    .select("user_id")
    .where("custom_role_id", "=", roleId)
    .execute();
  return rows.map((row) => row.user_id);
}

function membershipListSource(actor: Principal) {
  const global = actor.portal === "super-admin";
  return sql`select m.user_id||'~'||m.tenant_id||'~'||m.role_id as id,m.user_id as userId,m.tenant_id as tenantId,
    coalesce(m.custom_role_id,m.role_id) as roleId,m.role_id as portal,m.active,m.version,u.name as userName,t.name as organizationName,
    coalesce(c.name,m.role_id) as roleName from identity_memberships m
    join identity_users u on u.id=m.user_id join identity_tenants t on t.id=m.tenant_id
    left join identity_custom_roles c on c.id=m.custom_role_id
    where (m.custom_role_id is null or c.app_id=${actor.appId}) ${global ? sql`` : sql`and m.tenant_id=${actor.tenant.id}`}`;
}
