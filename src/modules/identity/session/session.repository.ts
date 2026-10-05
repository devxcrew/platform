import { sql, type Kysely, type Transaction } from "kysely";
import type { IdentitySchema, Portal, Principal } from "../identity.types.js";
import { checkIdentityRequest } from "../support/identity.request-context.js";
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

  active(tokenHash: string, appId: string, portal: Portal, now: string) {
    return this.db
      .selectFrom("identity_sessions")
      .selectAll()
      .where("token_hash", "=", tokenHash)
      .where("app_id", "=", appId)
      .where("portal", "=", portal)
      .where("expires_at", ">", now)
      .executeTakeFirst();
  }

  async create(
    session: IdentitySchema["identity_sessions"],
    previous: string | undefined,
    eligible: (trx: Transaction<IdentitySchema>) => Promise<boolean>
  ) {
    return this.db.transaction().execute(async (trx) => {
      checkIdentityRequest();
      if (!(await eligible(trx))) return false;
      await trx
        .deleteFrom("identity_sessions")
        .where("expires_at", "<=", new Date().toISOString())
        .execute();
      if (previous)
        await trx
          .deleteFrom("identity_sessions")
          .where("token_hash", "=", previous)
          .where("app_id", "=", session.app_id)
          .where("portal", "=", session.portal)
          .execute();
      await trx.insertInto("identity_sessions").values(session).execute();
      checkIdentityRequest();
      return true;
    });
  }

  async revoke(tokenHash: string, appId: string, portal: Portal) {
    checkIdentityRequest();
    await this.db
      .deleteFrom("identity_sessions")
      .where("token_hash", "=", tokenHash)
      .where("app_id", "=", appId)
      .where("portal", "=", portal)
      .execute();
  }

  async throttle(key: string) {
    const now = new Date();
    return this.db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom("identity_throttles")
        .where("expires_at", "<=", now.toISOString())
        .execute();
      await trx
        .insertInto("identity_throttles")
        .values({
          key,
          attempts: 1,
          expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString()
        })
        .onConflict((c) => c.column("key").doUpdateSet({ attempts: sql`attempts + 1` }))
        .execute();
      const row = await trx
        .selectFrom("identity_throttles")
        .select("attempts")
        .where("key", "=", key)
        .executeTakeFirstOrThrow();
      return Number(row.attempts);
    });
  }

  async clearThrottle(key: string) {
    await this.db.deleteFrom("identity_throttles").where("key", "=", key).execute();
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
