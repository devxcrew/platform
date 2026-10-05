# Platform Core

Source repository: https://github.com/devxcrew/platform.
Package: `@devxcrew/platform`, source version `0.1.6`.

Platform Core owns database identity, sessions, role permissions, and tenant membership.
Applications consume its public provider. Framework remains responsible for business-neutral runtime primitives.

Public exports include `createIdentityProvider`, `identityMigration`, `seedIdentity`, and identity contract types.
The application provides its Kysely connection and validated environment. Platform Core owns all identity SQL and rules.

## Identity foundation

Three portal identities are supported: user, admin, and super-admin.
Each portal requires an explicit tenant membership and its own desk permission.
Administrator and super-administrator sessions do not grant access to other portals implicitly.

Passwords use salted scrypt with N=32768, r=8, and p=3.
Opaque session tokens use 32 random bytes. Only SHA-256 token hashes are stored in the database.
Cookies are app- and portal-specific, HttpOnly, and SameSite=Strict.
HTTPS uses Secure and the __Host- cookie prefix. HTTP is allowed only on loopback hosts.
Unsafe HTTP requests require the configured application Origin. Login attempts have persistent per-address and per-account limits.

Single-client mode resolves the configured tenant on the server.
Multi-tenant mode accepts a tenant ID only after verifying database membership.
Every session lookup rechecks account status, tenant status, membership, and current permissions.
Password changes revoke every session belonging to the account.

## Seed behavior

Seeds create the configured organization, three roles, and foundation permissions.
Optional bootstrap accounts require explicit email and password environment values.
There are no default passwords. Existing users and memberships are not elevated or overwritten by the seed.

## Development

Run `npm install`, `npm test`, and `npm run build` in this package.
Retrieve workspace instructions with this owner's authenticated npm run mcp:connect before edits.
The package name is `@devxcrew/platform`. Cxsun consumes a user-approved bundled development snapshot.
Owner authentication works. Deployed repository metadata remains pending. This package is not published to npm.

Invitation and recovery APIs support injected delivery. Real provider delivery remains a release gate.
Administration resources and settings are implemented. MFA and email verification remain explicit policy decisions.
This foundation does not claim production security certification or enterprise operational readiness.

## Owner checks

Run npm run release:check for tests, build, dependency order, version alignment, LF and dry-run package checks.
Maintenance uses the installed public @devxcrew/tools package. agent/CHANGELOG.md owns release metadata.
Use version-bump, fix:line-endings, lines:check and check:versions before a coordinated release.
Publication, Git delivery and deployment require authorization.

## Module permission extensions

Use the public identity.registerPermissions API or provider permissions options.
Register identityPermissionDeclarationsMigration after the roles migration. verify registers option declarations.
IDs use APP_ID.owner.action and declared allowed portals. Registration grants no roles automatically.
See agent/PERMISSION-EXTENSIONS.md for the complete contract and local evidence.

Module controllers use identity.authenticateRequest(request, portal, signal), then identity.requirePermission.
Platform owns portal cookies, unsafe Origin validation and cancellation. Raw-token authenticate remains supported.

Permission declarations may include an owner-written label. Permission catalog DTOs expose id, label, owner, appId and portals.
Register identityPermissionLabelsMigration after declarations. Filter role choices by allowed portals and retain server validation.

## Identity delivery failure contract

Platform owns invitation and recovery tokens. Email owns transport and receipt validation.
A successful send must return a nonempty receipt before the token becomes usable.
A transport error, timeout, canceled request, or missing receipt removes the newly issued token and returns a safe unavailable error.
A provider can accept a message before its response times out. That message can contain an unusable link.
The UI must offer a new explicit request after failure. It must not promise delivery or retry silently.
Successful resend creates a new token, then revokes the old invitation. A failed resend leaves the old invitation available.
Recovery requests invalidate earlier recovery tokens for the same account.
Recovery links expire after 30 minutes. Invitations expire after 24 hours. Completion claims one token once.
Disabled delivery returns unavailable and does not create a simulated success.
No automatic retry queue or durable outbox is implemented in this profile.
Actual SMTP delivery acceptance remains deferred. Local failure and concurrency checks do not establish real recipient delivery.

## Distribution

First-party package code uses the MIT license. Dependency licenses and notices retain their original terms.

## Tenant storage

Platform now exports createTenantProvider, tenantConnectionsMigration, provisionTenant and verifyTenantReadiness.
The tenant owner uses public Framework database contracts. See agent/TENANCY.md for composition and upgrade guidance.
Cxsun consumes matched development artifacts. This extraction does not publish new registry versions.
