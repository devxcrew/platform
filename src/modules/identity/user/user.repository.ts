import type { IdentityPermissionProvider } from "../permission/index.js";
import { sql, type Kysely } from "kysely";
import type { IdentitySchema, Portal, Principal } from "../identity.types.js";
import { checkIdentityRequest } from "../support/identity.request-context.js";
import type { IdentityListQuery } from "../support/pagination.schema.js";
import { listRows, showRow } from "../support/pagination.js";

const presentUser = (row: Record<string, unknown>) => ({
  ...row,
  active: Boolean(row.active),
  version: Number(row.version)
});

export function listUsers(db: Kysely<IdentitySchema>, actor: Principal, query: IdentityListQuery) {
  return listRows(db, userListSource(actor), ["id", "name", "email"], query, presentUser);
}

export function showUser(db: Kysely<IdentitySchema>, actor: Principal, id: string) {
  return showRow(db, userListSource(actor), id, presentUser);
}

function userListSource(actor: Principal) {
  const global = actor.portal === "super-admin";
  return sql`select u.id,u.name,u.email,u.active,u.version from identity_users u
    where exists (select 1 from identity_memberships m left join identity_custom_roles c on c.id=m.custom_role_id
      where m.user_id=u.id and (m.custom_role_id is null or c.app_id=${actor.appId})
      ${global ? sql`` : sql`and m.tenant_id=${actor.tenant.id}`})
      ${global ? sql`or not exists(select 1 from identity_memberships m where m.user_id=u.id)` : sql``}`;
}

export class IdentityUserRepository {
  constructor(
    private readonly db: Kysely<IdentitySchema>,
    private readonly permissions: IdentityPermissionProvider
  ) {}

  async verifySchema() {
    await this.db.selectFrom("identity_users").select("version").limit(1).execute();
    await this.db
      .selectFrom("identity_tokens")
      .select(["delivered", "consumed_at"])
      .limit(1)
      .execute();
  }

  user(email: string) {
    return this.db
      .selectFrom("identity_users")
      .selectAll()
      .where("email", "=", email)
      .executeTakeFirst();
  }

  async sessionSeconds(appId: string, fallback: number) {
    const row = await this.db
      .selectFrom("identity_app_settings")
      .select("session_seconds")
      .where("app_id", "=", appId)
      .executeTakeFirst();
    return Number(row?.session_seconds ?? fallback);
  }

  async principal(userId: string, tenantId: string, portal: Portal, appId: string) {
    const member = await this.db
      .selectFrom("identity_memberships as m")
      .innerJoin("identity_users as u", "u.id", "m.user_id")
      .innerJoin("identity_tenants as t", "t.id", "m.tenant_id")
      .select([
        "u.id",
        "u.email",
        "u.name",
        "t.id as tenantId",
        "t.name as tenantName",
        "m.custom_role_id as customRoleId"
      ])
      .where("u.id", "=", userId)
      .where("m.tenant_id", "=", tenantId)
      .where("m.role_id", "=", portal)
      .where("m.active", "=", 1)
      .where("u.active", "=", 1)
      .where("t.active", "=", 1)
      .executeTakeFirst();
    if (!member) return null;
    if (member.customRoleId) {
      const role = await this.db
        .selectFrom("identity_custom_roles")
        .select("id")
        .where("id", "=", member.customRoleId)
        .where("app_id", "=", appId)
        .where("tenant_id", "=", tenantId)
        .where("active", "=", 1)
        .executeTakeFirst();
      if (!role || portal !== "user") return null;
      const permissions = await this.db
        .selectFrom("identity_custom_role_permissions")
        .select("permission_id")
        .where("role_id", "=", role.id)
        .execute();
      return {
        user: { id: member.id, email: member.email, name: member.name },
        tenant: { id: member.tenantId, name: member.tenantName },
        permissions: await this.permissions.filterDeclared(
          this.db,
          appId,
          portal,
          permissions.map((row) => row.permission_id)
        )
      };
    }
    const permissions = await this.db
      .selectFrom("identity_role_permissions")
      .select("permission_id")
      .where("role_id", "=", portal)
      .execute();
    return {
      user: { id: member.id, email: member.email, name: member.name },
      tenant: { id: member.tenantId, name: member.tenantName },
      permissions: await this.permissions.filterDeclared(
        this.db,
        appId,
        portal,
        permissions.map((p) => p.permission_id)
      )
    };
  }

  async session(tokenHash: string, appId: string, portal: Portal, now: string) {
    return this.db
      .selectFrom("identity_sessions")
      .selectAll()
      .where("token_hash", "=", tokenHash)
      .where("app_id", "=", appId)
      .where("portal", "=", portal)
      .where("expires_at", ">", now)
      .executeTakeFirst();
  }

  async createSession(
    session: IdentitySchema["identity_sessions"],
    expectedHash: string,
    previous?: string
  ) {
    return this.db.transaction().execute(async (trx) => {
      checkIdentityRequest();
      const current = await trx
        .selectFrom("identity_users")
        .select("id")
        .where("id", "=", session.user_id)
        .where("password_hash", "=", expectedHash)
        .where("active", "=", 1)
        .executeTakeFirst();
      if (!current) return false;
      const membership = await trx
        .selectFrom("identity_memberships")
        .select("custom_role_id")
        .where("user_id", "=", session.user_id)
        .where("tenant_id", "=", session.tenant_id)
        .where("role_id", "=", session.portal)
        .where("active", "=", 1)
        .executeTakeFirst();
      if (!membership) return false;
      if (membership.custom_role_id) {
        const role = await trx
          .selectFrom("identity_custom_roles")
          .select("id")
          .where("id", "=", membership.custom_role_id)
          .where("app_id", "=", session.app_id)
          .where("tenant_id", "=", session.tenant_id)
          .where("active", "=", 1)
          .executeTakeFirst();
        if (!role) return false;
      }
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

  async changePassword(userId: string, expectedHash: string, passwordHash: string) {
    return this.db.transaction().execute(async (trx) => {
      checkIdentityRequest();
      const result = await trx
        .updateTable("identity_users")
        .set({ password_hash: passwordHash })
        .where("id", "=", userId)
        .where("password_hash", "=", expectedHash)
        .executeTakeFirst();
      if (result.numUpdatedRows !== 1n) return false;
      await trx.deleteFrom("identity_sessions").where("user_id", "=", userId).execute();
      return true;
    });
  }
}
