import type { Principal } from "../identity.types.js";
import type { IdentityListQuery } from "../support/pagination.schema.js";
import type { createIdentityOrganizationProvider } from "./organization.provider.js";

export class IdentityOrganizationController {
  constructor(private readonly service: ReturnType<typeof createIdentityOrganizationProvider>) {}
  index(actor: Principal, query: IdentityListQuery) {
    return this.service.list(actor, query);
  }
  show(actor: Principal, id: string) {
    return this.service.show(actor, id);
  }
  store(actor: Principal, raw: unknown) {
    return this.service.create(actor, raw);
  }
  update(actor: Principal, id: string, raw: unknown) {
    return this.service.update(actor, id, raw);
  }
}
