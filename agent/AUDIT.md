# Identity audit

## Independent review - 2026-10-04

### Recovery correction verified

The coordinator authorized a bounded source correction after the finding below.
Recovery issuance now requires a scoped active principal with identity.password.
Completion repeats the principal and permission check inside the token claim transaction.
Passed: issuance followed by custom-role disable returns 422 without changing the password or claiming the token.
Passed: issuance followed by password-permission removal returns the same safe denial and preserves the password and token.
Passed: restricted roles receive the generic recovery response without any email delivery.
Passed after correction: `npm test`, all four tests, and `npm run build`.
The P1 finding below is closed locally. New packed Cxsun integration remains coordinator work.
No migrations changed. The release-script deficiency stays open.

Passed: authenticated `npm run mcp:connect`. The deployed owner repository metadata remains null.
Passed: `npm test` with four tests and `npm run build`.
Reviewed: provider exports, controllers, origin/cookie rules, login transactions, role scope and token lifecycle.
Initial P1 finding, now corrected above: recovery completion did not recheck the current custom role.
`identity.lifecycle-service.ts:237` checks active user and membership, then changes the global password at line 251.
Issuance calls the scoped principal lookup at line 115. Completion does not repeat its app/tenant/custom-role active checks.
A previously issued token can therefore reset a password after its custom role becomes inactive or loses access.
Define whether recovery requires identity.password, then apply that policy consistently at issuance and transactional completion.
Verify role disable, permission removal and membership reassignment after issuance. This finding is from source review, not a new exploit test.
P2, release gate: package.json has no standard version-bump, fix:line-endings, lines:check, check:versions or github:now commands.
Add package-owned maintenance through installed Tools and an explicit release-check command before coordinated release.
No source files exceed 700 lines in the reviewed Platform tree.
Partial: tests use real SQLite files and an injected delivery fixture. They do not prove external email delivery.
Untested here: current administration browser flows, production operations, retention jobs and an independent registry consumer.
Only recovery implementation, regression tests and owner records changed. No operational database, migration, publication, commit, push or deployment changed.

## Owner connection and plan loading - 2026-10-04

- Passed: authenticated independent cloud instruction connection with APP_ID=platform.
- Partial: returned repository metadata is null until the updated governance registry is deployed.
- Passed: npm test, three identity tests, and npm run build.
- Confirmed: public APIs currently cover login, current session, logout and password change.
- Missing: the planned identity master and settings administration APIs and their complete frontend flows.
- Prepared: owner PLAN.md and TASK.md with master phase numbering and explicit dependencies.
- Historical gap: the initial identity test used memory storage. The current implementation section records file-backed replacement.
- Historical pending work: file-backed acceptance and expanded resources. Current results appear in the implementation section.
- No operational database mutation, publication, commit or push was performed by this review.

The initial Platform Core tests passed with real SQLite migrations and HTTP requests.
Tests cover all portal logins, role and tenant denial, session hash storage, app scope, rotation, logout, password changes, expired sessions, disabled accounts, origin checks, validation, rate limiting, and HTTPS cookie flags.

The audit found a stale-password race during session issuance. Session creation now checks the verified password hash in its transaction.
Follow-up tests and build passed after this correction.

Passed: bundled @devxcrew/platform@0.1.0 integration into Cxsun without a sibling runtime dependency.
Passed: compiled application identity smoke and normal bootstrap account login, session, and logout.
Passed: browser three-portal login, refresh, wrong-role denial, and scoped logout.
The audit corrected a TanStack lazy-loader React error in the consuming frontend. A fresh browser pass captured no console errors.
Passed: malformed JSON, content-type rejection, body-size limits, and trailing-slash desk guards through the compiled app.
Pending: publication and independent live repository registration.
Historical untested areas: deployment, proxies, TLS, backups, MFA, recovery, and administration interfaces. Current API results appear below.

Loopback HTTP is for local development. External HTTP origins are rejected.
Password and session values are excluded from API responses and logs.

## Foundation implementation wave — 2026-10-04

Passed: authenticated Platform guidance with its own identity.
Passed: TypeScript production build and file-backed SQLite acceptance tests.
Passed: SQL collection count/search/order/limit/offset and strict query validation.
Passed: users, organizations, memberships, fixed role/permission catalogs, safe permission assignment, sessions and audit APIs.
Passed: tenant/app boundaries, privileged account guards, shared account guards, last-administrator retention, and required role permissions.
Passed: record versions, stale update rejection and concurrent profile writes with one success and one conflict.
Passed: organization settings, app settings, bounded session policy and app-wide session revocation after security changes.
Passed: injected invitation/recovery delivery, hashed one-use tokens, portal scope, failure cleanup, and generic recovery responses.
Passed: file close/reopen preserves active sessions, settings and audit records.
Passed: expired request rejects a settings write. Missing administration schema fails provider readiness.
Partial: cancellation is cooperative at mutation boundaries. Uncooperative external I/O cannot be forcibly stopped.
Partial: invitation/recovery tests use an explicit test delivery provider. They do not prove real SMTP or Cloudflare delivery.
Pending after the initial wave: custom roles and policy administration. The next section records completed custom-role work. Token/concurrency coverage and multi-process SQLite contention remain open.
Pending: production TLS/proxy behavior, backups/restores, released package artifacts, live metadata and full browser flows.
The earlier in-memory limitation is historical. Current identity integration tests create a separate SQLite file and remove it afterward.
No operational database mutation, publication, Git commit, push or deployment occurred in this owner task.

## Custom roles and connected settings — 2026-10-04

Passed: NEW identityRolesMigration adds custom role ownership, permission links, membership status and record versions.
The already applied administration migration remains unchanged.
Passed: custom role create/edit, protected system roles, own-organization administration and super-administrator cross-organization scope.
Passed: custom permissions replace inherited user permissions. Profile and password endpoints deny missing permissions.
Passed: inactive memberships/custom roles deny login. Role changes and membership changes revoke app sessions.
Passed: last-administrator retention and membership role/status revision conflicts.
Passed: missing membership DELETE revision returns 422. A stale revision returns 409.
Passed: a second authenticated app provider cannot read or revoke another app's custom role membership or account.
Passed: canonical per_page queries and snake-case collection metadata. Unsupported sorts return 422.
Passed: identifiers composed only of dots fail validation.
Passed: safe presentation exposes only app/organization names, locale and time zone.
Passed: application setting changes affect presentation. Organization settings override locale/time zone with app fallbacks.
Passed: final production build and three expanded file-backed acceptance tests after all source changes.
Coordinator initialized local Git on main. The earlier missing-Git finding is historical. No remote or publication was created.
Coordinator reports migration004 applied after backup. This owner did not change operational data. Refreshed package and browser acceptance remain coordinator work.
Pending: real delivery, broader token/concurrency cases, production operations and the final coordinated release.

## Guarded rollback and public login configuration — 2026-10-04

Corrected an unreleased DOWN path that could restore unrestricted memberships under older code.
Role rollback now refuses any custom role, custom membership, or inactive membership before changing schema or data.
The error requires restoration of a compatible database snapshot. The guard does not delete records.
The already applied UP source remains byte-for-byte unchanged.
Verified UP prefix SHA256: 0CA5448709BB530934DCD0C3A59A3AD4450B84364029CEA7CC7FA644C292ED7F.
Passed: file-backed custom-role rollback refusal preserves custom roles and membership rows.
Passed: a separate file-backed inactive-only membership refuses rollback and preserves its rows.
Passed: anonymous configuration exposes only displayName and requiresOrganizationId.
Passed: the configuration uses stored app naming or APP_NAME and reflects single-client/multi-tenant mode.
Passed: missing multi-tenant organization input returns safe field validation for login and recovery.
Account email failures now use user-facing contact-administrator wording.
Final production build and all four acceptance tests passed after these corrections.
No operational database rollback, migration, deletion, publication or deployment occurred in this owner correction.

## Local completion wave - 2026-10-04

- [x] 06.02.3 Verify simultaneous invitation claims: exactly one HTTP 200 and one HTTP 422.
- [x] 06.02.4 Verify simultaneous recovery claims: exactly one HTTP 200 and one HTTP 422.
- [x] 06.02.5 Verify expired recovery token preserves password and unclaimed token.
- [x] 06.02.6 Measure scoped SQL list/count over 1000 synthetic file-backed SQLite users.
- [x] 02.02.3 Add installed public Tools maintenance and explicit release-check scripts.

Passed: authenticated MCP connection, four expanded tests, build, version alignment, LF, dependency order and dry-run pack.
Local HTTP performance: five filtered/sorted paginated list/count reads, 1000 matching users, 100 returned per page.
Maximum observed 16.6 milliseconds. Explicit local regression budget: each read under 1000 milliseconds.
Environment: Windows workspace, installed Node 26, loopback HTTP and disposable temporary SQLite file, one process.
Synthetic password hashes reuse a valid fixture hash. This benchmark measures list/count, not password hashing or production load.
The benchmark cleans its rows. It does not change operational databases or establish universal scalability.
Existing tests cover delivery failure cleanup, portal/app scope, current-role recovery authorization and stale mutations.
Proposed first publication: @devxcrew/platform 0.1.0. No published Platform API exists to migrate.
Consumers must register migrations in order: identity, identityAdministration, identityRoles. Applied UP migrations remain immutable.
Browser schema consumers use only @devxcrew/platform/identity/schemas. PATCH requires expectedVersion. Membership DELETE uses query expectedVersion.
The maintenance script deficiency is closed locally. No publication, commit, push or deployment occurred.
Remaining: authenticated browser matrix, real delivery, MFA/account policy approval, deployed proxy/cookie acceptance and independent registry consumer.

## Security operating profile

See [current security and privacy profile](SECURITY-PROFILE.md).
Local password-only testing is supported. MFA, email verification, scheduled retention, erasure and off-host backup acceptance remain open.
The source review confirmed opportunistic expired-session/throttle cleanup, with no lifecycle-token or audit retention scheduler.
Do not close production security or retention acceptance from the local test results.

## Local scope clarification - 2026-10-04

The user deferred production deployment. Complete and review the local foundation first.
Current verified local substeps are checked in TASK.md. Production controls remain explicitly deferred.
Registry release and app integration gates remain open. This clarification does not claim complete release or production acceptance.

## Permission extension verification - 2026-10-04

Authenticated owner MCP guidance passed. Five file-backed tests and release:check pass.
Public owner permission declarations are transactional, namespaced and idempotent, with no automatic grants.
Catalog, role assignment and principal enforcement retain app/portal boundaries.
New additive permission declaration migration has guarded DOWN. Existing applied migrations are unchanged.
See PERMISSION-EXTENSIONS.md for exact API and regression scope. Consuming-app integration remains coordinator work.

## Public request authentication verification - 2026-10-04

Added provider.authenticateRequest(request, portal, signal) through the owning identity controller.
Five expanded tests and release:check pass, including real HTTP cookie, portal, Origin and cancellation regressions.
Raw-token authenticate remains unchanged. Consumers no longer duplicate private cookie transport.
No migration, operational database, publication or Git delivery changed.

## Public error boundary - 2026-10-04

IdentityError moved to owner identity.error.ts and exports through the public Platform boundary.
Controller behavior retains existing status/message responses. authenticateRequest portal validation returns safe public422fields.
The public contract test checks status, code, copied/frozen fields and invalid success-status rejection.
The consuming app maps public IdentityError into its Framework transport contract. No Framework dependency was added to Platform.

## Permission catalog DTO - 2026-10-04

Add owner-controlled optional labels and safe allowed-portal metadata to permission collection/item DTOs.
Export IdentityPermissionCatalogEntry and additive identityPermissionLabelsMigration. Prior declaration UP is unchanged.
Regression covers catalog/item presentation, fallback label, same-owner label update, unsafe label rejection and independent portal assignment validation.
Six expanded tests and release:check pass. Consuming app migration and rolepicker acceptance remain coordinator work.
# Initial GitHub delivery - 2026-10-04

User authorization: create devxcrew/platform, commit the initial source, and push.
GitHub repository created: https://github.com/devxcrew/platform, public, target branch main.
Initial source commit 257b686 pushed successfully. GitHub main matched the local commit.
Repository credential selection uses the authorized devxcrew account.
Git attributes keep text files in LF format across Windows and CI checkouts.
Authenticated MCP connection passed before repository work.
Repository version: 0.1.0. CI checks a clean npm installation and package verification.
Local verification: six tests passed, TypeScript build passed, version alignment and line-ending checks passed.
The file-backed SQLite list benchmark returned 1000 rows over five reads, with a maximum of 10.5 milliseconds.
Environment secrets, SQLite files, caches, build output, and IDE files remain ignored.
This source delivery does not establish npm publication, complete foundation acceptance, or production deployment.
# Workspace GitHub release - 2026-10-04

npm run release:check passed: six file-backed tests, build, aligned metadata, LF and package dry run.
Configured-secret scan found no matches in Git release candidates.

User authorization: update versions and changelogs, then commit and push all workspace repositories.
Record the public identity owner, permission declarations and labels, additive migrations and verified GitHub source delivery.
Authenticated MCP connection passed for this owner before release work.
This delivery covers GitHub source. Npm publication, production deployment and real email acceptance remain separate gates.

## Completion wave evidence - 2026-10-04

npm run release:check passed six file-backed identity tests, build and a 59-file MIT package. The 1,000-row list benchmark maximum was 7.3 ms, below its 1,000 ms local budget.
Authenticated MCP passed before work. New or expanded three-OS CI requires actual remote run evidence. Npm publication and deployed acceptance remain open.
