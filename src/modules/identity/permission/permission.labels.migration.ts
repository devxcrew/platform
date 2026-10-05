import type { Kysely } from "kysely";

// Additive migration. Do not rewrite the previously applied declaration schema.
export const identityPermissionLabelsMigration = {
  async up(db: Kysely<any>) {
    await db.schema
      .alterTable("identity_permission_declarations")
      .addColumn("label", "text")
      .execute();
  },
  async down(db: Kysely<any>) {
    await db.schema.alterTable("identity_permission_declarations").dropColumn("label").execute();
  }
};
