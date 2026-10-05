import { IdentityError } from "../identity.error.js";
import type { IdentitySchema } from "../identity.types.js";
import type { IdentityPermissionProvider } from "../permission/index.js";
import type { Transaction } from "kysely";

export interface IdentityRolePermissionProvider {
  validate(trx: Transaction<IdentitySchema>, ids: string[], appId: string): Promise<void>;
  replace(trx: Transaction<IdentitySchema>, roleId: string, permissions: string[]): Promise<void>;
  replaceSystem(
    trx: Transaction<IdentitySchema>,
    roleId: string,
    appId: string,
    permissions: string[]
  ): Promise<void>;
}

export function createIdentityRolePermissionProvider(
  permissions: IdentityPermissionProvider
): IdentityRolePermissionProvider {
  return {
    async validate(trx, ids, appId) {
      await permissions.validateDeclared(trx, appId, "user", ids);
      if (!ids.includes("desk.user"))
        throw new IdentityError(422, "Keep the user desk permission.");
      if (
        ids.some((id) => id === "identity.manage" || (id.startsWith("desk.") && id !== "desk.user"))
      )
        throw new IdentityError(403, "Custom user roles cannot grant administration access.");
      const known = await trx.selectFrom("identity_permissions").select("id").execute();
      if (ids.some((id) => !known.some((row) => row.id === id)))
        throw new IdentityError(422, "Unknown permission.");
    },
    async replace(trx, roleId, ids) {
      await trx
        .deleteFrom("identity_custom_role_permissions")
        .where("role_id", "=", roleId)
        .execute();
      for (const permission of new Set(ids))
        await trx
          .insertInto("identity_custom_role_permissions")
          .values({ role_id: roleId, permission_id: permission })
          .execute();
    },
    async replaceSystem(trx, roleId, appId, ids) {
      const portal = roleId as "user" | "admin" | "super-admin";
      if (!ids.includes(`desk.${portal}`) || !ids.includes("identity.password"))
        throw new IdentityError(409, "Keep required portal and password permissions.");
      if (portal !== "user" && !ids.includes("identity.manage"))
        throw new IdentityError(409, "Keep administration permission on administrator roles.");
      await permissions.validateDeclared(trx, appId, portal, ids);
      const known = await trx.selectFrom("identity_permissions").select("id").execute();
      if (ids.some((id) => !known.some((row) => row.id === id)))
        throw new IdentityError(422, "Unknown permission.");
      if (portal === "user" && ids.some((id) => id.startsWith("identity.manage")))
        throw new IdentityError(403, "User roles cannot receive administration permissions.");
      await trx.deleteFrom("identity_role_permissions").where("role_id", "=", portal).execute();
      for (const permission of new Set(ids))
        await trx
          .insertInto("identity_role_permissions")
          .values({ role_id: portal, permission_id: permission })
          .execute();
    }
  };
}
