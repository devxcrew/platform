import type { Kysely, Transaction } from "kysely";
import type { IdentityMutation, IdentitySchema } from "../identity.types.js";
import {
  IdentityOrganizationRepository,
  organizationNameSource
} from "./organization.repository.js";
import { IdentityOrganizationService } from "./organization.service.js";

export function createIdentityOrganizationProvider(
  database: Kysely<IdentitySchema>,
  mutate: IdentityMutation,
  revokeTenantSessions: (trx: Transaction<IdentitySchema>, tenantId: string) => Promise<void>
) {
  const repository = new IdentityOrganizationRepository(database);
  const service = new IdentityOrganizationService(repository, mutate, revokeTenantSessions);
  return Object.freeze({
    verify: repository.verifySchema.bind(repository),
    tenantIds: repository.tenantIds.bind(repository),
    active: repository.active.bind(repository),
    activeDetail: repository.activeDetail.bind(repository),
    nameSource: organizationNameSource,
    list: service.list.bind(service),
    show: service.show.bind(service),
    create: service.create.bind(service),
    update: service.update.bind(service)
  });
}
