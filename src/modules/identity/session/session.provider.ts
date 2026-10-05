import { IdentitySessionRepository } from "./session.repository.js";
import { IdentitySessionService } from "./session.service.js";
import type { Kysely } from "kysely";
import type { IdentityMutation, IdentitySchema } from "../identity.types.js";

export function createIdentitySessionProvider(
  database: Kysely<IdentitySchema>,
  mutate: IdentityMutation
) {
  const repository = new IdentitySessionRepository(database);
  const service = new IdentitySessionService(repository, mutate);
  return Object.freeze({
    verify: repository.verifySchema.bind(repository),
    list: service.list.bind(service),
    show: service.show.bind(service),
    remove: service.remove.bind(service),
    revokeTenant: repository.revokeTenant.bind(repository),
    revokeApp: repository.revokeApp.bind(repository),
    revokeOne: repository.revokeOne.bind(repository),
    revokeUser: repository.revokeUser.bind(repository),
    revokeMembership: repository.revokeMembership.bind(repository),
    revokeRoleMembers: repository.revokeRoleMembers.bind(repository)
  });
}
