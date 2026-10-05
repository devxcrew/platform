import type { Transaction } from "kysely";
import { IdentityError } from "../support/identity.error.js";
import type { IdentitySchema } from "../identity.types.js";
import type { IdentityPermissionProvider } from "../permission/index.js";
import { IdentityRolePermissionRepository } from "./role-permission.repository.js";

export class IdentityRolePermissionService {
  constructor(
    private readonly permissions: IdentityPermissionProvider,
    private readonly repository: IdentityRolePermissionRepository
  ) {}

  async validate(trx: Transaction<IdentitySchema>, ids: string[], appId: string) {
    await this.permissions.validateDeclared(trx, appId, "user", ids);
    if (!ids.includes("desk.user")) throw new IdentityError(422, "Keep the user desk permission.");
    if (
      ids.some((id) => id === "identity.manage" || (id.startsWith("desk.") && id !== "desk.user"))
    )
      throw new IdentityError(403, "Custom user roles cannot grant administration access.");
    await this.validateKnown(trx, ids);
  }

  async replace(trx: Transaction<IdentitySchema>, roleId: string, ids: string[]) {
    await this.repository.replaceCustom(trx, roleId, ids);
  }

  async replaceSystem(
    trx: Transaction<IdentitySchema>,
    roleId: string,
    appId: string,
    ids: string[]
  ) {
    const portal = roleId as "user" | "admin" | "super-admin";
    if (!ids.includes(`desk.${portal}`) || !ids.includes("identity.password"))
      throw new IdentityError(409, "Keep required portal and password permissions.");
    if (portal !== "user" && !ids.includes("identity.manage"))
      throw new IdentityError(409, "Keep administration permission on administrator roles.");
    await this.permissions.validateDeclared(trx, appId, portal, ids);
    await this.validateKnown(trx, ids);
    if (portal === "user" && ids.some((id) => id.startsWith("identity.manage")))
      throw new IdentityError(403, "User roles cannot receive administration permissions.");
    await this.repository.replaceSystem(trx, portal, ids);
  }

  private async validateKnown(trx: Transaction<IdentitySchema>, ids: string[]) {
    await this.permissions.validateKnown(trx, ids);
  }
}
