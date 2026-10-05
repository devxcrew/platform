import type { Transaction } from "kysely";
import type { IdentitySchema, Portal } from "../identity.types.js";

export async function seedMemberships(
  trx: Transaction<IdentitySchema>,
  created: Array<{ userId: string; tenantId: string; portal: Portal }>
) {
  for (const account of created)
    await trx
      .insertInto("identity_memberships")
      .values({
        user_id: account.userId,
        tenant_id: account.tenantId,
        role_id: account.portal
      })
      .execute();
}
