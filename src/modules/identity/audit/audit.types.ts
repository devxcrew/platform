export interface IdentityAuditTables {
  identity_audit_events: {
    id: string;
    app_id: string;
    actor_id: string;
    tenant_id: string;
    action: string;
    resource_id: string;
    created_at: string;
  };
}
export type IdentityAuditRow = IdentityAuditTables["identity_audit_events"];
