import { sql, type Kysely, type Transaction } from "kysely";
import type { IdentitySchema, Portal, Principal } from "../identity.types.js";
import type { IdentityListQuery } from "../support/pagination.schema.js";
import { listRows, showRow } from "../support/pagination.js";

function sessionListSource(actor: Principal) {
  const global = actor.portal === "super-admin";
  return sql`select token_hash as id,user_id as userId,tenant_id as tenantId,portal,expires_at as expiresAt from identity_sessions
    where app_id=${actor.appId} and expires_at>${new Date().toISOString()}
    ${global ? sql`` : sql`and tenant_id=${actor.tenant.id}`}
    ${actor.portal === "user" ? sql`and user_id=${actor.user.id}` : sql``}`;
}

export class IdentitySessionRepository {
  constructor(private readonly db: Kysely<IdentitySchema>) {}

  async verifySchema() {
    await this.db.selectFrom("identity_sessions").select("token_hash").limit(1).execute();
    await this.db.selectFrom("identity_throttles").select("key").limit(1).execute();
  }

  list(actor: Principal, query: IdentityListQuery) {
    return listRows(this.db, sessionListSource(actor), ["id"], query, (row) => row);
  }
  show(actor: Principal, id: string) {
    return showRow(this.db, sessionListSource(actor), id, (row) => row);
  }
  async revokeTenant(trx: Transaction<IdentitySchema>, tenantId: string) {
    await trx.deleteFrom("identity_sessions").where("tenant_id", "=", tenantId).execute();
  }
  async revokeApp(trx: Transaction<IdentitySchema>, appId: string) {
    await trx.deleteFrom("identity_sessions").where("app_id", "=", appId).execute();
  }
  async revokeOne(trx: Transaction<IdentitySchema>, appId: string, tokenHash: string) {
    await trx
      .deleteFrom("identity_sessions")
      .where("token_hash", "=", tokenHash)
      .where("app_id", "=", appId)
      .execute();
  }

  async revokeUser(trx: Transaction<IdentitySchema>, userId: string) {
    await trx.deleteFrom("identity_sessions").where("user_id", "=", userId).execute();
  }

  async revokeMembership(
    trx: Transaction<IdentitySchema>,
    appId: string,
    userId: string,
    tenantId: string,
    portal: Portal
  ) {
    await trx
      .deleteFrom("identity_sessions")
      .where("app_id", "=", appId)
      .where("user_id", "=", userId)
      .where("tenant_id", "=", tenantId)
      .where("portal", "=", portal)
      .execute();
  }

  async revokeRoleMembers(
    trx: Transaction<IdentitySchema>,
    appId: string,
    tenantId: string,
    userIds: string[]
  ) {
    if (userIds.length === 0) return;
    await trx
      .deleteFrom("identity_sessions")
      .where("app_id", "=", appId)
      .where("tenant_id", "=", tenantId)
      .where("user_id", "in", userIds)
      .execute();
  }
}
