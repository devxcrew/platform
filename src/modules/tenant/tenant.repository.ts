import type { Kysely } from "kysely";
import type { TenantMasterSchema } from "./tenant.types.js";
export class TenantRepository {
  constructor(private readonly database: Kysely<TenantMasterSchema>) {}
  async find(id: string) {
    return this.database
      .selectFrom("tenant_connections as connection")
      .select([
        "connection.tenant_id as tenantId",
        "connection.driver",
        "connection.database_name as databaseName",
        "connection.sqlite_path as sqlitePath",
        "connection.active",
        "connection.version"
      ])
      .where("connection.tenant_id", "=", id)
      .executeTakeFirst();
  }
  async verify() {
    await this.database.selectFrom("tenant_connections").select("tenant_id").limit(1).execute();
  }
}
