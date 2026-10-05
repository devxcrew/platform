import type { Transaction } from "kysely";
import type { IdentitySchema, Portal } from "../identity.types.js";

export async function seedRoles(trx: Transaction<IdentitySchema>) {
  for (const portal of ["user", "admin", "super-admin"] as Portal[])
    await trx
      .insertInto("identity_roles")
      .values({ id: portal })
      .onConflict((c) => c.column("id").doNothing())
      .execute();
}
