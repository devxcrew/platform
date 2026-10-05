import type { Migration } from "kysely/migration";
export const identityRolesMigration: Migration = {
  async up(db) {
    await db.schema
      .createTable("identity_custom_roles")
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("app_id", "text", (c) => c.notNull())
      .addColumn("tenant_id", "text", (c) => c.notNull().references("identity_tenants.id"))
      .addColumn("name", "text", (c) => c.notNull())
      .addColumn("active", "integer", (c) => c.notNull().defaultTo(1))
      .addColumn("version", "integer", (c) => c.notNull().defaultTo(0))
      .addUniqueConstraint("identity_custom_role_name", ["app_id", "tenant_id", "name"])
      .execute();
    await db.schema
      .createTable("identity_custom_role_permissions")
      .addColumn("role_id", "text", (c) =>
        c.notNull().references("identity_custom_roles.id").onDelete("cascade")
      )
      .addColumn("permission_id", "text", (c) => c.notNull().references("identity_permissions.id"))
      .addPrimaryKeyConstraint("identity_custom_role_permission_pk", ["role_id", "permission_id"])
      .execute();
    await db.schema
      .alterTable("identity_memberships")
      .addColumn("custom_role_id", "text", (c) => c.references("identity_custom_roles.id"))
      .execute();
    await db.schema
      .alterTable("identity_memberships")
      .addColumn("active", "integer", (c) => c.notNull().defaultTo(1))
      .execute();
    await db.schema
      .alterTable("identity_memberships")
      .addColumn("version", "integer", (c) => c.notNull().defaultTo(0))
      .execute();
  },
  async down(db) {
    const customRole = await db
      .selectFrom("identity_custom_roles")
      .select("id")
      .limit(1)
      .executeTakeFirst();
    const restrictedMembership = await db
      .selectFrom("identity_memberships")
      .select("user_id")
      .where((eb) => eb.or([eb("custom_role_id", "is not", null), eb("active", "!=", 1)]))
      .limit(1)
      .executeTakeFirst();
    if (customRole || restrictedMembership)
      throw new Error(
        "Role rollback would remove access restrictions. Restore a compatible database snapshot instead."
      );
    for (const column of ["custom_role_id", "active", "version"])
      await db.schema.alterTable("identity_memberships").dropColumn(column).execute();
    await db.schema.dropTable("identity_custom_role_permissions").execute();
    await db.schema.dropTable("identity_custom_roles").execute();
  }
};
