import type { Kysely, Transaction } from "kysely";
import type { IdentitySchema, Portal, Principal } from "../identity.types.js";
import type { IdentityRoleResolver } from "../role/index.js";
import type { IdentityMutation } from "../identity.types.js";
import { IdentityUserRoleService } from "./user-role.service.js";
import {
  customRoleUserIds,
  assertManageableUser,
  assignInvitedMembership,
  activeMembership,
  membershipTenantIds,
  verifyMembershipSchema
} from "./user-role.repository.js";
import { userVisibility, type MembershipReadSources } from "./user-role.repository.js";
import { protectAdministrators } from "./user-role.policy.js";

export type IdentityUserRoleProvider = Pick<
  IdentityUserRoleService,
  | "list"
  | "show"
  | "createMembership"
  | "updateMembership"
  | "removeMembership"
  | "assignInitialMembership"
> & {
  verify(): Promise<void>;
  tenantIdsForUser: typeof membershipTenantIds;
  userIdsForCustomRole: typeof customRoleUserIds;
  isManageableUser: typeof assertManageableUser;
  assignInvitedMembership: typeof assignInvitedMembership;
  activeMembership: typeof activeMembership;
  userVisibility: typeof userVisibility;
  protectAdministrators(trx: Transaction<IdentitySchema>, userId: string): Promise<void>;
};

export function createIdentityUserRoleProvider(
  database: Kysely<IdentitySchema>,
  readSources: MembershipReadSources,
  activeUsers: (db: Kysely<IdentitySchema>, ids: string[]) => Promise<string[]>,
  resolveRole: IdentityRoleResolver,
  customRoleInApp: (db: Kysely<IdentitySchema>, id: string, appId: string) => Promise<unknown>,
  mutate: IdentityMutation,
  assertUserVisible: (actor: Principal, userId: string) => Promise<unknown>,
  activeOrganization: (trx: Transaction<IdentitySchema>, id: string) => Promise<unknown>,
  recordAudit: (
    trx: Transaction<IdentitySchema>,
    actor: Principal,
    tenantId: string,
    action: string,
    id: string
  ) => Promise<void>,
  revokeMembershipSessions: (
    trx: Transaction<IdentitySchema>,
    appId: string,
    userId: string,
    tenantId: string,
    portal: Portal
  ) => Promise<void>
): IdentityUserRoleProvider {
  const service = new IdentityUserRoleService(
    database,
    readSources,
    activeUsers,
    resolveRole,
    customRoleInApp,
    mutate,
    assertUserVisible,
    activeOrganization,
    recordAudit,
    revokeMembershipSessions
  );
  return Object.freeze({
    verify: () => verifyMembershipSchema(database),
    tenantIdsForUser: membershipTenantIds,
    userIdsForCustomRole: customRoleUserIds,
    isManageableUser: assertManageableUser,
    assignInvitedMembership,
    activeMembership,
    userVisibility,
    protectAdministrators: (trx, userId) => protectAdministrators(trx, userId, activeUsers),
    list: service.list.bind(service),
    show: service.show.bind(service),
    createMembership: service.createMembership.bind(service),
    updateMembership: service.updateMembership.bind(service),
    removeMembership: service.removeMembership.bind(service),
    assignInitialMembership: service.assignInitialMembership.bind(service)
  });
}
