import type { Kysely, Transaction } from "kysely";
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
