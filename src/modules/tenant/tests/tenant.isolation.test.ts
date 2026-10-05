import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import {
  createDatabaseProvider as createFrameworkDatabase,
  storageMigrations
} from "@devxcrew/framework";
import { identityMigration } from "../../identity/index.js";
import { tenantConnectionsMigration, type TenantMasterSchema } from "../index.js";
const migrations = {
  ...storageMigrations,
  "003_identity": identityMigration,
  "004_tenant": tenantConnectionsMigration
};
function createDatabaseProvider(environment: NodeJS.ProcessEnv) {
  return createFrameworkDatabase<TenantMasterSchema>(environment, { migrations });
}

import { createTenantProvider, verifyTenantReadiness, type TenantPrincipal } from "../index.js";

class TenantFixture {
  private constructor(
    readonly root: string,
    readonly master: ReturnType<typeof createDatabaseProvider>
  ) {}
  static async open() {
    const root = await mkdtemp(join(tmpdir(), "tenant-isolation-"));
    const master = createDatabaseProvider({
      DB_DRIVER: "sqlite",
      DB_SQLITE_PATH: join(root, "master.sqlite"),
      DB_POOL_CACHE_LIMIT: "2"
    });
    const fixture = new TenantFixture(root, master);
    await master.migrate();
    for (const id of ["one", "two"]) {
      const path = join(root, `${id}.sqlite`);
      const tenant = createDatabaseProvider({ DB_DRIVER: "sqlite", DB_SQLITE_PATH: path });
      try {
        await tenant.migrate();
        await tenant.database
          .insertInto("application_metadata")
          .values({ key: "owner", value: id })
          .execute();
      } finally {
        await tenant.close();
      }
      await master.database
        .insertInto("identity_tenants")
        .values({ id, name: id, active: 1 })
        .execute();
      await master.database
        .insertInto("tenant_connections")
        .values({
          tenant_id: id,
          driver: "sqlite",
          sqlite_path: path,
          database_name: null,
          active: 1
        })
        .execute();
    }
    return fixture;
  }
  principal(id: string): TenantPrincipal {
    return {
      appId: "test",
      user: { id: `user-${id}`, name: id, email: `${id}@example.test` },
      tenant: { id, name: id },
      portal: "user",
      permissions: []
    };
  }
  provider(mode: "single-client" | "multi-tenant" = "multi-tenant") {
    return createTenantProvider(
      this.master,
      { authenticateRequest: async () => this.principal("one") },
      { IDENTITY_MODE: mode, IDENTITY_TENANT_ID: "one" }
    );
  }
  async close() {
    await this.master.close();
    await rm(this.root, { recursive: true, force: true });
  }
}

test("two real tenant databases isolate concurrent reads and writes from the master", async () => {
  const fixture = await TenantFixture.open();
  const tenants = fixture.provider();
  try {
    assert.throws(() => tenants.current(), /authenticated tenant context/);
    await Promise.all(
      ["one", "two"].map((id) =>
        tenants.withPrincipal(fixture.principal(id), undefined, async () => {
          const scope = tenants.current();
          await new Promise((resolve) => setImmediate(resolve));
          assert.equal(tenants.current(), scope);
          const result = await scope.data.fetch(
            { page: 1, pageSize: 1 },
            (db, page) =>
              db.selectFrom("application_metadata").selectAll().limit(page.limit).execute(),
            z.strictObject({ key: z.string(), value: z.string() })
          );
          assert.equal(result.data[0].value, id);
          await scope.data.persist(
            z.strictObject({ key: z.string(), value: z.string() }),
            { key: "private", value: id },
            (db, row) => db.insertInto("application_metadata").values(row).execute()
          );
        })
      )
    );
    assert.equal(
      (await fixture.master.database.selectFrom("application_metadata").selectAll().execute())
        .length,
      0
    );
    await assert.rejects(
      tenants.withPrincipal(fixture.principal("one"), "two", async () => {}),
      /does not authorize/
    );
    assert.equal((await verifyTenantReadiness(fixture.master)).checked, 2);
  } finally {
    await fixture.close();
  }
});

test("single-client, disabled mapping, context cleanup and failed requests deny cross-scope access", async () => {
  const fixture = await TenantFixture.open();
  const tenants = fixture.provider("single-client");
  try {
    await assert.rejects(
      tenants.withPrincipal(fixture.principal("two"), undefined, async () => {}),
      /does not authorize/
    );
    await assert.rejects(
      tenants.withPrincipal(fixture.principal("one"), undefined, async () => {
        throw new Error("request failed");
      }),
      /request failed/
    );
    assert.throws(() => tenants.current(), /authenticated tenant context/);
    await fixture.master.database
      .updateTable("tenant_connections")
      .set({ active: 0 })
      .where("tenant_id", "=", "one")
      .execute();
    await assert.rejects(
      tenants.withPrincipal(fixture.principal("one"), undefined, async () => {}),
      /No active tenant/
    );
  } finally {
    await fixture.close();
  }
});

test("mapping changes retire a connection after its active request completes", async () => {
  const fixture = await TenantFixture.open();
  const tenants = fixture.provider();
  let release!: () => void;
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    const old = tenants.withPrincipal(fixture.principal("one"), undefined, async () => {
      started();
      await hold;
      assert.equal(
        (
          await tenants
            .current()
            .database.selectFrom("application_metadata")
            .selectAll()
            .where("key", "=", "owner")
            .executeTakeFirstOrThrow()
        ).value,
        "one"
      );
    });
    await ready;
    await fixture.master.database
      .updateTable("tenant_connections")
      .set({ version: 2, sqlite_path: join(fixture.root, "two.sqlite") })
      .where("tenant_id", "=", "one")
      .execute();
    await tenants.withPrincipal(fixture.principal("one"), undefined, async () => {
      assert.equal(
        (
          await tenants
            .current()
            .database.selectFrom("application_metadata")
            .selectAll()
            .where("key", "=", "owner")
            .executeTakeFirstOrThrow()
        ).value,
        "two"
      );
    });
    release();
    await old;
    assert.equal(fixture.master.poolStats().pools, 1);
  } finally {
    release();
    await fixture.close();
  }
});

test("independent tenant providers cannot borrow another provider's context", async () => {
  const fixture = await TenantFixture.open();
  const first = fixture.provider();
  const second = fixture.provider();
  try {
    await first.withPrincipal(fixture.principal("one"), undefined, async () => {
      assert.throws(() => second.current(), /authenticated tenant context/);
    });
  } finally {
    await fixture.close();
  }
});

test("inactive identity tenants are denied through the public organization directory", async () => {
  const fixture = await TenantFixture.open();
  const tenants = fixture.provider();
  try {
    await fixture.master.database.updateTable("identity_tenants").set({ active: 0 }).where("id", "=", "one").execute();
    await assert.rejects(tenants.withPrincipal(fixture.principal("one"), undefined, async () => undefined), /No active tenant database/);
    assert.equal(fixture.master.poolStats().leased, 0);
  } finally { await fixture.close(); }
});
