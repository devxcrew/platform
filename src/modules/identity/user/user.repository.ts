import type { IdentityPermissionProvider } from "../permission/index.js";
import { sql, type Kysely, type RawBuilder } from "kysely";
import type { IdentitySchema, Portal } from "../identity.types.js";
import { checkIdentityRequest } from "../support/identity.request-context.js";
import type { IdentityListQuery } from "../support/pagination.schema.js";
import { listRows, showRow } from "../support/pagination.js";
import type { IdentityUserOwnership } from "./user.provider.js";

const presentUser = (row: Record<string, unknown>) => ({
  ...row,
  active: Boolean(row.active),
  version: Number(row.version)
});

export const userNameSource = () => sql`select id,name,active from identity_users`;
export async function activeUserIds(db: Kysely<IdentitySchema>, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await db
    .selectFrom("identity_users")
    .select("id")
    .where("id", "in", ids)
    .where("active", "=", 1)
    .execute();
  return rows.map((row) => row.id);
}

export function listUsers(
  db: Kysely<IdentitySchema>,
  query: IdentityListQuery,
  visibility: RawBuilder<unknown>
) {
  return listRows(db, userListSource(visibility), ["id", "name", "email"], query, presentUser);
}

export function showUser(
  db: Kysely<IdentitySchema>,
  id: string,
  visibility: RawBuilder<unknown>
) {
  return showRow(db, userListSource(visibility), id, presentUser);
}

function userListSource(visibility: RawBuilder<unknown>) {
  return sql`select u.id,u.name,u.email,u.active,u.version from identity_users u
    where ${visibility}`;
}

export class IdentityUserRepository {
  constructor(
    private readonly db: Kysely<IdentitySchema>,
    private readonly permissions: IdentityPermissionProvider,
    private readonly ownership: IdentityUserOwnership
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
    return this.ownership.sessionSeconds(appId, fallback);
  }

  async principal(userId: string, tenantId: string, portal: Portal, appId: string) {
    const user = await this.db
      .selectFrom("identity_users")
      .select(["id", "email", "name"])
      .where("id", "=", userId)
      .where("active", "=", 1)
      .executeTakeFirst();
    if (!user) return null;
    const membership = await this.ownership.activeMembership(this.db, userId, tenantId, portal);
    if (!membership) return null;
    const tenant = await this.ownership.activeOrganizationDetail(this.db, tenantId);
    if (!tenant) return null;
    const ids = await this.ownership.permissionIds(
      this.db,
      portal,
      membership.custom_role_id,
      appId,
      tenantId
    );
    if (!ids) return null;
    return {
      user: { id: user.id, email: user.email, name: user.name },
      tenant,
      permissions: await this.permissions.filterDeclared(this.db, appId, portal, ids)
    };
  }

  session(tokenHash: string, appId: string, portal: Portal, now: string) {
    return this.ownership.activeSession(tokenHash, appId, portal, now);
  }

  createSession(
    session: IdentitySchema["identity_sessions"],
    expectedHash: string,
    previous?: string
  ) {
    return this.ownership.createSession(session, previous, async (trx) => {
      const current = await trx
        .selectFrom("identity_users")
        .select("id")
        .where("id", "=", session.user_id)
        .where("password_hash", "=", expectedHash)
        .where("active", "=", 1)
        .executeTakeFirst();
      if (!current) return false;
      const membership = await this.ownership.activeMembership(
        trx,
        session.user_id,
        session.tenant_id,
        session.portal
      );
      if (!membership) return false;
      if (!(await this.ownership.activeOrganizationDetail(trx, session.tenant_id))) return false;
      const permissions = await this.ownership.permissionIds(
        trx,
        session.portal,
        membership.custom_role_id,
        session.app_id,
        session.tenant_id
      );
      return permissions !== null;
    });
  }

  revoke(tokenHash: string, appId: string, portal: Portal) {
    return this.ownership.revokeSession(tokenHash, appId, portal);
  }

  throttle(key: string) {
    return this.ownership.throttle(key);
  }

  clearThrottle(key: string) {
    return this.ownership.clearThrottle(key);
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
      await this.ownership.revokeUserSessions(trx, userId);
      return true;
    });
  }
}
