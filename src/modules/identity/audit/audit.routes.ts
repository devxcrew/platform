export const auditResource = "audit-events" as const;
export const auditResourceRoute = (
  controller: import("./audit.controller.js").IdentityAuditController
) => ({ resource: auditResource, controller });
