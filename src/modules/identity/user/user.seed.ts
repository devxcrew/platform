import { randomUUID } from "node:crypto";
import type { Transaction } from "kysely";
import type { IdentitySchema, Portal } from "../identity.types.js";
import { accountSchema } from "./user.schema.js";
import { hashPassword } from "./user.password.js";

export function seedAccounts(env: NodeJS.ProcessEnv) {
  const tenantId = env.IDENTITY_TENANT_ID ?? "default";
  return (["user", "admin", "super-admin"] as Portal[]).flatMap((portal) => {
    const prefix = `IDENTITY_SEED_${portal.toUpperCase().replace("-", "_")}`;
    const email = env[`${prefix}_EMAIL`];
    const password = env[`${prefix}_PASSWORD`];
    if (!email && !password) return [];
    return [
      accountSchema.parse({
        email,
        password,
        name: env[`${prefix}_NAME`]?.trim() || portal,
        portal,
        tenantId
      })
    ];
  });
}

export async function seedUsers(
  trx: Transaction<IdentitySchema>,
  accounts: ReturnType<typeof seedAccounts>
) {
  const created: Array<{ userId: string; tenantId: string; portal: Portal }> = [];
  for (const account of accounts) {
    const existing = await trx
      .selectFrom("identity_users")
      .select("id")
      .where("email", "=", account.email)
      .executeTakeFirst();
    if (existing) continue;
    const userId = randomUUID();
    await trx
      .insertInto("identity_users")
      .values({
        id: userId,
        email: account.email,
        name: account.name,
        password_hash: await hashPassword(account.password),
        active: 1
      })
      .execute();
    created.push({ userId, tenantId: account.tenantId, portal: account.portal });
  }
  return created;
}
