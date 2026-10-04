# Local identity resource contracts

Reviewed: 2026-10-04. Scope: the current Platform provider and Cxsun identity module.
Production deployment is deferred. This matrix records supported behavior, not a production certification.

## Ownership and integration

Platform owns identity schemas, persistence, authorization, lifecycle tokens and audit.
Cxsun owns its identity forms, lists, navigation and application composition.
The application supplies a real file-backed Kysely connection and optional public email delivery provider.
Use `createIdentityProvider` from `@devxcrew/platform`. Browser validation imports `@devxcrew/platform/identity/schemas`.
The server validates independently. Frontend visibility does not grant API permission.
Register identity, administration and roles migrations in order. Preserve applied UP migrations.

API base: `/api/v1/identity/{portal}`, where portal is `user`, `admin` or `super-admin`.
Each authenticated principal needs the matching desk permission and an active scoped membership.
Admin scope is its organization. Super-admin scope can span organizations within supported resource ownership.
Custom roles, sessions, invitations and audit records remain app-scoped.
Users, organizations and system roles are shared database identity records, not separate app copies.

## Resource action matrix

L = collection GET. S = item GET. C = POST. U = PATCH. D = DELETE.
Administration mutations and managed resources require `identity.manage`.
Exceptions and restrictions below remain authoritative.

| Resource | User portal | Admin portal | Super-admin portal | Constraints |
| --- | --- | --- | --- | --- |
| users | Denied | L, S, C, U | L, S, C, U | Admin sees its organization. Admin cannot modify privileged or protected shared accounts. No hard delete. |
| organizations | Denied | L, S | L, S, C, U | Admin reads its current organization. Current organization cannot be deactivated by its actor. No hard delete. |
| memberships | Denied | L, S, C, U, D | L, S, C, U, D | Admin scope is its organization and user roles. Preserve last active administrators. |
| roles: system | Denied | L, S | L, S, U | Fixed IDs user/admin/super-admin. No create, rename or delete. Required permissions are protected. |
| roles: custom | Denied | L, S, C, U | L, S, C, U | Current app and organization scope. Always user portal. No delete. Disable through active=false. |
| permissions | Denied | L, S | L, S | Read-only known catalog. No arbitrary permission creation. |
| sessions | L, S, D: own | L, S, D: organization | L, S, D: app | Only unexpired sessions are listed. User can revoke its own session without identity.manage. |
| invitations | Denied | L, S, C, resend, D | L, S, C, resend, D | App-scoped. Admin invites user system role in its organization. Super-admin can select system portal roles and organization. |
| audit-events | Denied | L, S | L, S | Read-only, current app. Admin scope is its organization. No UI/API erasure. |

Role and organization catalogs permit admin reads independently of identity.manage.
Other administrative collection reads require identity.manage.
Custom role permissions replace system-user permissions. They must retain `desk.user`.
Custom roles cannot grant `identity.manage` or another portal desk.
Invitation role selection supports system roles only, not custom roles.
Membership identity is `userId~tenantId~portal`. Editing cannot change user, organization or portal.
Membership editing selects a compatible role within that existing portal and scope.

## Fields and revisions

| Resource | Create fields | Update fields | Immutable or protected fields |
| --- | --- | --- | --- |
| users | name, email, password, roleId, optional tenantId | name, email, active, expectedVersion | Server-generated id. Password changes use password endpoint. Role assignment uses memberships. |
| organizations | id, name, optional active | name, active, expectedVersion | id cannot change. Current-organization deactivation fails. |
| memberships | userId, roleId, optional tenantId | roleId, active, expectedVersion | Composite identity, userId, tenantId and portal cannot change. |
| system roles | Not supported | permissionIds, expectedVersion | id and portal fixed. Required desk/password permissions retained. Administrator roles retain identity.manage. |
| custom roles | name, permissionIds, optional tenantId | name, permissionIds, active, expectedVersion | id, app and organization fixed. Only known user permissions allowed. |
| invitations | name, email, optional system roleId and tenantId | No PATCH | Resend creates a new delivery/token cycle. DELETE revokes the invitation. |

New passwords require 12–256 characters. Login accepts existing passwords of 1–256 characters.
Names require 1–100 trimmed characters. Email values normalize to lowercase and have a 254-character limit.
Schemas reject unknown fields. Creation and update shapes are distinct.
Editable records expose numeric `version`. PATCH requires numeric `expectedVersion`.
Stale updates return 409. Membership DELETE requires `?expectedVersion=<current revision>`.
Session and invitation revocation do not use record revision inputs.
Read-only catalogs and audit/session items do not advertise editable revisions.

## Account and settings contracts

| Endpoint | GET | PATCH or action | Scope and fields |
| --- | --- | --- | --- |
| profile | All authenticated portals with identity.self | Same permission | Own name and expectedVersion only. Email and privileges are not profile-editable. |
| password | Not supported | All authenticated portals with identity.password | currentPassword and password. Password change revokes all account sessions. |
| settings | All authenticated portals | Admin/super-admin with identity.manage | Current organization displayName, locale, timeZone, expectedVersion. Cxsun presents editing on administration desks. |
| application-settings | Admin/super-admin | Super-admin with identity.manage | Current app displayName, locale, timeZone, expectedVersion. |
| security-settings | Admin/super-admin | Super-admin with identity.manage | sessionSeconds 300–86400 and expectedVersion. Save revokes app sessions. |
| presentation | All authenticated portals | Not supported | displayName, organizationDisplayName, locale and timeZone. No secret policy fields. |
| configuration | Anonymous, all portals | Not supported | displayName and requiresOrganizationId only. No tenant directory or secrets. |

Supported locales are en, en-US and en-GB. timeZone must be an accepted IANA zone.
Organization presentation overrides app defaults. Missing defaults use APP_NAME, en and UTC.
Application and security settings share one app-row revision. Reload after another settings editor saves.
No arbitrary key/value settings, password-policy editor or MFA settings are implemented.

## Session and public lifecycle endpoints

| Endpoint | Method | Contract |
| --- | --- | --- |
| sessions | POST | email, password, optional tenantId. Returns principal and portal cookie with 201. |
| sessions/current | GET | Current authenticated principal. |
| sessions/current | DELETE | Logout, clears this portal cookie, returns 204. |
| recovery | POST | email and optional tenantId. Generic 202 response for eligible or unknown accounts when delivery is configured. |
| recovery/complete | POST | token and password. Requires current scoped identity.password authorization at claim time. |
| invitations/accept | POST | token and password. Token must match app, portal, expiry and delivery state. |
| invitations/{id}/resend | POST | Administrative scoped action. No automatic retry worker. |

Multi-tenant login and recovery require tenantId. Single-client mode resolves the configured organization.
Unsafe requests require the exact configured Origin, including public lifecycle requests.
Recovery links expire after 30 minutes. Invitation links expire after 24 hours.
Only token hashes persist. Successful claims are single-use and transactionally revalidated.
Missing delivery or delivery failure returns safe 503. Failed issuance does not leave a claimable token.
Real external delivery is deferred. Injected test delivery proves local provider behavior only.

## Lists and Cxsun screens

Collections use page, per_page, search, sort and direction query keys.
page is 1–100000. per_page is 1–100. search is at most 100 characters.
Responses contain data and meta.current_page, per_page, total and last_page.
Users sort by id/name/email. Organizations and roles sort by id/name.
Invitations sort by id/name/email. Other collections support id sorting only through the public schema.
Unsupported sort fields return 422. Counting and paging use scoped SQL, not browser filtering.
Cxsun owns URL state, breadcrumb return links and TanStack Form validation.
Its resource specs expose create/edit/revoke/resend actions from this matrix.
User navigation exposes sessions plus separately permission-gated profile and password pages.
Admin system-role edit controls are hidden. Super-admin can edit protected system permission sets within policy.

## Evidence and remaining limits

Reviewed sources: public provider, controller, administration/lifecycle schemas and services, repository scope and Cxsun resource specs.
Four file-backed Platform suites pass, including real HTTP resources, restart, stale writes, role scope and token claims.
Concurrent invitation and recovery claims each return exactly one 200 and one 422.
Expired recovery preserves the existing password and unclaimed token.
Five filtered paginated HTTP reads over 1000 synthetic SQLite users measured a 16.6 ms maximum against a 1000 ms local budget.
These checks do not establish production throughput or a complete browser acceptance matrix.

The supported local profile uses passwords. MFA, WebAuthn and email verification are not implemented.
See SECURITY-PROFILE.md for retention, logging and backup limitations.
Real delivery, independently published consumers, complete browser acceptance and production operations remain separate gates.
No hard-delete account workflow, custom-role invitation, bulk upsert, retention scheduler or user erasure is claimed.

## Module permission extension contract

The confirmed extension gap is now implemented. See [permission declarations](PERMISSION-EXTENSIONS.md).
The permissions HTTP catalog stays read-only. Trusted public provider registration adds app-qualified owner declarations without automatic grants.
Existing role assignment and principal enforcement validate declared allowed portals and current app scope.
Five Platform file-backed tests now pass. Consuming apps must add the public declaration migration before using this package snapshot.
