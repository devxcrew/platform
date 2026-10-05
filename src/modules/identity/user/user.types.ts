import type { Generated } from "kysely";
import type { Portal } from "../identity.types.js";
export interface IdentityUserTables {
  identity_users: {
    id: string;
    email: string;
    name: string;
    password_hash: string;
    active: number;
    version: Generated<number>;
  };
  identity_tokens: {
    id: string;
    token_hash: string;
    app_id: string;
    tenant_id: string;
    kind: "invitation" | "recovery";
    email: string;
    name: string;
    role_id: Portal;
    user_id: string | null;
    expires_at: string;
    consumed_at: string | null;
    delivered: number;
  };
}
export type IdentityUserRow = IdentityUserTables["identity_users"];
