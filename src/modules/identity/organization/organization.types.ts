import type { Generated } from "kysely";
export interface IdentityOrganizationTables {
  identity_tenants: {
    id: string;
    name: string;
    active: number;
    version: Generated<number>;
  };
}
export type IdentityOrganizationRow = IdentityOrganizationTables["identity_tenants"];
