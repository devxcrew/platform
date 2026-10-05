import type { Transaction } from "kysely";
import type { IdentitySchema, Portal } from "../identity.types.js";

export function defaultPermissions(portal: Portal) {
  return [
    `desk.${portal}`,
    "identity.self",
    "identity.password",
    ...(portal === "user" ? [] : ["identity.manage"])
  ];
}

export async function seedPermissions(trx: Transaction<IdentitySchema>) {
  for (const portal of ["user", "admin", "super-admin"] as Portal[])
    for (const permission of defaultPermissions(portal))
      await trx
        .insertInto("identity_permissions")
        .values({ id: permission })
        .onConflict((c) => c.column("id").doNothing())
        .execute();
}
