# Platform Core owner plan

Date: 2026-10-04
Status: Resource wave and recovery correction verified locally. Release acceptance remains open.
Master: D:/codexsun/projects/cxsun/agent/PLAN.md.

## Purpose and phase numbering

### Current review - 2026-10-04

Authenticated MCP retrieval, `npm test` with four file-backed acceptance tests, and `npm run build` pass.
Tasks 03.05 and 03.07 return to in-review after the recovery policy correction below.
At token completion, recheck current custom-role app scope, active state and the agreed recovery permission policy inside the transaction.
Implemented and verified: issuance and completion require the current scoped identity.password permission.
Both disabled-role and removed-permission regressions pass. Reassignment and deployment acceptance remain open.
Verify a token issued before role disable, permission removal or reassignment cannot bypass the new policy.
Keep 06.02 in-review until those regressions and broader operational acceptance pass.
Add standard owner maintenance and a release-check command before coordinated publication.
The manifest currently lacks version, line-ending and Git delivery commands required by workspace maintenance rules.
Historical browser evidence covers earlier portal flows. It does not accept current administration and custom-role screens.
This review corrected recovery authorization. No release version or operational migration changed.

Use the master phase numbers and task IDs below. Do not restart numbering locally.
Keep business code module-owned and communicate through public providers.
Retrieve authenticated owner guidance before implementation.
Use live file-backed SQLite for persistence acceptance. Use separate files for destructive tests.
Record actual check results in TASK.md and AUDIT.md.

### 8.2 Platform Core — shared/platform

Purpose: shared identity, authorization, organization scope, masters and settings.
Legacy references: A01, C02, C07, P01-P09, DB01-DB05.

| ID | Work | Acceptance |
| --- | --- | --- |
| 01.02 | Restore owner MCP connection and audit current identity implementation | Authenticated owner guidance before source work |
| 02.02 | Specify every resource in section 5, field schemas, actions, permissions and scope | Complete frontend/backend contract matrix |
| 03.04 | Implement users, organizations, memberships, roles and permission catalog/assignment | Live SQLite lists, details and allowed upserts work |
| 03.05 | Implement sessions, invitations, recovery, audit and account/security policies | Revocation, token expiry, abuse controls and denied operations verified |
| 03.06 | Implement supported settings with versioned schemas and safe defaults | No arbitrary setting keys or exposed secrets |
| 03.07 | Refine passwords, cookies, scope, CSRF/origin protections and tenant boundaries | Direct API bypass, escalation and cross-scope access fail |
| 06.02 | Verify migrations, repeat seeds, concurrent mutations, restart persistence and audit | File-backed evidence with protected operational data |

## Dependencies and acceptance

The initial audit found an in-memory acceptance gap. Current tests use a separate SQLite file and verify reopen persistence.
The initial audit found no independent Git repository. The coordinator now initialized a local main repository. Remote release ownership remains open.
Task 06.02 must add file-backed migration, restart, persistence and mutation evidence before release acceptance.
Existing in-memory test success is limited historical coverage, not proof of the required live release profile.

Phase 01 establishes the actual baseline before implementation.
Phase 02 defines public contracts before backend and frontend tasks.
The coordinator reviews actual changes and verifies combined behavior in Cxsun.
Task states: planned, ready, active, in-review, changes-required, blocked, accepted.
Release preparation does not authorize commit, push, deployment or publication.

## Prior owner records

# Plan

1. Implement and verify the shared identity owner.
2. Completed: connect Cxsun through its approved bundled package snapshot.
3. Completed: audit browser flows, HTTP identity, and application isolation.
4. Register the package with live governance and publish during an authorized release.
5. Add recovery, MFA, and administration only through separately approved requirements.

# Current task

Implement database-backed identity for Cxsun through shared Platform Core.

Passed: live Cxsun MCP instruction retrieval before work.
Passed: Platform Core build and three tests, including real SQLite HTTP identity integration.
Passed: hashes, three portals, role denial, app scope, tenant membership, rotation, logout, password change, expiry, throttling, and input validation.

Completed: user-approved bundled @devxcrew/platform@0.1.0 connection to Cxsun.
Passed: Cxsun verification, compiled identity HTTP smoke, and three local bootstrap account logins.
Passed: browser three-portal flows, role denial, refresh, logout, and a fresh pass with no console errors.
Pending: independent live governance registration, package publication, and production operational checks.
No package publication, Git commit, or push was requested.

## Current completion boundary

Supported custom user roles and membership role/status edits now pass file-backed acceptance.
Applied migrations remain immutable. The coordinator applies the new role migration after the administration migration.
TASK and AUDIT record exact APIs, current tests, and remaining release gates.

## Task checkbox tracking

Use [owner phase checklist](TASK.md) for current checkboxes and numbered substeps.
Use [master checklist](D:/codexsun/projects/cxsun/agent/CHECKLIST.md) for all owners and shared release gates.
Keep task IDs unchanged. Check a parent only after all its acceptance criteria pass.

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


## Current execution - 2026-10-04

Local checks and the three-OS source CI passed. The MIT package 0.1.2 is published; Cxsun registry consumer verification is in progress. See TASK.md for current checkboxes and AUDIT.md for evidence. Earlier evidence remains historical.
