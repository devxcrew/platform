import { createIdentityTenantDirectory } from "../identity/index.js";
import { TenantRepository } from "./tenant.repository.js";
import { sql } from "kysely";
import { tenantMappingSchema } from "./tenant.schema.js";
import type { TenantDatabase } from "./tenant.types.js";
export async function verifyTenantReadiness(database: TenantDatabase) {
  const directory = createIdentityTenantDirectory(database.database);
  const repository = new TenantRepository(database.database);
  let cursor = "";
  let checked = 0;
  let unmapped = 0;
  while (true) {
    const tenants = await directory.listActive(cursor, 50);
    if (!tenants.length) break;
    for (const tenant of tenants) {
      cursor = tenant.id;
      const row = await repository.find(tenant.id);
      if (!row) {
        unmapped++;
        continue;
      }
      if (Number(row.active) !== 1) continue;
      const parsed = tenantMappingSchema.safeParse({
        ...row,
        active: Number(row.active),
        version: Number(row.version)
      });
      if (!parsed.success) throw new Error("An active tenant mapping is invalid.");
      const mapping = parsed.data;
      await database.withConnection(
        {
          key: mapping.tenantId,
          driver: mapping.driver,
          databaseName: mapping.databaseName,
          sqlitePath: mapping.sqlitePath,
          version: mapping.version
        },
        async (connection) => {
          await sql`SELECT 1`.execute(connection);
        }
      );
      checked++;
    }
  }
  return { checked, unmapped, status: unmapped ? "partial" : "ready" } as const;
}
