import type { Principal } from "../identity.types.js";
import type { IdentityListQuery } from "../support/pagination.schema.js";
import type { IdentityUserRoleProvider } from "./user-role.provider.js";

export class IdentityUserRoleController {
  constructor(private readonly service: IdentityUserRoleProvider) {}
  index(actor: Principal, query: IdentityListQuery) {
    return this.service.list(actor, query);
  }
  show(actor: Principal, id: string) {
    return this.service.show(actor, id);
  }
  store(actor: Principal, raw: unknown) {
    return this.service.createMembership(actor, raw);
  }
  update(actor: Principal, id: string, raw: unknown) {
    return this.service.updateMembership(actor, id, raw);
  }
  destroy(actor: Principal, id: string, expectedVersion?: number) {
    return this.service.removeMembership(actor, id, expectedVersion);
  }
}
