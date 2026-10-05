import { sql, type Kysely, type RawBuilder, type Transaction } from "kysely";
import type { IdentitySchema, Principal } from "../identity.types.js";
import type { IdentityListQuery } from "../support/pagination.schema.js";
import { listRows, showRow } from "../support/pagination.js";

export interface MembershipReadSources {
  users(): RawBuilder<unknown>;
  organizations(): RawBuilder<unknown>;
  roles(): RawBuilder<unknown>;
  customRoleIds(appId: string): RawBuilder<unknown>;
}

const presentMembership = (row: Record<string, unknown>) => ({
  ...row,
  active: Boolean(row.active),
  version: Number(row.version)
});

export function listMemberships(
  db: Kysely<IdentitySchema>,
  actor: Principal,
  query: IdentityListQuery,
  sources: MembershipReadSources
) {
  return listRows(
    db,
    membershipListSource(actor, sources),
    ["id", "userName", "organizationName", "roleName"],
    query,
    presentMembership
  );
}

export function showMembership(
  db: Kysely<IdentitySchema>,
  actor: Principal,
  id: string,
  sources: MembershipReadSources
) {
  return showRow(db, membershipListSource(actor, sources), id, presentMembership);
}

export function userVisibility(
  actor: Principal,
  customRoleIds: (appId: string) => RawBuilder<unknown>,
  userId: RawBuilder<unknown>
) {
  const eligible = sql`select m.user_id from identity_memberships m
    where m.user_id=${userId} and (m.custom_role_id is null or m.custom_role_id in (${customRoleIds(actor.appId)}))
    ${actor.portal === "super-admin" ? sql`` : sql`and m.tenant_id=${actor.tenant.id}`}`;
  return actor.portal === "super-admin"
    ? sql`exists (${eligible}) or not exists (select 1 from identity_memberships m where m.user_id=${userId})`
    : sql`exists (${eligible})`;
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

export async function assertManageableUser(trx: Transaction<IdentitySchema>, userId: string) {
  const privileged = await trx
    .selectFrom("identity_memberships")
    .select("role_id")
    .where("user_id", "=", userId)
    .where("role_id", "in", ["admin", "super-admin"])
    .executeTakeFirst();
  if (privileged) return "privileged" as const;
  const tenants = await trx
    .selectFrom("identity_memberships")
    .select("tenant_id")
    .where("user_id", "=", userId)
    .distinct()
    .execute();
  return tenants.length > 1 ? ("shared" as const) : ("manageable" as const);
}

export async function assignInvitedMembership(
  trx: Transaction<IdentitySchema>,
  userId: string,
  tenantId: string,
  roleId: "user" | "admin" | "super-admin"
) {
  await trx
    .insertInto("identity_memberships")
    .values({ user_id: userId, tenant_id: tenantId, role_id: roleId })
    .execute();
}

export function activeMembership(
  db: Kysely<IdentitySchema>,
  userId: string,
  tenantId: string,
  portal: "user" | "admin" | "super-admin"
) {
  return db
    .selectFrom("identity_memberships")
    .select("custom_role_id")
    .where("user_id", "=", userId)
    .where("tenant_id", "=", tenantId)
    .where("role_id", "=", portal)
    .where("active", "=", 1)
    .executeTakeFirst();
}

function membershipListSource(actor: Principal, sources: MembershipReadSources) {
  const global = actor.portal === "super-admin";
  return sql`select m.user_id||'~'||m.tenant_id||'~'||m.role_id as id,m.user_id as userId,m.tenant_id as tenantId,
    coalesce(m.custom_role_id,m.role_id) as roleId,m.role_id as portal,m.active,m.version,u.name as userName,t.name as organizationName,
    coalesce(c.name,m.role_id) as roleName from identity_memberships m
    join (${sources.users()}) u on u.id=m.user_id join (${sources.organizations()}) t on t.id=m.tenant_id
    left join (${sources.roles()}) c on c.id=m.custom_role_id
    where (m.custom_role_id is null or c.app_id=${actor.appId}) ${global ? sql`` : sql`and m.tenant_id=${actor.tenant.id}`}`;
}
