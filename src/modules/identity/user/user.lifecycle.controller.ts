import type { Portal, Principal } from "../identity.types.js";
import type { IdentityUserProvider } from "./user.provider.js";
import type { IdentityListQuery } from "../support/pagination.schema.js";

export class IdentityUserLifecycleController {
  constructor(private readonly service: IdentityUserProvider["lifecycle"]) {}
  requestRecovery(portal: Portal, raw: unknown, address: string) {
    return this.service.requestRecovery(portal, raw, address);
  }
  complete(portal: Portal, kind: "invitation" | "recovery", raw: unknown, address: string) {
    return this.service.complete(portal, kind, raw, address);
  }
  index(actor: Principal, query: IdentityListQuery) {
    return this.service.list(actor, query);
  }
  show(actor: Principal, id: string) {
    return this.service.show(actor, id);
  }
  store(actor: Principal, raw: unknown) {
    return this.service.invite(actor, raw);
  }
  resend(actor: Principal, id: string) {
    return this.service.resend(actor, id);
  }
  destroy(actor: Principal, id: string) {
    return this.service.revoke(actor, id);
  }
}
