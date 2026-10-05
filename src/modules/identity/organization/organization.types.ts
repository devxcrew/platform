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
export interface IdentityTenantDirectory {
  active(id: string): Promise<{ id: string; name: string } | undefined>;
  listActive(after: string, pageSize: number): Promise<{ id: string }[]>;
}
