import type { Kysely, Transaction } from "kysely";
import type { IdentitySchema, Portal, Principal } from "../identity.types.js";
import type { IdentityRoleResolver } from "../role/index.js";
import type { IdentityMutation } from "../identity.types.js";
import { IdentityUserRoleService } from "./user-role.service.js";
import {
  customRoleUserIds,
  membershipTenantIds,
  verifyMembershipSchema
} from "./user-role.repository.js";

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
};

export function createIdentityUserRoleProvider(
  database: Kysely<IdentitySchema>,
  resolveRole: IdentityRoleResolver,
  mutate: IdentityMutation,
  assertUserVisible: (actor: Principal, userId: string) => Promise<unknown>,
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
    resolveRole,
    mutate,
    assertUserVisible,
    recordAudit,
    revokeMembershipSessions
  );
  return Object.freeze({
    verify: () => verifyMembershipSchema(database),
    tenantIdsForUser: membershipTenantIds,
    userIdsForCustomRole: customRoleUserIds,
    list: service.list.bind(service),
    show: service.show.bind(service),
    createMembership: service.createMembership.bind(service),
    updateMembership: service.updateMembership.bind(service),
    removeMembership: service.removeMembership.bind(service),
    assignInitialMembership: service.assignInitialMembership.bind(service)
  });
}
