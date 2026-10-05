# Platform Core task

## Goal

Close the remaining acceptance gaps before production use.

## Status

Production acceptance remains open. Identity source ownership is implemented; runtime verification remains open.

## Tasks

- [ ] Confirm whether production requires MFA and verified email. Implement the accepted policy.
- [ ] Verify Cxsun administration and settings flows in a browser.
- [ ] Rehearse a Platform package upgrade in a consuming app after a new release.
- [ ] Test real invitation and recovery email delivery, failures, and recovery steps.
- [ ] Verify TLS, proxy, Origin, and cookie behavior in the target deployment.
- [ ] Set and verify retention, account removal, and audit export rules.
- [ ] Verify database protection, backup, restore, and off-site recovery.
- [ ] Check database behavior under concurrent use and document production operations.
- [ ] Refresh Platform repository metadata in MCP and verify the new snapshot.

## Evidence

Record the command or observed behavior for each task. Update `agent/AUDIT.md` with results. Do not mark production work complete from local tests alone.

## Current source state - 2026-10-05

Platform source is version 0.1.5. The authenticated MCP connection returned the deployed 2026-10-05 governance snapshot and Platform repository metadata. Production acceptance tasks above remain open.

## Identity module ownership

- [x] Place user, organization, role, role-permission, permission, user-role, session, settings, and audit behavior in owner folders with the canonical backend files.
- [x] Keep composition, HTTP transport, and business-neutral support separate from owner implementations.
- [x] Route resource requests through module route registrations and module controllers.
- [x] Access sibling-owned data through public provider contracts, including sign-in, invitations, recovery, audit, session revocation, and administration.
- [x] Preserve applied cross-capability migrations under legacy paths and retain owner migrations for newer schema changes.
- [x] Reconcile the identity task list; historical work and evidence remain in agent/AUDIT.md and agent/CHANGELOG.md.
- [x] Run the seven identity source tests after the module ownership refactor.

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
