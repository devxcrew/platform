# Module permission declarations

Status: local implementation verified. Publication and consuming-app migration are separate gates.

## Public API

Import IdentityPermissionDeclaration, createIdentityProvider and identityPermissionDeclarationsMigration from @devxcrew/platform.
Register the new migration after identityRolesMigration. Existing applied migrations stay unchanged.
Provider verify requires the new table.

Example: await identity.registerPermissions({ owner: "diagnostic", permissions: [{ id: "cxsun.diagnostic.read", portals: ["user", "admin"] }] }).
Alternatively pass { permissions: [declaration] } as provider options. verify registers those declarations before completing readiness.
This is trusted server composition, not an HTTP endpoint. Modules use the injected public provider, never private identity tables.

## Safety and ownership

IDs use <APP_ID>.<owner>.<action>, with optional further dotted action segments.
Owner names use lowercase letters, digits and hyphens. Reserved identity and desk owners are denied.
Zod rejects unknown fields, malformed IDs, duplicate IDs, empty portal sets and unsupported portals.
A declaration accepts 1–100 permissions. Exact repeated declarations are idempotent.
Changed owner, app scope or portal policy fails without partial writes. Existing undeclared catalog conflicts also fail.
There are no automatic role grants. Registration never changes membership or existing permission policy.
Removal or changed portal policy requires an explicit future migration and grant review.

## Assignment and enforcement

Existing role APIs assign declared permissions explicitly. Custom roles accept declared user permissions only.
System role updates require super-admin and declaration compatibility with the selected portal.
Catalog lists include current-app declarations and unchanged built-in identity IDs.
Cross-app or incompatible-portal assignment fails. Principal lookups filter declared grants by current app and portal.
Authenticate normally, then call identity.requirePermission(principal, permissionId).
Declarations cannot bypass identity.manage, desk, tenant, custom-role or protected administrator rules.

## Local evidence

Five file-backed tests and release:check pass. The new regression covers idempotence, conflicts and strict unsafe input rejection.
It proves no automatic grants, incompatible-portal denial, custom-role explicit assignment and cross-app catalog/assignment isolation.
Real HTTP login and public authenticate/requirePermission prove granted and denied access.
Migration DOWN refuses populated declarations and preserves ownership rows.
No operational database, existing migration, published version, commit, push or deployment changed.

## Public request authentication

Use await identity.authenticateRequest(request, portal, signal) in an injected module controller.
The Platform provider owns app/portal cookie naming and parsing. Consumers must not copy private cookie rules.
The method validates the portal, checks cancellation before and after authentication, and applies the existing active session/principal lookup.
POST, PATCH, PUT, DELETE and other unsafe methods require the configured exact Origin. GET, HEAD and OPTIONS are safe methods.
Missing or untrusted unsafe Origin fails with 403. Missing, invalid or other-portal cookies fail with 401.
An aborted request fails with safe 408. Portal validation failures use Zod.
The method returns a Principal. The caller must require its module permission and validate resource input independently.
It does not execute mutations, serialize errors or grant permissions. Controllers map errors through the app's safe transport contract.
The existing authenticate(portal, token) API remains available for trusted token-based integrations.
Real HTTP regression checks authenticated GET, missing/invalid/wrong-portal cookies, invalid portal, unsafe Origin and cancellation.

## Public error mapping

Import IdentityError from @devxcrew/platform. Do not import identity.service private files.
IdentityError exposes status, message, code=identity_error and optional readonly fields.
Constructor: new IdentityError(status, safeMessage, optionalFieldMessages). Status must be 400–599.
Field messages are copied and frozen. Only caller-safe messages belong in this contract.
The consuming HTTP adapter maps this public class into its Framework transport error. Unknown errors stay safe 500 responses.
Invalid authenticateRequest portal input uses IdentityError 422 with fields.portal.
Existing identity HTTP response behavior remains compatible. Six package tests cover the public contract and transport regressions.

## Catalog labels and portal metadata

Public permission collection and item DTOs expose id, label, owner, appId and portals.
IdentityPermissionCatalogEntry is exported from @devxcrew/platform. Built-in rows keep their IDs and use those IDs as labels.
Their owner is identity or desk, appId is null and portals reflect supported built-in portal assignment.
Module declarations accept an optional trimmed human label of 1–100 characters with no control characters.
The module owner supplies the label. Missing labels display the ID. Platform contains no business-domain labels.
An exact owner/app may update only the label while its registered portal policy stays fixed.
Omitting label on repeat keeps an existing label. Label changes never alter grants or membership.
Frontends filter custom-role choices by portals containing user, and system-role choices by that system role's portal.
Server assignment independently rejects incompatible portals.
Register the additive identityPermissionLabelsMigration after identityPermissionDeclarationsMigration.
The previously applied declaration migration UP remains unchanged. Provider verify requires the label column.
Collection/item regression verifies supplied labels, fallback IDs, owner/app/portal metadata, safe label updates and role assignment.
