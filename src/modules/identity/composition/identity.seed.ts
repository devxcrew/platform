import type { Kysely } from "kysely";
import type { IdentitySchema } from "../identity.types.js";
import { seedOrganization } from "../organization/index.js";
import { seedRoles } from "../role/index.js";
import { seedPermissions } from "../permission/index.js";
import { seedRolePermissions } from "../role-permission/index.js";
import { seedAccounts, seedUsers } from "../user/index.js";
import { seedMemberships } from "../user-role/index.js";

export async function seedIdentity(db: Kysely<IdentitySchema>, env: NodeJS.ProcessEnv) {
  const accounts = seedAccounts(env);
  await db.transaction().execute(async (trx) => {
    await seedOrganization(trx, env);
    await seedRoles(trx);
    await seedPermissions(trx);
    await seedRolePermissions(trx);
    await seedMemberships(trx, await seedUsers(trx, accounts));
  });
}
