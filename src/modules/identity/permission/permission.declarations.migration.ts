import type { Kysely } from "kysely";

export const identityPermissionDeclarationsMigration = {
  async up(db: Kysely<any>) {
    await db.schema
      .createTable("identity_permission_declarations")
      .addColumn("permission_id", "text", (column) =>
        column.primaryKey().references("identity_permissions.id")
      )
      .addColumn("app_id", "text", (column) => column.notNull())
      .addColumn("owner", "text", (column) => column.notNull())
      .addColumn("portals", "text", (column) => column.notNull())
      .execute();
  },
  async down(db: Kysely<any>) {
    const declared = await db
      .selectFrom("identity_permission_declarations")
      .select("permission_id")
      .executeTakeFirst();
    if (declared)
      throw new Error(
        "Restore a compatible snapshot before removing permission ownership restrictions."
      );
    await db.schema.dropTable("identity_permission_declarations").execute();
  }
};
