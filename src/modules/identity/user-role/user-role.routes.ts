export const userRoleResource = "memberships" as const;
export const userRoleResourceRoute = (
  controller: import("./user-role.controller.js").IdentityUserRoleController
) => ({ resource: userRoleResource, controller });
