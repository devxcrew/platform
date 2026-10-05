import type { Principal } from "../identity.types.js";
import type { IdentityListQuery } from "../support/pagination.schema.js";
import type { createIdentityAuditProvider } from "./audit.provider.js";

export class IdentityAuditController {
  constructor(private readonly service: ReturnType<typeof createIdentityAuditProvider>) {}
  index(actor: Principal, query: IdentityListQuery) {
    return this.service.list(actor, query);
  }
  show(actor: Principal, id: string) {
    return this.service.show(actor, id);
  }
}
