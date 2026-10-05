import type { Transaction } from "kysely";
import type { IdentityPermissionDeclaration } from "./permission/index.js";
import type { IdentityUserTables } from "./user/user.types.js";
import type { IdentityOrganizationTables } from "./organization/organization.types.js";
import type { IdentityRoleTables } from "./role/role.types.js";
import type { IdentityPermissionTables } from "./permission/permission.types.js";
import type { IdentityRolePermissionTables } from "./role-permission/role-permission.types.js";
import type { IdentityUserRoleTables } from "./user-role/user-role.types.js";
import type { IdentitySessionTables } from "./session/session.types.js";
import type { IdentitySettingsTables } from "./settings/settings.types.js";
import type { IdentityAuditTables } from "./audit/audit.types.js";
export type Portal = "user" | "admin" | "super-admin";
export interface IdentityPermissionCatalogEntry {
  id: string;
  label: string;
  owner: string;
  appId: string | null;
  portals: Portal[];
}
export interface IdentityConfig {
  appId: string;
  origin: string;
  mode: "single-client" | "multi-tenant";
  tenantId: string;
  sessionSeconds: number;
}
export interface Principal {
  user: { id: string; name: string; email: string };
  appId: string;
  portal: Portal;
  tenant: { id: string; name: string };
  permissions: string[];
}
export type IdentityMutation = <T>(
  actor: Principal,
  resource: string,
  id: string,
  action: (trx: Transaction<IdentitySchema>, id: string) => Promise<T>,
  affectedTenant?: string
) => Promise<T>;
export interface IdentitySchema
  extends
    IdentityUserTables,
    IdentityOrganizationTables,
    IdentityRoleTables,
    IdentityPermissionTables,
    IdentityRolePermissionTables,
    IdentityUserRoleTables,
    IdentitySessionTables,
    IdentitySettingsTables,
    IdentityAuditTables {}
export interface IdentityDeliveryProvider {
  send(input: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<{ messageId: string }>;
}
export interface IdentityProviderOptions {
  delivery?: IdentityDeliveryProvider;
  permissions?: readonly IdentityPermissionDeclaration[];
}
