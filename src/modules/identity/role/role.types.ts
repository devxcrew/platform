import type { Generated } from "kysely";
export interface IdentityRoleTables {
  identity_roles: { id: string; version: Generated<number> };
  identity_custom_roles: {
    id: string;
    app_id: string;
    tenant_id: string;
    name: string;
    active: Generated<number>;
    version: Generated<number>;
  };
}
export type IdentityRoleRow = IdentityRoleTables["identity_roles"];
export type IdentityCustomRoleRow = IdentityRoleTables["identity_custom_roles"];
