import type { Generated } from "kysely";
export interface IdentityPermissionTables {
  identity_permissions: { id: string };
  identity_permission_declarations: {
    permission_id: string;
    app_id: string;
    owner: string;
    portals: string;
    label: Generated<string | null>;
  };
}
export type IdentityPermissionRow = IdentityPermissionTables["identity_permissions"];
export type IdentityPermissionDeclarationRow =
  IdentityPermissionTables["identity_permission_declarations"];
