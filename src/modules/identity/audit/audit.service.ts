import type { Kysely, Transaction } from "kysely";
import type { IdentityMutation, IdentitySchema, Principal } from "../identity.types.js";
import { checkIdentityRequest } from "../support/identity.request-context.js";
import { IdentityAuditRepository } from "./audit.repository.js";
import { IdentityError } from "../support/identity.error.js";
import type { IdentityListQuery } from "../support/pagination.schema.js";

export class IdentityAuditService {
  constructor(
    private readonly db: Kysely<IdentitySchema>,
    private readonly repository: IdentityAuditRepository,
    private readonly userTenants: (
      trx: Transaction<IdentitySchema>,
      userId: string
    ) => Promise<string[]>,
    private readonly tenantIds: (trx: Transaction<IdentitySchema>) => Promise<string[]>
  ) {}

  list(actor: Principal, query: IdentityListQuery) {
    this.allow(actor);
    return this.repository.list(actor, query);
  }
  show(actor: Principal, id: string) {
    this.allow(actor);
    return this.repository.show(actor, id);
  }

  private allow(actor: Principal) {
    if (actor.portal === "user" || !actor.permissions.includes("identity.manage"))
      throw new IdentityError(403, "Access denied.");
  }

  readonly mutate: IdentityMutation = async <T>(
    actor: Principal,
    resource: string,
    id: string,
    action: (trx: Transaction<IdentitySchema>, id: string) => Promise<T>,
    affectedTenant?: string
  ) =>
    this.db.transaction().execute(async (trx) => {
      checkIdentityRequest();
      const result = await action(trx, id);
      checkIdentityRequest();
      const targetTenant =
        affectedTenant ??
        (resource === "organizations"
          ? id
          : resource === "memberships"
            ? id.split("~")[1]
            : actor.tenant.id);
      let targets = [targetTenant];
      if (!affectedTenant && ["users", "profile"].includes(resource))
        targets = await this.userTenants(trx, id);
      if (["roles", "application-settings", "security-settings"].includes(resource))
        targets = await this.tenantIds(trx);
      for (const tenant of new Set(targets))
        await this.repository.record(trx, actor, tenant, `identity.${resource}.changed`, id);
      checkIdentityRequest();
      return result;
    });
}
