import type { Transaction } from "kysely";
import { IdentityError } from "../support/identity.error.js";
import type { IdentityMutation, IdentitySchema, Principal } from "../identity.types.js";
import { IdentityOrganizationRepository } from "./organization.repository.js";
import { organizationCreateSchema, organizationUpdateSchema } from "./organization.schema.js";
import type { IdentityListQuery } from "../support/pagination.schema.js";

export class IdentityOrganizationService {
  constructor(
    private readonly repository: IdentityOrganizationRepository,
    private readonly mutate: IdentityMutation,
    private readonly revokeTenantSessions: (
      trx: Transaction<IdentitySchema>,
      tenantId: string
    ) => Promise<void>
  ) {}

  list(actor: Principal, query: IdentityListQuery) {
    if (actor.portal === "user") throw new IdentityError(403, "Access denied.");
    return this.repository.list(actor, query);
  }
  show(actor: Principal, id: string) {
    if (actor.portal === "user") throw new IdentityError(403, "Access denied.");
    return this.repository.show(actor, id);
  }

  async create(actor: Principal, raw: unknown) {
    this.manage(actor);
    const input = organizationCreateSchema.parse(raw);
    return this.mutate(actor, "organizations", input.id, async (trx) => {
      if (await this.repository.exists(trx, input.id))
        throw new IdentityError(409, "Organization already exists.");
      await this.repository.create(trx, input);
      return { ...input, version: 0 };
    });
  }

  async update(actor: Principal, id: string, raw: unknown) {
    this.manage(actor);
    if (!(await this.show(actor, id))) throw new IdentityError(404, "Resource not found.");
    const input = organizationUpdateSchema.parse(raw);
    return this.mutate(actor, "organizations", id, async (trx) => {
      const current = await this.repository.version(trx, id);
      if (Number(current.version) !== input.expectedVersion)
        throw new IdentityError(409, "This record changed. Reload before saving.");
      if (input.active === false && id === actor.tenant.id)
        throw new IdentityError(409, "Cannot deactivate your current organization.");
      if (!(await this.repository.update(trx, id, input)))
        throw new IdentityError(409, "This record changed. Reload before saving.");
      if (input.active === false) await this.revokeTenantSessions(trx, id);
      const row = await this.repository.get(trx, id);
      return { ...row, active: Boolean(row.active), version: Number(row.version) };
    });
  }

  private manage(actor: Principal) {
    if (actor.portal !== "super-admin" || !actor.permissions.includes("identity.manage"))
      throw new IdentityError(403, "Only super administrators can change this resource.");
  }
}
