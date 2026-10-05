import type { Principal } from "../identity.types.js";
import type { IdentityListQuery } from "./pagination.schema.js";

export interface IdentityResourceController {
  index(actor: Principal, query: IdentityListQuery): Promise<unknown>;
  show(actor: Principal, id: string): Promise<unknown>;
  store?(actor: Principal, raw: unknown): Promise<unknown>;
  update?(actor: Principal, id: string, raw: unknown): Promise<unknown>;
  destroy?(actor: Principal, id: string, expectedVersion?: number): Promise<void>;
}
