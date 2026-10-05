# Platform Core task

## Goal

Close the remaining acceptance gaps before production use.

## Status

Planned. No items in this task are complete.

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

## Starting state

The Platform source is version 0.1.2. The authenticated MCP connection succeeds, but the deployed snapshot is dated 2026-10-03 and has no Platform repository metadata. These gaps need fresh evidence.

## Dependency alignment - 2026-10-05

- [x] Align consumed shared packages and common direct dependency versions.
- [x] Install dependencies with lifecycle scripts disabled.
- [x] Keep app dependency ownership and public peer ranges.
- [x] Exclude Veyrezio from this change.

Source version: 0.1.3. Published package archives retain their existing versions.
The baseline is recorded in projects/cxsun/agent/DEPENDENCY-BASELINE.json.

## Identity module organization - 2026-10-05

- [x] Move user, role, user-role, permission, and role-permission code into owner folders.
- [x] Keep shared identity composition and HTTP resource dispatch in the identity root.
- [x] Add module provider boundaries and preserve public identity exports.
- [x] Apply CXApp-style flat, prefixed module filenames and owner-local user schemas.
- [x] Add the shared Prettier settings: 100 columns, two spaces, double quotes, semicolons, no trailing commas.
- [x] TypeScript compilation, Prettier check, and `git diff --check` passed.
- [ ] Run identity tests when test execution is requested.
