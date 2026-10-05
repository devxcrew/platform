export const roleResource = "roles" as const;
export const roleResourceRoute = (
  controller: import("./role.controller.js").IdentityRoleController
) => ({ resource: roleResource, controller });
