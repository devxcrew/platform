import type { Kysely, Transaction } from "kysely";
import type { IdentitySchema } from "../identity.types.js";
import type { IdentityPermissionProvider } from "../permission/index.js";
import {
  IdentityRolePermissionRepository,
  systemPermissionJson,
  customPermissionJson
} from "./role-permission.repository.js";
import { IdentityRolePermissionService } from "./role-permission.service.js";

export interface IdentityRolePermissionProvider {
  verify(): Promise<void>;
  permissionIds(db: Kysely<IdentitySchema>, roleId: string, custom: boolean): Promise<string[]>;
  systemPermissionJson: typeof systemPermissionJson;
  customPermissionJson: typeof customPermissionJson;
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
  database: Kysely<IdentitySchema>,
  permissions: IdentityPermissionProvider
): IdentityRolePermissionProvider {
  const repository = new IdentityRolePermissionRepository(database);
  const service = new IdentityRolePermissionService(permissions, repository);
  return Object.freeze({
    verify: repository.verifySchema.bind(repository),
    permissionIds: repository.permissionIds.bind(repository),
    systemPermissionJson,
    customPermissionJson,
    validate: service.validate.bind(service),
    replace: service.replace.bind(service),
    replaceSystem: service.replaceSystem.bind(service)
  });
}
