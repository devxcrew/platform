import { IdentityError } from "../support/identity.error.js";
import type { IdentityMutation, Principal } from "../identity.types.js";
import type { IdentityListQuery } from "../support/pagination.schema.js";
import { IdentitySessionRepository } from "./session.repository.js";

export class IdentitySessionService {
  constructor(
    private readonly repository: IdentitySessionRepository,
    private readonly mutate: IdentityMutation
  ) {}

  list(actor: Principal, query: IdentityListQuery) {
    this.allow(actor);
    return this.repository.list(actor, query);
  }
  show(actor: Principal, id: string) {
    this.allow(actor);
    return this.repository.show(actor, id);
  }
  async remove(actor: Principal, id: string) {
    const row = await this.show(actor, id);
    if (!row) throw new IdentityError(404, "Resource not found.");
    await this.mutate(actor, "sessions", id, (trx) =>
      this.repository.revokeOne(trx, actor.appId, id)
    );
  }

  private allow(actor: Principal) {
    if (actor.portal !== "user" && !actor.permissions.includes("identity.manage"))
      throw new IdentityError(403, "Access denied.");
  }
}
