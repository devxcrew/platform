export interface IdentityRolePermissionTables {
  identity_role_permissions: { role_id: string; permission_id: string };
  identity_custom_role_permissions: { role_id: string; permission_id: string };
}
export type IdentityRolePermissionRow = IdentityRolePermissionTables["identity_role_permissions"];
export type IdentityCustomRolePermissionRow =
  IdentityRolePermissionTables["identity_custom_role_permissions"];
