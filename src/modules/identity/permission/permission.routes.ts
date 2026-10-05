export const permissionResource = "permissions" as const;
export const permissionResourceRoute = (
  controller: import("./permission.controller.js").IdentityPermissionController
) => ({ resource: permissionResource, controller });
