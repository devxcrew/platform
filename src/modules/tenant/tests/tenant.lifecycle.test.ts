import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDatabaseProvider, storageMigrations, HttpError } from "@devxcrew/framework";
import { identityMigration, IdentityError } from "../../identity/index.js";
import {
  tenantConnectionsMigration,
  createLegacyTenantConnectionsMigration,
  createTenantConnectionsMigration,
  provisionTenant,
  createTenantProvider,
  type TenantMasterSchema
} from "../index.js";
import type { IncomingMessage } from "node:http";

test("shared tenant provisioning creates separate storage and preserves mapping revisions on rerun", async () => {
  const root = await mkdtemp(join(tmpdir(), "tenant-provision-"));
  const environment = {
    DB_DRIVER: "sqlite",
    DB_SQLITE_PATH: join(root, "master.sqlite"),
    IDENTITY_TENANT_ID: "initial"
  };
  const database = createDatabaseProvider<TenantMasterSchema>(environment, {
    migrations: {
      ...storageMigrations,
      "003_identity": identityMigration,
      "004_tenant": tenantConnectionsMigration
    }
  });
  try {
    await database.migrate();
    await database.database
      .insertInto("identity_tenants")
      .values({ id: "initial", name: "Initial", active: 1 })
      .execute();
    assert.deepEqual(await provisionTenant(database, environment), {
      tenantId: "initial",
      status: "provisioned"
    });
    const first = await database.database
      .selectFrom("tenant_connections")
      .selectAll()
      .executeTakeFirstOrThrow();
    assert.notEqual(first.sqlite_path, environment.DB_SQLITE_PATH);
    assert.ok(first.sqlite_path!.startsWith(root));
    await database.database.updateTable("tenant_connections").set({ version: 3 }).execute();
    assert.deepEqual(await provisionTenant(database, environment), {
      tenantId: "initial",
      status: "existing"
    });
    assert.equal(
      Number(
        (
          await database.database
            .selectFrom("tenant_connections")
            .selectAll()
            .executeTakeFirstOrThrow()
        ).version
      ),
      3
    );
  } finally {
    await database.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("generic legacy migration preserves mapping data without app-specific table names", async () => {
  const root = await mkdtemp(join(tmpdir(), "tenant-upgrade-"));
  const environment = { DB_DRIVER: "sqlite", DB_SQLITE_PATH: join(root, "master.sqlite") };
  let database = createDatabaseProvider<TenantMasterSchema>(environment, {
    migrations: {
      ...storageMigrations,
      "003_identity": identityMigration,
      "004_tenant": createLegacyTenantConnectionsMigration("previous_connections")
    }
  });
  try {
    await database.migrate();
    await database.database
      .insertInto("identity_tenants")
      .values({ id: "initial", name: "Initial", active: 1 })
      .execute();
    const { sql } = await import("kysely");
    await sql`INSERT INTO previous_connections(tenant_id,driver,sqlite_path,active,version) VALUES('initial','sqlite','private.sqlite',1,7)`.execute(
      database.database
    );
    await database.close();
    database = createDatabaseProvider<TenantMasterSchema>(environment, {
      migrations: {
        ...storageMigrations,
        "003_identity": identityMigration,
        "004_tenant": createLegacyTenantConnectionsMigration("previous_connections"),
        "005_tenant_rename": createTenantConnectionsMigration("previous_connections")
      }
    });
    await database.migrate();
    const mapping = await database.database
      .selectFrom("tenant_connections")
      .selectAll()
      .executeTakeFirstOrThrow();
    assert.equal(mapping.tenant_id, "initial");
    assert.equal(Number(mapping.version), 7);
    assert.deepEqual(await database.migrate(), []);
  } finally {
    await database.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("tenant transport preserves public identity authentication errors", async () => {
  const root = await mkdtemp(join(tmpdir(), "tenant-transport-"));
  const database = createDatabaseProvider<TenantMasterSchema>({
    DB_DRIVER: "sqlite",
    DB_SQLITE_PATH: join(root, "master.sqlite")
  });
  try {
    const tenant = createTenantProvider(
      database,
      {
        authenticateRequest: async () => {
          throw new IdentityError(401, "session_required", "Sign in first.");
        }
      },
      { IDENTITY_MODE: "multi-tenant" }
    );
    await assert.rejects(
      tenant.runRequest({ headers: {} } as IncomingMessage, async () => undefined),
      (error) => error instanceof HttpError && error.status === 401
    );
  } finally {
    await database.close();
    await rm(root, { recursive: true, force: true });
  }
});
