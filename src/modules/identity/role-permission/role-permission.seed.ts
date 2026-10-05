import type { Transaction } from "kysely";
import type { IdentitySchema, Portal } from "../identity.types.js";
import { defaultPermissions } from "../permission/index.js";

export async function seedRolePermissions(trx: Transaction<IdentitySchema>) {
  for (const portal of ["user", "admin", "super-admin"] as Portal[])
    for (const permission of defaultPermissions(portal))
      await trx
        .insertInto("identity_role_permissions")
        .values({ role_id: portal, permission_id: permission })
        .onConflict((c) => c.columns(["role_id", "permission_id"]).doNothing())
        .execute();
}
