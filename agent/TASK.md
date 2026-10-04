# Current task

## Initial GitHub delivery - 2026-10-04

The user authorized creation of devxcrew/platform, the initial commit, and push to main.
Version stays 0.1.0. GitHub delivery does not close npm publication or production acceptance.
CI runs the package verification command from a clean checkout.
Local release checks and remote delivery evidence appear in AUDIT.md.

<!-- foundation-checklist:start -->

## Numbered phase checklist

Master: [all foundation tasks](D:/codexsun/projects/cxsun/agent/CHECKLIST.md).

Updated: 2026-10-04. Checked steps have recorded local evidence.
Parents retain incomplete acceptance gates. Mail tests and production deployment are deferred by user.

### Phase 01 - Baseline and ownership

- [x] **01.02 Establish Platform owner and baseline** - accepted. Owner: platform.
  - [x] 01.02.1 Independent MCP and local Git boundary verified.

### Phase 02 - Public contracts and release scope

- [ ] **02.02 Define identity resource and permission contracts** - in-review. Owner: platform.
  - [x] 02.02.1 Schemas, resource APIs and scoped custom roles implemented.
  - [x] 02.02.2 Supported local resource/action matrix and password-only policy documented from actual providers.
  - [ ] 02.02.3 Production account/MFA policy acceptance - deferred by user.
  - [x] 02.02.4 Register app-qualified module permission declarations through a public provider, without automatic grants.

### Phase 03 - Backend and live persistence

- [ ] **03.04 Implement identity masters and role assignment** - in-review. Owner: platform.
  - [x] 03.04.1 Users, organizations, memberships and scoped custom roles work in file-backed tests.
  - [ ] 03.04.2 Verify all authorized master flows in Cxsun browser and accept resource matrix.
- [ ] **03.05 Implement sessions, invitations, recovery and audit** - in-review. Owner: platform.
  - [x] 03.05.1 Token rules, recovery role revalidation, revocation and audit tests pass.
  - [ ] 03.05.2 Verify real lifecycle delivery and approved retry/account policy.
- [ ] **03.06 Implement organization, app and security settings** - in-review. Owner: platform.
  - [x] 03.06.1 Typed settings, revision conflicts and presentation effects tested.
  - [ ] 03.06.2 Verify settings browser flows and final supported settings matrix.
- [ ] **03.07 Harden authentication and scope boundaries** - in-review. Owner: platform.
  - [x] 03.07.1 Origin, portal/app/tenant scope and role-loss recovery regressions pass.
  - [x] 03.07.2 Local threat review and password-only supported profile documented. MFA is not implemented.
  - [ ] 03.07.3 Production MFA/account-policy and cookie/proxy acceptance - deferred by user.

### Phase 06 - Verification and operations

- [ ] **06.02 Verify persistence, mutations and security** - in-review. Owner: platform.
  - [x] 06.02.1 Four expanded file-backed suites cover restart, scope and recovery regressions.
  - [x] 06.02.2 Concurrent invitation/recovery single-claim and expired-token regressions pass.
  - [ ] 06.02.7 Final production operational acceptance - deferred by user.

<!-- foundation-checklist:end -->

## Earlier task records

## Platform Core foundation implementation

Date: 2026-10-04
Master: D:/codexsun/projects/cxsun/agent/PLAN.md.
Owner plan: agent/PLAN.md.

## Current independent review - 2026-10-04

Passed: authenticated MCP connection, `npm test` with four tests, and `npm run build`.
03.05 and 03.07: in-review after verified current-policy revalidation during recovery token completion.
06.02: in-review. Current suites now cover recovery after custom-role disable and permission removal.
02.02: in-review. Recovery requires identity.password. Complete frontend/backend matrix acceptance remains open.
Release preparation: planned. Add standard maintenance and release-check scripts before package publication.
The deployed MCP snapshot still returns null Platform repository metadata.
This review corrected recovery policy and its tests. No operational database, publication, commit or deployment changed.

| Task  | Current state                                                                                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01.02 | Independent cloud guidance passes. Deployed owner metadata remains pending. Coordinator initialized an independent local Git repository. No remote or publication exists. |
| 02.02 | Resource contracts and browser-safe Zod schema exports implemented for the current wave.                                                                                  |
| 03.04 | Users, organizations, membership role/status editing, protected system roles and scoped custom user roles implemented.                                                    |
| 03.05 | Sessions, invitation issue/list/detail/resend/revoke/accept, recovery, and audit implemented. Real email delivery evidence remains pending.                               |
| 03.06 | Organization, application and security settings implemented with typed fields and record revisions.                                                                       |
| 03.07 | Origin enforcement, role/tenant/app scope, last-administrator guards, bounded tokens, and stale-write rejection implemented.                                              |
| 06.02 | File-backed HTTP, migration repeat, close/reopen persistence, session policy and mutation checks pass. Broader operational acceptance remains pending.                    |

## Public composition

Applications register `identityMigration`, then `identityAdministrationMigration` under distinct migration names.
Use `createIdentityProvider(database, environment, { delivery })` for the injected email provider.
Missing delivery returns HTTP 503. Tests use an explicit test provider and do not prove external delivery.
The public browser schema entry is `@devxcrew/platform/identity/schemas`.
PATCH requests require `expectedVersion`. GET records return `version`. Stale writes return HTTP 409.
The optional third `handle` argument is a request AbortSignal. Cancellation checks cooperate at mutation boundaries.

## Evidence and limits

Build and acceptance tests use separate file-backed SQLite. No operational database changed in this owner task.
The HTTP suite checks resource access, denied privilege escalation, last-administrator retention, SQL pagination,
settings, invitation/recovery tokens, delivery failure, audit scope, concurrent profile writes, and restart persistence.
The operational Cxsun database migration and live browser acceptance belong to the coordinating app task.
No package publication, Git initialization, commit, push, or deployment occurred in this owner task.

## Remaining release work

Complete explicit policy catalogs and broader release acceptance requirements from the master.
Verify external delivery, token expiry/revocation concurrency, cross-process SQLite contention, backup/restore, and production deployment.
Publish versioned packages and deployed governance metadata only through the authorized coordinated release.

## Custom role and presentation completion

Register `identityRolesMigration` after the administration migration. Existing applied migrations remain unchanged.
Custom roles belong to one app and organization. They use the user portal and an explicit permission set.
Keep `desk.user`. Custom roles cannot grant administration or another portal desk.
Profile requires `identity.self`. Password changes require `identity.password`.
Role and membership changes revoke affected app sessions. Inactive memberships or roles deny login.
Membership DELETE requires the current `expectedVersion` query value. Stale confirmations return HTTP 409.
Wire collections use `per_page`. Responses use `current_page`, `per_page`, `total`, and `last_page` metadata.
Unsupported sort fields return HTTP 422. Dot-only identifiers fail validation.
Authenticated presentation returns app name, organization name, locale and time zone.
Organization locale/time zone overrides app settings. App defaults use APP_NAME, en and UTC.
Final build and three expanded acceptance tests passed. Cross-app custom-role reads and mutations fail.

## Final correction evidence

The role migration DOWN refuses removal of custom or inactive access restrictions. Restore a compatible snapshot instead.
Applied UP source stays unchanged. Two file-backed rollback checks prove refusal and row preservation.
Public GET `/api/v1/identity/:portal/configuration` exposes app name and organization-input mode only.
Multi-tenant login and recovery require an organization ID on the server as well as the form.
Final build and four acceptance tests passed. Coordinator repackaging and browser checks remain the final integration step.

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
