import type { Kysely, Transaction } from "kysely";
import type { IdentitySchema } from "../identity.types.js";
import { IdentityError } from "../support/identity.error.js";

export async function protectAdministrators(
  trx: Transaction<IdentitySchema>,
  userId: string,
  activeUsers: (db: Kysely<IdentitySchema>, ids: string[]) => Promise<string[]>,
  tenantId?: string,
  roleId?: string
) {
  let query = trx
    .selectFrom("identity_memberships")
    .selectAll()
    .where("user_id", "=", userId)
    .where("active", "=", 1)
    .where("role_id", "in", ["admin", "super-admin"]);
  if (tenantId) query = query.where("tenant_id", "=", tenantId);
  if (roleId) query = query.where("role_id", "=", roleId);
  for (const member of await query.execute()) {
    const peers = await trx
      .selectFrom("identity_memberships")
      .select("user_id")
      .where("tenant_id", "=", member.tenant_id)
      .where("role_id", "=", member.role_id)
      .where("active", "=", 1)
      .where("user_id", "!=", userId)
      .execute();
    if (
      (
        await activeUsers(
          trx,
          peers.map((peer) => peer.user_id)
        )
      ).length === 0
    )
      throw new IdentityError(
        409,
        "Keep at least one active administrator for this role and organization."
      );
  }
}
