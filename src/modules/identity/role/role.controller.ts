import type { Principal } from "../identity.types.js";
import type { IdentityListQuery } from "../support/pagination.schema.js";
import type { IdentityRoleProvider } from "./role.provider.js";
import { IdentityError } from "../support/identity.error.js";

export class IdentityRoleController {
  constructor(private readonly service: IdentityRoleProvider) {}
  index(actor: Principal, query: IdentityListQuery) {
    return this.service.list(actor, query);
  }
  show(actor: Principal, id: string) {
    return this.service.show(actor, id);
  }
  store(actor: Principal, raw: unknown) {
    return this.service.create(actor, raw);
  }
  async update(actor: Principal, id: string, raw: unknown) {
    if (["user", "admin", "super-admin"].includes(id)) {
      const row = await this.show(actor, id);
      if (!row) throw new IdentityError(404, "Resource not found.");
      return this.service.updateSystemPermissions(actor, id, raw);
    }
    return this.service.update(actor, id, raw);
  }
}
