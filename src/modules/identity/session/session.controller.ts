import type { Principal } from "../identity.types.js";
import type { IdentityListQuery } from "../support/pagination.schema.js";
import type { createIdentitySessionProvider } from "./session.provider.js";

export class IdentitySessionController {
  constructor(private readonly service: ReturnType<typeof createIdentitySessionProvider>) {}
  index(actor: Principal, query: IdentityListQuery) {
    return this.service.list(actor, query);
  }
  show(actor: Principal, id: string) {
    return this.service.show(actor, id);
  }
  destroy(actor: Principal, id: string) {
    return this.service.remove(actor, id);
  }
}
