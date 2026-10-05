import { sql, type Kysely, type RawBuilder, type Transaction } from "kysely";
import type { IdentitySchema } from "../identity.types.js";

export class IdentityRolePermissionRepository {
  constructor(private readonly db: Kysely<IdentitySchema>) {}

  async verifySchema() {
    await this.db
      .selectFrom("identity_role_permissions")
      .select("permission_id")
      .limit(1)
      .execute();
    await this.db
      .selectFrom("identity_custom_role_permissions")
      .select("permission_id")
      .limit(1)
      .execute();
  }
  async permissionIds(db: Kysely<IdentitySchema>, roleId: string, custom: boolean) {
    const table = custom
      ? ("identity_custom_role_permissions" as const)
      : ("identity_role_permissions" as const);
    const rows = await db
      .selectFrom(table)
      .select("permission_id")
      .where("role_id", "=", roleId)
      .execute();
    return rows.map((row) => row.permission_id);
  }
  async replaceCustom(trx: Transaction<IdentitySchema>, roleId: string, ids: string[]) {
    await trx
      .deleteFrom("identity_custom_role_permissions")
      .where("role_id", "=", roleId)
      .execute();
    for (const permission of new Set(ids))
      await trx
        .insertInto("identity_custom_role_permissions")
        .values({ role_id: roleId, permission_id: permission })
        .execute();
  }

  async replaceSystem(trx: Transaction<IdentitySchema>, roleId: string, ids: string[]) {
    await trx.deleteFrom("identity_role_permissions").where("role_id", "=", roleId).execute();
    for (const permission of new Set(ids))
      await trx
        .insertInto("identity_role_permissions")
        .values({ role_id: roleId, permission_id: permission })
        .execute();
  }
}

export const systemPermissionJson = (roleId: RawBuilder<unknown>) =>
  sql`(select json_group_array(permission_id) from identity_role_permissions p where p.role_id=${roleId})`;
export const customPermissionJson = (roleId: RawBuilder<unknown>) =>
  sql`(select json_group_array(permission_id) from identity_custom_role_permissions p where p.role_id=${roleId})`;
