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
