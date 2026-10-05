import type { Kysely, Transaction } from "kysely";
import type { IdentityMutation, IdentitySchema } from "../identity.types.js";
import {
  IdentityOrganizationRepository,
  organizationNameSource
} from "./organization.repository.js";
import { IdentityOrganizationService } from "./organization.service.js";
import { z } from "zod";
import type { IdentityTenantDirectory } from "./organization.types.js";

/** Read-only server contract for modules that depend on active tenant identity. */
export function createIdentityTenantDirectory(
  database: Kysely<IdentitySchema>
): IdentityTenantDirectory {
  const repository = new IdentityOrganizationRepository(database);
  return {
    active(id) {
      z.string().min(1).max(255).parse(id);
      return repository.activeDetail(database, id);
    },
    listActive(after, pageSize) {
      z.string().max(255).parse(after);
      z.number().int().min(1).max(500).parse(pageSize);
      return repository.listActive(after, pageSize);
    }
  };
}

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
