import type { Transaction } from "kysely";
import type { IdentitySchema } from "./identity.types.js";
import { IdentityError } from "./identity.error.js";

export async function protectAdministrators(
  trx: Transaction<IdentitySchema>,
  userId: string,
  tenantId?: string,
  roleId?: string,
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
    const peer = await trx
      .selectFrom("identity_memberships as m")
      .innerJoin("identity_users as u", "u.id", "m.user_id")
      .select("u.id")
      .where("m.tenant_id", "=", member.tenant_id)
      .where("m.role_id", "=", member.role_id)
      .where("m.active", "=", 1)
      .where("u.active", "=", 1)
      .where("u.id", "!=", userId)
      .executeTakeFirst();
    if (!peer)
      throw new IdentityError(
        409,
        "Keep at least one active administrator for this role and organization.",
      );
  }
}
