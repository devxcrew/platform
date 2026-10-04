import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { IdentitySchema } from "./identity.types.js";
import { accountSchema } from "./identity.schema.js";
import { hashPassword } from "./identity.password.js";

export async function seedIdentity(
  db: Kysely<IdentitySchema>,
  env: NodeJS.ProcessEnv,
) {
  const tenantId = env.IDENTITY_TENANT_ID ?? "default";
  const accounts = ["user", "admin", "super-admin"].flatMap((portal) => {
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
        tenantId,
      }),
    ];
  });
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto("identity_tenants")
      .values({
        id: tenantId,
        name: env.IDENTITY_TENANT_NAME ?? "Default organization",
        active: 1,
      })
      .onConflict((c) => c.column("id").doNothing())
      .execute();
    for (const portal of ["user", "admin", "super-admin"]) {
      await trx
        .insertInto("identity_roles")
        .values({ id: portal })
        .onConflict((c) => c.column("id").doNothing())
        .execute();
      for (const permission of [
        `desk.${portal}`,
        "identity.self",
        "identity.password",
        ...(portal === "user" ? [] : ["identity.manage"]),
      ]) {
        await trx
          .insertInto("identity_permissions")
          .values({ id: permission })
          .onConflict((c) => c.column("id").doNothing())
          .execute();
        await trx
          .insertInto("identity_role_permissions")
          .values({ role_id: portal, permission_id: permission })
          .onConflict((c) =>
            c.columns(["role_id", "permission_id"]).doNothing(),
          )
          .execute();
      }
    }
    for (const account of accounts) {
      const existing = await trx
        .selectFrom("identity_users")
        .select("id")
        .where("email", "=", account.email)
        .executeTakeFirst();
      if (existing) continue;
      const id = randomUUID();
      await trx
        .insertInto("identity_users")
        .values({
          id,
          email: account.email,
          name: account.name,
          password_hash: await hashPassword(account.password),
          active: 1,
        })
        .execute();
      await trx
        .insertInto("identity_memberships")
        .values({ user_id: id, tenant_id: tenantId, role_id: account.portal })
        .execute();
    }
  });
}
