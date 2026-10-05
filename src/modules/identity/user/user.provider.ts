import type { Kysely } from "kysely";
import type { IdentityConfig, IdentityProviderOptions, IdentitySchema } from "../identity.types.js";
import type { IdentityPermissionProvider } from "../permission/index.js";
import { IdentityUserRepository } from "./user.repository.js";
import { IdentityService } from "./user.service.js";
import { IdentityLifecycleService } from "./user.lifecycle.service.js";
import { IdentityUserAdministrationService } from "./user.administration.service.js";
import type { IdentityRoleResolver } from "../role/index.js";
import type { IdentityMutation } from "../identity.types.js";
import type { IdentityUserRoleProvider } from "../user-role/index.js";

export function createIdentityUserProvider(
  database: Kysely<IdentitySchema>,
  config: IdentityConfig,
  permissions: IdentityPermissionProvider,
  options: IdentityProviderOptions = {}
) {
  const repository = new IdentityUserRepository(database, permissions);
  return Object.freeze({
    verify: repository.verifySchema.bind(repository),
    identity: new IdentityService(repository, config),
    lifecycle: new IdentityLifecycleService(database, config, options.delivery, permissions)
  });
}
export type IdentityUserProvider = ReturnType<typeof createIdentityUserProvider>;

export function createIdentityUserAdministrationProvider(
  database: Kysely<IdentitySchema>,
  resolveRole: IdentityRoleResolver,
  userRoles: IdentityUserRoleProvider,
  mutate: IdentityMutation
) {
  const service = new IdentityUserAdministrationService(
    database,
    resolveRole,
    userRoles.assignInitialMembership,
    mutate
  );
  return Object.freeze({
    list: service.list.bind(service),
    show: service.show.bind(service),
    create: service.create.bind(service),
    update: service.update.bind(service),
    profile: service.profile.bind(service)
  });
}
