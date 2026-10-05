import type { Kysely, Transaction } from "kysely";
import type { IdentityMutation, IdentitySchema, Principal } from "../identity.types.js";
import type { IdentityPermissionProvider } from "../permission/index.js";
import { createIdentityRolePermissionProvider } from "../role-permission/index.js";
import { IdentityRolesService } from "./role.service.js";
import { verifyRoleSchema } from "./role.repository.js";

export type IdentityRoleProvider = Pick<
  IdentityRolesService,
  "list" | "show" | "resolve" | "create" | "update" | "updateSystemPermissions"
> & { verify(): Promise<void> };

export function createIdentityRoleProvider(
  database: Kysely<IdentitySchema>,
  permissions: IdentityPermissionProvider,
  mutate: IdentityMutation,
  recordAudit: (
    trx: Transaction<IdentitySchema>,
    actor: Principal,
    tenantId: string,
    action: string,
    id: string
  ) => Promise<void>,
  revokeRoleSessions: (
    trx: Transaction<IdentitySchema>,
    appId: string,
    tenantId: string,
    roleId: string
  ) => Promise<void>
): IdentityRoleProvider {
  const rolePermissions = createIdentityRolePermissionProvider(database, permissions);
  const service = new IdentityRolesService(
    database,
    rolePermissions,
    mutate,
    recordAudit,
    revokeRoleSessions
  );
  return Object.freeze({
    async verify() {
      await verifyRoleSchema(database);
      await rolePermissions.verify();
    },
    list: service.list.bind(service),
    show: service.show.bind(service),
    resolve: service.resolve.bind(service),
    create: service.create.bind(service),
    update: service.update.bind(service),
    updateSystemPermissions: service.updateSystemPermissions.bind(service)
  });
}
