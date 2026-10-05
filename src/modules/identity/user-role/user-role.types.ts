import type { Generated } from "kysely";
export interface IdentityUserRoleTables {
  identity_memberships: {
    user_id: string;
    tenant_id: string;
    role_id: string;
    custom_role_id: Generated<string | null>;
    active: Generated<number>;
    version: Generated<number>;
  };
}
export type IdentityMembershipRow = IdentityUserRoleTables["identity_memberships"];
