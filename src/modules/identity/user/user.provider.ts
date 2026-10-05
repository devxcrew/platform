import type { Kysely, RawBuilder, Transaction } from "kysely";
import type { IdentityConfig, IdentityProviderOptions, IdentitySchema } from "../identity.types.js";
import type { IdentityPermissionProvider } from "../permission/index.js";
import { IdentityUserRepository } from "./user.repository.js";
import { IdentityService } from "./user.service.js";
import { IdentityLifecycleService } from "./user.lifecycle.service.js";
import { IdentityUserAdministrationService } from "./user.administration.service.js";
import type { IdentityRoleResolver } from "../role/index.js";
import type { IdentityMutation } from "../identity.types.js";
import type { IdentityUserRoleProvider } from "../user-role/index.js";
import type { Portal } from "../identity.types.js";

export interface IdentityUserOwnership {
  activeOrganization(db: Kysely<IdentitySchema>, id: string): Promise<unknown>;
  assignInvitedMembership(
    trx: Transaction<IdentitySchema>,
    userId: string,
    tenantId: string,
    portal: Portal
  ): Promise<void>;
  revokeUserSessions(trx: Transaction<IdentitySchema>, userId: string): Promise<void>;
  recordEvent(
    db: Kysely<IdentitySchema>,
    input: { appId: string; actorId: string; tenantId: string; action: string; resourceId: string }
  ): Promise<void>;
  sessionSeconds(appId: string, fallback: number): Promise<number>;
  activeSession(
    tokenHash: string,
    appId: string,
    portal: Portal,
    now: string
  ): Promise<IdentitySchema["identity_sessions"] | undefined>;
  createSession(
    session: IdentitySchema["identity_sessions"],
    previous: string | undefined,
    eligible: (trx: Transaction<IdentitySchema>) => Promise<boolean>
  ): Promise<boolean>;
  revokeSession(tokenHash: string, appId: string, portal: Portal): Promise<void>;
  throttle(key: string): Promise<number>;
  clearThrottle(key: string): Promise<void>;
  activeMembership(
    db: Kysely<IdentitySchema>,
    userId: string,
    tenantId: string,
    portal: Portal
  ): Promise<{ custom_role_id: string | null } | undefined>;
  activeOrganizationDetail(
    db: Kysely<IdentitySchema>,
    id: string
  ): Promise<{ id: string; name: string } | undefined>;
  permissionIds(
    db: Kysely<IdentitySchema>,
    portal: Portal,
    customRoleId: string | null,
    appId: string,
    tenantId: string
  ): Promise<string[] | null>;
}

export function createIdentityUserProvider(
  database: Kysely<IdentitySchema>,
  config: IdentityConfig,
  permissions: IdentityPermissionProvider,
  ownership: IdentityUserOwnership,
  options: IdentityProviderOptions = {}
) {
  const repository = new IdentityUserRepository(database, permissions, ownership);
  return Object.freeze({
    verify: repository.verifySchema.bind(repository),
    identity: new IdentityService(repository, config),
    lifecycle: new IdentityLifecycleService(
      database,
      config,
      options.delivery,
      permissions,
      ownership
    )
  });
}
export type IdentityUserProvider = ReturnType<typeof createIdentityUserProvider>;

export function createIdentityUserAdministrationProvider(
  database: Kysely<IdentitySchema>,
  visibility: (
    actor: import("../identity.types.js").Principal,
    userId: RawBuilder<unknown>
  ) => RawBuilder<unknown>,
  resolveRole: IdentityRoleResolver,
  userRoles: IdentityUserRoleProvider,
  mutate: IdentityMutation,
  activeOrganization: (trx: Transaction<IdentitySchema>, id: string) => Promise<unknown>,
  revokeUserSessions: (trx: Transaction<IdentitySchema>, userId: string) => Promise<void>
) {
  const service = new IdentityUserAdministrationService(
    database,
    visibility,
    resolveRole,
    userRoles.assignInitialMembership,
    mutate,
    activeOrganization,
    userRoles.isManageableUser,
    userRoles.protectAdministrators,
    revokeUserSessions
  );
  return Object.freeze({
    list: service.list.bind(service),
    show: service.show.bind(service),
    create: service.create.bind(service),
    update: service.update.bind(service),
    profile: service.profile.bind(service)
  });
}
