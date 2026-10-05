import type { Portal } from "../identity.types.js";
export interface IdentitySessionTables {
  identity_sessions: {
    token_hash: string;
    user_id: string;
    tenant_id: string;
    app_id: string;
    portal: Portal;
    expires_at: string;
  };
  identity_throttles: { key: string; attempts: number; expires_at: string };
}
export type IdentitySessionRow = IdentitySessionTables["identity_sessions"];
