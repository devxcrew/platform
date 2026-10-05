# Identity audit

## Identity ownership alignment - 2026-10-05

Passed: authenticated `npm run mcp:connect`; deployed guidance is advisory and the Platform repository metadata is null.
Passed: `npm run build` after the owner-local refactor and `git diff --check`.
Passed: the provider scan found no direct SQL in `*.provider.ts`.
Changed: permission declarations now have schema, service, and repository roles. Role-permission writes now use its service and repository.
Changed: user, membership, role, and permission list SQL moved from the identity administration repository into owner repositories.
Changed: the role check helper is test-only, and the user administration helper uses dot-separated naming.
Partial: the root administration service still owns organization, settings, and session operations; historical migrations still span several tables.
Partial: some owner read models still join related tables directly. Replace those joins through explicit owner contracts when splitting the remaining read model.
Untested in this pass: the identity test suite, live database upgrades, consuming application behavior, and browser flows. No release, commit, push, or publication occurred.

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


Three-OS source CI passed: GitHub Actions run 37202025119 on Node 26.10.0 and npm 12.2.0.

## Dependency alignment - 2026-10-05

- [x] Align consumed shared packages and common direct dependency versions.
- [x] Install dependencies with lifecycle scripts disabled.
- [x] Keep app dependency ownership and public peer ranges.
- [x] Exclude Veyrezio from this change.

Source version: 0.1.3. Published package archives retain their existing versions.
The baseline is recorded in projects/cxsun/agent/DEPENDENCY-BASELINE.json.

## Identity module organization - 2026-10-05

Moved identity user, role, user-role, permission, and role-permission implementations, schemas, migrations, and checks into owner folders under `src/modules/identity`. User/profile administration, membership creation, and system-role permission updates now execute in their owning modules. Shared request-scoped transactions and audit recording live in `identity.mutation-service.ts`. Adopted CXApp's flat, filename-prefixed module layout and formatting settings. Retained Platform's provider contract as the module registration boundary and updated root exports and imports.

Verification: `node node_modules/typescript/bin/tsc -p tsconfig.json`, Prettier `--check`, and `git diff --check` passed after the use-case moves. Identity tests were not run.

## Identity owner extraction - 2026-10-05

The root identity directory now contains the public provider, public schemas, shared type composition, and public barrel. Organization, settings, session, and audit own their implementation. `composition` wires owner providers and seed order; `transport` owns HTTP adaptation; `support` contains business-neutral request and paging utilities. Applied historical migrations retain their original content in `legacy` so their sequence stays stable. A missing system role update now returns 404.

Authenticated `npm run mcp:connect` succeeded before this work. `npm run build` and `git diff --check` passed after extraction and formatting. Tests were not run in this turn. Remaining direct sibling-table queries and writes are recorded in `agent/TASK.md`; strict table ownership is not yet complete.

Audit targeting now uses membership and organization provider lookups. Role and membership changes call audit and session provider contracts for writes within the same transaction. `npm run build` and `git diff --check` passed after these changes.

## Identity owner contracts and routes - 2026-10-05

Authenticated `npm run mcp:connect` succeeded before the implementation. Resource route registrations now originate in owner route files and point to owner controllers. User sign-in and lifecycle work call session, membership, organization, role, role-permission, settings, and audit owner contracts. User, membership, and role list queries compose public owner SQL sources so database pagination and sorting remain intact. Existing historical migrations were not rewritten.

`npm run build`, `npm run check:versions`, and `git diff --check` passed. `npm run lines:check` first found CRLF in `agent/TASK.md`; `npm run fix:line-endings` normalized it. Identity tests were not run in this turn. Runtime behavior remains unverified by this turn's static checks.

After moving composition-level tests into `src/modules/identity/composition/tests`, the browser-schema check initially exposed an accidental omission of settings schemas from the browser-safe public schema entry. Restoring the owner schema exports resolved it. `npm run test` then passed all seven tests: permission declarations, HTTP authentication and tenancy, role rollback, browser schemas, error contract, password hashing, and validation. The file-backed SQLite list benchmark completed five reads of 1,000 rows with a 14.8 ms maximum against its 1,000 ms local budget.

## Release 0.1.6 preparation - 2026-10-05

The npm registry showed `@devxcrew/platform` at 0.1.2. Version 0.1.6 is a new release. `npm run release:check` passed dependency order, version alignment, line ending checks, all seven tests, TypeScript compilation, and package dry run. The first package preview exposed stale compiled files from removed centralized modules. The build now removes `dist` before compilation. The final dry run packed 235 files without the removed central implementation files.


## Shared alignment audit - 2026-10-05

Seven tests, build and fresh source consumers passed after seeder, controller binding and browser schema corrections. Source 0.1.5 remains unpublished.

Authenticated live MCP verification passed. See the [alignment audit](D:/codexsun/projects/cxsun/agent/SHARED-ALIGNMENT.md). Version numbers remain unchanged. No release delivery was performed by this audit.

## Shared foundation extraction - 2026-10-05 19:21

Move tenant mappings, authenticated scope, provisioning, routes, readiness and tests into src/modules/tenant.
Keep all canonical backend files. Routes call the controller. Services use public identity organization contracts and Framework leases.
Tenant runtime contains no app-specific table names or direct identity table queries.
Compatibility migrations accept the app's historical table name. Existing mappings and revisions survive repeated provisioning.
Declare Framework as a peer dependency. Use its local development source when building this unreleased extraction.

Passed: identity and tenant owner tests, TypeScript build, tooling and package dry run.
Owner tests cover separate SQLite storage, inactive mappings, single-client denial, context isolation, mapping replacement and legacy upgrade preservation.
Cxsun's fixture-based HTTP identity acceptance and its live MariaDB engine checks passed.
Its existing database startup passed. Existing-account login remains untested because verification account credentials are absent.

No version change, commit, push or npm publication was performed. Production account, TLS and network acceptance remain open.

### Final extraction evidence - 2026-10-05 19:23

Passed: Cxsun test:foundation:standalone completed offline npm ci in a new fixture.
The fixture uses recorded vendor artifacts and the secret-free environment example.
It passed tooling, lint, TypeScript, 48 app tests, production build, frontend smoke and compiled three-portal identity/RBAC acceptance.
The default suite skipped one gated MariaDB test. The separate live MariaDB command passed.
No sibling source import or linked shared runtime was required in the standalone consumer.

Passed: Framework 62 tests and Platform 27 tests.
Canonical database, settings and tenant files are present. All reviewed owner files remain below 700 lines.
Package lock integrity, dependency order, version alignment, LF checks and git diff --check passed.
Tenant backup and isolated restore checked four infrastructure tables through public package exports.

Partial: existing-account live login needs verification credentials. Server startup and master/tenant readiness passed.
Production TLS, privilege policy and distributed network recovery remain untested.
Versions remain Framework 0.1.11, Platform 0.1.6 and Cxsun 0.2.3 with unreleased source changes.
No commit, push or package publication was performed.

## Source delivery - 2026-10-05 19:34

Extract module-owned tenancy.

Platform owns tenant mappings, scope middleware and provisioning through public Framework and identity contracts. Verify passed: 27 tests, build and package dry run. CI now checks out and builds its sibling Framework dependency.

Live authenticated governance connected. Local release checks passed. Commit and push authorized through github:now. Versions remain unchanged; npm publication is pending. GitHub Actions results must be checked after push. Secrets, runtime storage and caches are excluded.

## npm release audit - 2026-10-05

- [x] Retrieve authenticated live governance.
- [x] Review public exports, dependency ownership and release artifact scope.
- [x] Run owner release checks.
- [ ] Verify registry installation and the latest tag.

Source version: 0.1.6. SMTP and deployment acceptance remain deferred.
Tools 0.1.9 already matches its published archive and needs no republish.
