import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { HttpError, readDatabaseConfiguration } from "@devxcrew/framework";
import type { TenantDatabase } from "./tenant.types.js";
import type { ConnectionTarget } from "@devxcrew/framework";
import { createIdentityTenantDirectory } from "../identity/index.js";

export async function provisionTenant(
  database: TenantDatabase & { provisionConnection(target: ConnectionTarget): Promise<unknown> },
  environment: NodeJS.ProcessEnv
) {
  const id = environment.IDENTITY_TENANT_ID ?? "default";
  const tenant = await createIdentityTenantDirectory(database.database).active(id);
  if (!tenant)
    throw new HttpError(422, "tenant_missing", "Seed an active tenant before provisioning.");
  const existing = await database.database
    .selectFrom("tenant_connections")
    .selectAll()
    .where("tenant_id", "=", id)
    .executeTakeFirst();
  if (existing) return { tenantId: id, status: "existing" };
  const fingerprint = createHash("sha256").update(id).digest("hex").slice(0, 16);
  const { driver } = readDatabaseConfiguration(environment);
  const databaseName =
    driver === "mariadb"
      ? `${(environment.DB_MASTER_NAME ?? "master").slice(0, 30)}_tenant_${fingerprint}`
      : null;
  const sqlitePath =
    driver === "sqlite"
      ? join(
          dirname(resolve(environment.DB_SQLITE_PATH ?? "storage/private/data/identity.sqlite")),
          `tenant-${fingerprint}.sqlite`
        )
      : null;
  const target: ConnectionTarget = { key: id, driver, databaseName, sqlitePath, version: 1 };
  await database.provisionConnection(target);
  // Register only after storage migrations succeed. Reruns preserve the existing mapping.
  await database.database
    .insertInto("tenant_connections")
    .values({
      tenant_id: id,
      driver,
      database_name: databaseName,
      sqlite_path: sqlitePath,
      active: 1
    })
    .onConflict((conflict) => conflict.column("tenant_id").doNothing())
    .execute();
  return { tenantId: id, status: "provisioned" };
}
