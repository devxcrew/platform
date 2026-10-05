import type { Migration } from "kysely/migration";
/** Compatibility names come from the consuming app's migration composition. */
export function createLegacyTenantConnectionsMigration(tableName: string): Migration {
  assertTableName(tableName);
  return {
    async up(database) {
      await database.schema
        .createTable(tableName)
        .addColumn("tenant_id", "text", (column) =>
          column.primaryKey().references("identity_tenants.id").onDelete("cascade")
        )
        .addColumn("driver", "text", (column) => column.notNull())
        .addColumn("database_name", "text")
        .addColumn("sqlite_path", "text")
        .addColumn("active", "integer", (column) => column.notNull().defaultTo(1))
        .addColumn("version", "integer", (column) => column.notNull().defaultTo(1))
        .execute();
    },
    async down(database) {
      await database.schema.dropTable(tableName).ifExists().execute();
    }
  };
}
export function createTenantConnectionsMigration(previousTable?: string): Migration {
  if (!previousTable) return createLegacyTenantConnectionsMigration("tenant_connections");
  assertTableName(previousTable);
  if (previousTable === "tenant_connections")
    throw new Error("The previous mapping table must differ.");
  return {
    async up(database) {
      const tables = new Set((await database.introspection.getTables()).map((table) => table.name));
      if (tables.has(previousTable) && tables.has("tenant_connections"))
        throw new Error("Tenant mapping tables require reconciliation.");
      if (tables.has(previousTable))
        await database.schema.alterTable(previousTable).renameTo("tenant_connections").execute();
      else if (!tables.has("tenant_connections"))
        throw new Error("The previous tenant migration is missing.");
    },
    async down() {
      throw new Error("Tenant mapping rename requires an explicit recovery plan.");
    }
  };
}
export const tenantConnectionsMigration = createTenantConnectionsMigration();
function assertTableName(name: string) {
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(name)) throw new Error("Invalid migration table name.");
}
