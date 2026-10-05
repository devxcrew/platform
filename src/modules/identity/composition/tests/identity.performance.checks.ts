import assert from "node:assert/strict";
import type { Kysely } from "kysely";
import type { IdentitySchema } from "../../identity.types.js";

// Run only against the integration suite's disposable SQLite file.
export async function verifyListPerformance(
  db: Kysely<IdentitySchema>,
  list: () => Promise<Response>
) {
  const count = 1000;
  const prefix = "performance-fixture-";
  const seed = await db
    .selectFrom("identity_users")
    .select("password_hash")
    .executeTakeFirstOrThrow();
  await db.transaction().execute(async (transaction) => {
    for (let index = 0; index < count; index++) {
      const id = `${prefix}${index}`;
      await transaction
        .insertInto("identity_users")
        .values({
          id,
          name: id,
          email: `${id}@example.test`,
          password_hash: seed.password_hash,
          active: 1
        })
        .execute();
      await transaction
        .insertInto("identity_memberships")
        .values({
          user_id: id,
          tenant_id: "default",
          role_id: "user",
          custom_role_id: null,
          active: 1
        })
        .execute();
    }
  });
  try {
    const durations: number[] = [];
    for (let iteration = 0; iteration < 5; iteration++) {
      const started = performance.now();
      const response = await list();
      assert.equal(response.status, 200);
      const payload = await response.json();
      durations.push(performance.now() - started);
      assert.equal(payload.meta.total, count);
      assert.equal(payload.data.length, 100);
      assert.ok(payload.data.every((row: { name: string }) => row.name.startsWith(prefix)));
    }
    const maximum = Math.max(...durations);
    assert.ok(maximum < 1000, `Local list/count budget exceeded: ${maximum.toFixed(1)} ms`);
    console.info(
      `SQLite HTTP list/count: ${count} rows, 5 reads, max ${maximum.toFixed(1)} ms, local budget 1000 ms.`
    );
  } finally {
    await db.deleteFrom("identity_memberships").where("user_id", "like", `${prefix}%`).execute();
    await db.deleteFrom("identity_users").where("id", "like", `${prefix}%`).execute();
  }
}
