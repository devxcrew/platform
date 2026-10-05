import type { Kysely } from "kysely";
import type { IdentitySchema, Principal } from "../identity.types.js";
import type { IdentityRoleResolver } from "../role/index.js";
import type { IdentityMutation } from "../identity.types.js";
import { IdentityUserRoleService } from "./user-role.service.js";

export type IdentityUserRoleProvider = Pick<
  IdentityUserRoleService,
  "createMembership" | "updateMembership" | "removeMembership" | "assignInitialMembership"
>;

export function createIdentityUserRoleProvider(
  database: Kysely<IdentitySchema>,
  resolveRole: IdentityRoleResolver,
  mutate: IdentityMutation,
  assertUserVisible: (actor: Principal, userId: string) => Promise<unknown>
): IdentityUserRoleProvider {
  const service = new IdentityUserRoleService(database, resolveRole, mutate, assertUserVisible);
  return Object.freeze({
    createMembership: service.createMembership.bind(service),
    updateMembership: service.updateMembership.bind(service),
    removeMembership: service.removeMembership.bind(service),
    assignInitialMembership: service.assignInitialMembership.bind(service)
  });
}
