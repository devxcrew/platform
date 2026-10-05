import type { Kysely, Transaction } from "kysely";
import type { IdentitySchema, Portal } from "../identity.types.js";
import {
  filterDeclaredPermissions,
  registerIdentityPermissions,
  validateDeclaredPermissions,
  type IdentityPermissionDeclaration
} from "./permission.declarations.js";

export interface IdentityPermissionProvider {
  register(
    appId: string,
    declaration: IdentityPermissionDeclaration
  ): ReturnType<typeof registerIdentityPermissions>;
  validateDeclared(
    database: Kysely<IdentitySchema> | Transaction<IdentitySchema>,
    appId: string,
    portal: Portal,
    ids: string[]
  ): ReturnType<typeof validateDeclaredPermissions>;
  filterDeclared(
    database: Kysely<IdentitySchema>,
    appId: string,
    portal: Portal,
    ids: string[]
  ): ReturnType<typeof filterDeclaredPermissions>;
}

export function createIdentityPermissionProvider(
  database: Kysely<IdentitySchema>
): IdentityPermissionProvider {
  const provider: IdentityPermissionProvider = {
    register: (appId, declaration) => registerIdentityPermissions(database, appId, declaration),
    validateDeclared: (db, appId, portal, ids) =>
      validateDeclaredPermissions(db, appId, portal, ids),
    filterDeclared: (db, appId, portal, ids) => filterDeclaredPermissions(db, appId, portal, ids)
  };
  return Object.freeze(provider);
}
