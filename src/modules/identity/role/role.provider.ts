import type { Kysely } from "kysely";
import type { IdentityMutation, IdentitySchema } from "../identity.types.js";
import type { IdentityPermissionProvider } from "../permission/index.js";
import { createIdentityRolePermissionProvider } from "../role-permission/index.js";
import { IdentityRolesService } from "./role.service.js";

export type IdentityRoleProvider = Pick<
  IdentityRolesService,
  "resolve" | "create" | "update" | "updateSystemPermissions"
>;

export function createIdentityRoleProvider(
  database: Kysely<IdentitySchema>,
  permissions: IdentityPermissionProvider,
  mutate: IdentityMutation
): IdentityRoleProvider {
  const service = new IdentityRolesService(
    database,
    createIdentityRolePermissionProvider(permissions),
    mutate
  );
  return Object.freeze({
    resolve: service.resolve.bind(service),
    create: service.create.bind(service),
    update: service.update.bind(service),
    updateSystemPermissions: service.updateSystemPermissions.bind(service)
  });
}
