import type { Kysely, Transaction } from "kysely";
import type { IdentitySchema, Portal } from "../identity.types.js";
import { IdentityPermissionRepository } from "./permission.repository.js";
import type { IdentityPermissionDeclaration } from "./permission.schema.js";
import { IdentityPermissionService } from "./permission.service.js";
import type { Principal } from "../identity.types.js";
import type { IdentityListQuery } from "../support/pagination.schema.js";

export interface IdentityPermissionProvider {
  verify(): Promise<void>;
  list(actor: Principal, query: IdentityListQuery): ReturnType<IdentityPermissionService["list"]>;
  show(actor: Principal, id: string): ReturnType<IdentityPermissionService["show"]>;
  register(
    appId: string,
    declaration: IdentityPermissionDeclaration
  ): Promise<{
    owner: string;
    permissionIds: string[];
  }>;
  validateDeclared(
    database: Kysely<IdentitySchema> | Transaction<IdentitySchema>,
    appId: string,
    portal: Portal,
    ids: string[]
  ): Promise<void>;
  validateKnown(database: Transaction<IdentitySchema>, ids: string[]): Promise<void>;
  filterDeclared(
    database: Kysely<IdentitySchema>,
    appId: string,
    portal: Portal,
    ids: string[]
  ): Promise<string[]>;
}

export function createIdentityPermissionProvider(
  database: Kysely<IdentitySchema>
): IdentityPermissionProvider {
  const service = new IdentityPermissionService(new IdentityPermissionRepository(database));
  return Object.freeze({
    verify: service.verify.bind(service),
    list: service.list.bind(service),
    show: service.show.bind(service),
    register: service.register.bind(service),
    validateDeclared: service.validateDeclared.bind(service),
    validateKnown: service.validateKnown.bind(service),
    filterDeclared: service.filterDeclared.bind(service)
  });
}
