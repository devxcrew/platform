import type { Migration } from "kysely/migration";

export const identityAdministrationMigration: Migration = {
  async up(db) {
    for (const table of ["identity_users", "identity_tenants", "identity_roles"])
      await db.schema
        .alterTable(table)
        .addColumn("version", "integer", (c) => c.notNull().defaultTo(0))
        .execute();
    await db.schema
      .createTable("identity_app_settings")
      .addColumn("app_id", "text", (c) => c.primaryKey())
      .addColumn("display_name", "text", (c) => c.notNull())
      .addColumn("locale", "text", (c) => c.notNull().defaultTo("en"))
      .addColumn("time_zone", "text", (c) => c.notNull().defaultTo("UTC"))
      .addColumn("session_seconds", "integer", (c) => c.notNull().defaultTo(28800))
      .execute();
    await db.schema
      .alterTable("identity_app_settings")
      .addColumn("version", "integer", (c) => c.notNull().defaultTo(0))
      .execute();
    await db.schema
      .createTable("identity_tokens")
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("token_hash", "text", (c) => c.notNull().unique())
      .addColumn("app_id", "text", (c) => c.notNull())
      .addColumn("tenant_id", "text", (c) => c.notNull().references("identity_tenants.id"))
      .addColumn("kind", "text", (c) => c.notNull())
      .addColumn("email", "text", (c) => c.notNull())
      .addColumn("name", "text", (c) => c.notNull())
      .addColumn("role_id", "text", (c) => c.notNull().references("identity_roles.id"))
      .addColumn("user_id", "text")
      .addColumn("expires_at", "text", (c) => c.notNull())
      .addColumn("consumed_at", "text")
      .addColumn("delivered", "integer", (c) => c.notNull().defaultTo(0))
      .execute();
    await db.schema
      .createTable("identity_settings")
      .addColumn("tenant_id", "text", (c) =>
        c.primaryKey().references("identity_tenants.id").onDelete("cascade")
      )
      .addColumn("display_name", "text", (c) => c.notNull())
      .addColumn("locale", "text", (c) => c.notNull().defaultTo("en"))
      .addColumn("time_zone", "text", (c) => c.notNull().defaultTo("UTC"))
      .addColumn("version", "integer", (c) => c.notNull().defaultTo(0))
      .execute();
    await db.schema
      .createTable("identity_audit_events")
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("app_id", "text", (c) => c.notNull())
      .addColumn("actor_id", "text", (c) => c.notNull())
      .addColumn("tenant_id", "text", (c) => c.notNull())
      .addColumn("action", "text", (c) => c.notNull())
      .addColumn("resource_id", "text", (c) => c.notNull())
      .addColumn("created_at", "text", (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex("identity_audit_scope")
      .on("identity_audit_events")
      .columns(["app_id", "tenant_id", "created_at"])
      .execute();
  },
  async down(db) {
    for (const table of ["identity_users", "identity_tenants", "identity_roles"])
      await db.schema.alterTable(table).dropColumn("version").execute();
    await db.schema.dropTable("identity_app_settings").execute();
    await db.schema.dropTable("identity_tokens").execute();
    await db.schema.dropTable("identity_audit_events").execute();
    await db.schema.dropTable("identity_settings").execute();
  }
};
