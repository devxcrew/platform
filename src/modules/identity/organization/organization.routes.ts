export const organizationResource = "organizations" as const;
export const organizationResourceRoute = (
  controller: import("./organization.controller.js").IdentityOrganizationController
) => ({ resource: organizationResource, controller });
