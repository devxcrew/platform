# Shared tenant provider

Platform owns the tenant module in src/modules/tenant.
Identity continues to own authentication, sessions, membership and RBAC.
Framework provides generic database infrastructure through a peer dependency.

## Composition

The application supplies a Framework database provider and a public identity authenticator.
Call createTenantProvider(database, identity, environment), then register its handle method with the app router.
Run verify after migrations and identity startup. Close the database after tenant request work has drained.

The tenant module contains all canonical backend files.
Routes call the controller. The controller uses authenticated provider scope before returning safe data.
The service validates the principal, runtime mode and active mapping.
No frontend tenant administration module is included in this foundation.

## Public contracts

Use tenantConnectionsMigration for a fresh tenant registry.
Use createLegacyTenantConnectionsMigration and createTenantConnectionsMigration(previousTable) when preserving an existing application's migration history.
Compatibility names come from the app. Shared code contains no app-specific table names.

Use runRequest for browser requests. Optional tenant IDs must match the authenticated principal.
Use withPrincipal only with a trusted server-authenticated principal.
current supplies request-local data, database and resumable transfer contracts.
Separate providers cannot borrow another provider's context.

Use provisionTenant after identity seeding. Existing mappings and revisions remain unchanged on rerun.
verifyTenantReadiness checks active mappings through Framework connection leases.
executeTenantCommand provides provisioning and backup operations. The app owns CLI startup and shutdown.

## Development

Install the Framework development source before building Platform.
The Framework peer dependency keeps a consumer on one runtime instance.
Cxsun records matched Framework and Platform artifacts through packages:foundation.
These extracted contracts require new registry releases before adoption through npm version pins.

Run npm test and npm run build in Platform.
Tests cover two real SQLite tenant databases, mapping changes, runtime modes, provisioning and legacy data upgrades.
Cxsun supplies compiled HTTP and live MariaDB consumer acceptance.

## Owner boundary

Tenant reads active organization identity through createIdentityTenantDirectory.
Only the identity organization owner queries identity_tenants at runtime.
Tenant persistence queries tenant_connections. Migration foreign keys use the public identity schema.
