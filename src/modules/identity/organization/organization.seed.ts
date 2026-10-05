import type { Transaction } from "kysely";
import type { IdentitySchema } from "../identity.types.js";

export async function seedOrganization(trx: Transaction<IdentitySchema>, env: NodeJS.ProcessEnv) {
  await trx
    .insertInto("identity_tenants")
    .values({
      id: env.IDENTITY_TENANT_ID ?? "default",
      name: env.IDENTITY_TENANT_NAME ?? "Default organization",
      active: 1
    })
    .onConflict((c) => c.column("id").doNothing())
    .execute();
}
