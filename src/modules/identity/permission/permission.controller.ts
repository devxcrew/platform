import type { Principal } from "../identity.types.js";
import type { IdentityListQuery } from "../support/pagination.schema.js";
import type { IdentityPermissionProvider } from "./permission.provider.js";

export class IdentityPermissionController {
  constructor(private readonly service: IdentityPermissionProvider) {}
  index(actor: Principal, query: IdentityListQuery) {
    return this.service.list(actor, query);
  }
  show(actor: Principal, id: string) {
    return this.service.show(actor, id);
  }
}
