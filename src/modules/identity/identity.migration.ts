import type { Migration } from "kysely/migration";
export const identityMigration: Migration = {
  async up(db) {
    await db.schema
      .createTable("identity_users")
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("email", "text", (c) => c.notNull().unique())
      .addColumn("name", "text", (c) => c.notNull())
      .addColumn("password_hash", "text", (c) => c.notNull())
      .addColumn("active", "integer", (c) => c.notNull().defaultTo(1))
      .execute();
    await db.schema
      .createTable("identity_tenants")
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("name", "text", (c) => c.notNull())
      .addColumn("active", "integer", (c) => c.notNull().defaultTo(1))
      .execute();
    await db.schema
      .createTable("identity_roles")
      .addColumn("id", "text", (c) => c.primaryKey())
      .execute();
    await db.schema
      .createTable("identity_permissions")
      .addColumn("id", "text", (c) => c.primaryKey())
      .execute();
    await db.schema
      .createTable("identity_role_permissions")
      .addColumn("role_id", "text", (c) =>
        c.notNull().references("identity_roles.id"),
      )
      .addColumn("permission_id", "text", (c) =>
        c.notNull().references("identity_permissions.id"),
      )
      .addPrimaryKeyConstraint("identity_role_permission_pk", [
        "role_id",
        "permission_id",
      ])
      .execute();
    await db.schema
      .createTable("identity_memberships")
      .addColumn("user_id", "text", (c) =>
        c.notNull().references("identity_users.id").onDelete("cascade"),
      )
      .addColumn("tenant_id", "text", (c) =>
        c.notNull().references("identity_tenants.id").onDelete("cascade"),
      )
      .addColumn("role_id", "text", (c) =>
        c.notNull().references("identity_roles.id"),
      )
      .addPrimaryKeyConstraint("identity_membership_pk", [
        "user_id",
        "tenant_id",
        "role_id",
      ])
      .execute();
    await db.schema
      .createTable("identity_sessions")
      .addColumn("token_hash", "text", (c) => c.primaryKey())
      .addColumn("user_id", "text", (c) =>
        c.notNull().references("identity_users.id").onDelete("cascade"),
      )
      .addColumn("tenant_id", "text", (c) =>
        c.notNull().references("identity_tenants.id").onDelete("cascade"),
      )
      .addColumn("app_id", "text", (c) => c.notNull())
      .addColumn("portal", "text", (c) => c.notNull())
      .addColumn("expires_at", "text", (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex("identity_sessions_expiry")
      .on("identity_sessions")
      .column("expires_at")
      .execute();
    await db.schema
      .createTable("identity_throttles")
      .addColumn("key", "text", (c) => c.primaryKey())
      .addColumn("attempts", "integer", (c) => c.notNull())
      .addColumn("expires_at", "text", (c) => c.notNull())
      .execute();
  },
  async down(db) {
    for (const table of [
      "identity_throttles",
      "identity_sessions",
      "identity_memberships",
      "identity_role_permissions",
      "identity_permissions",
      "identity_roles",
      "identity_tenants",
      "identity_users",
    ])
      await db.schema.dropTable(table).execute();
  },
};
