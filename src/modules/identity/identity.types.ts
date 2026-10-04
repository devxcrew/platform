import type { Generated } from "kysely";
import type { IdentityPermissionDeclaration } from "./identity.permission-declarations.js";
export type Portal = "user" | "admin" | "super-admin";
export interface IdentityPermissionCatalogEntry {
  id: string;
  label: string;
  owner: string;
  appId: string | null;
  portals: Portal[];
}
export interface IdentityConfig {
  appId: string;
  origin: string;
  mode: "single-client" | "multi-tenant";
  tenantId: string;
  sessionSeconds: number;
}
export interface Principal {
  user: { id: string; name: string; email: string };
  appId: string;
  portal: Portal;
  tenant: { id: string; name: string };
  permissions: string[];
}
export interface IdentitySchema {
  identity_permission_declarations: { permission_id: string; app_id: string; owner: string; portals: string; label: Generated<string | null> };
  identity_app_settings: {
    app_id: string;
    display_name: string;
    locale: string;
    time_zone: string;
    session_seconds: number;
    version: Generated<number>;
  };
  identity_tokens: {
    id: string;
    token_hash: string;
    app_id: string;
    tenant_id: string;
    kind: "invitation" | "recovery";
    email: string;
    name: string;
    role_id: Portal;
    user_id: string | null;
    expires_at: string;
    consumed_at: string | null;
    delivered: number;
  };
  identity_users: {
    id: string;
    email: string;
    name: string;
    password_hash: string;
    active: number;
    version: Generated<number>;
  };
  identity_tenants: {
    id: string;
    name: string;
    active: number;
    version: Generated<number>;
  };
  identity_roles: { id: string; version: Generated<number> };
  identity_permissions: { id: string };
  identity_role_permissions: { role_id: string; permission_id: string };
  identity_memberships: {
    user_id: string;
    tenant_id: string;
    role_id: string;
    custom_role_id: Generated<string | null>;
    active: Generated<number>;
    version: Generated<number>;
  };
  identity_custom_roles: {
    id: string;
    app_id: string;
    tenant_id: string;
    name: string;
    active: Generated<number>;
    version: Generated<number>;
  };
  identity_custom_role_permissions: { role_id: string; permission_id: string };
  identity_sessions: {
    token_hash: string;
    user_id: string;
    tenant_id: string;
    app_id: string;
    portal: Portal;
    expires_at: string;
  };
  identity_throttles: { key: string; attempts: number; expires_at: string };
  identity_settings: {
    tenant_id: string;
    display_name: string;
    locale: string;
    time_zone: string;
    version: Generated<number>;
  };
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
export interface IdentityDeliveryProvider {
  send(input: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<{ messageId: string }>;
}
export interface IdentityProviderOptions {
  delivery?: IdentityDeliveryProvider;
  permissions?: readonly IdentityPermissionDeclaration[];
}
