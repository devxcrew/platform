import type { Kysely, Transaction } from "kysely";
import type { IdentitySchema } from "../identity.types.js";
import { IdentityAuditRepository } from "./audit.repository.js";
import { IdentityAuditService } from "./audit.service.js";

export function createIdentityAuditProvider(
  database: Kysely<IdentitySchema>,
  userTenants: (trx: Transaction<IdentitySchema>, userId: string) => Promise<string[]>,
  tenantIds: (trx: Transaction<IdentitySchema>) => Promise<string[]>
) {
  const repository = new IdentityAuditRepository(database);
  const service = new IdentityAuditService(database, repository, userTenants, tenantIds);
  return Object.freeze({
    verify: repository.verifySchema.bind(repository),
    list: service.list.bind(service),
    show: service.show.bind(service),
    mutate: service.mutate,
    record: repository.record.bind(repository)
  });
}
