import { backupConnection, checkConnectionBackup } from "@devxcrew/framework";
import { provisionTenant } from "./tenant.seed.js";
import { tenantMappingSchema } from "./tenant.schema.js";
import { TenantRepository } from "./tenant.repository.js";
import { join } from "node:path";
export async function executeTenantCommand(
  database: import("./tenant.types.js").TenantDatabase & {
    provisionConnection(target: import("@devxcrew/framework").ConnectionTarget): Promise<unknown>;
  },
  environment: NodeJS.ProcessEnv,
  command = "provision",
  args: string[] = []
) {
  if (command === "provision") console.info(await provisionTenant(database, environment));
  else if (["backup", "verify-backup", "verify-restore"].includes(command)) {
    const id = environment.IDENTITY_TENANT_ID ?? "default";
    const row = await new TenantRepository(database.database).find(id);
    if (!row) throw new Error("Tenant mapping is missing.");
    const mapping = tenantMappingSchema.parse({
      tenantId: id,
      driver: row.driver,
      databaseName: row.databaseName,
      sqlitePath: row.sqlitePath,
      active: Number(row.active),
      version: Number(row.version)
    });
    const target = {
      key: id,
      driver: mapping.driver,
      databaseName: mapping.databaseName,
      sqlitePath: mapping.sqlitePath,
      version: mapping.version
    };
    const path =
      args[0] ??
      (command === "backup"
        ? join(
            environment.DB_BACKUP_DIR ?? "storage/private/data/backup",
            `tenant-${new Date().toISOString().replace(/[:.]/g, "-")}.${mapping.driver === "mariadb" ? "sql" : "sqlite"}`
          )
        : undefined);
    if (!path) throw new Error("Supply a backup path.");
    if (command === "backup") await backupConnection(environment, target, path);
    else await checkConnectionBackup(environment, target, path, command === "verify-restore");
    console.info(`Tenant ${command} passed: ${path}`);
  } else throw new Error("Unknown tenant command.");
}
