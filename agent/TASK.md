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
- [x] Move user/profile administration into user, membership creation into user-role, and system-role permission updates into role.
- [x] Keep request-scoped transactions and audit recording in a shared identity mutation service.
- [x] Keep shared identity composition and HTTP resource dispatch in the identity root.
- [x] Add module provider boundaries and preserve public identity exports.
- [x] Apply CXApp-style flat, prefixed module filenames and owner-local user schemas.
- [x] Add the shared Prettier settings: 100 columns, two spaces, double quotes, semicolons, no trailing commas.
- [x] TypeScript compilation, Prettier check, and `git diff --check` passed.
- [ ] Run identity tests when test execution is requested.

## Identity ownership alignment - 2026-10-05

- [x] Split permission declarations into owner-local schema, service, and repository files.
- [x] Move role-permission rules and writes out of its provider.
- [x] Move user, membership, role, and permission list queries into owner repositories.
- [x] Remove a test helper from the production role export and align the user administration filename.
- [x] Move provider schema checks into an identity repository.
- [x] Confirm the authenticated MCP connection and compile the changed source.
- [ ] Split the remaining identity-wide administration writes into organization, settings, session, and audit owners.
- [ ] Move new schema changes into owner migrations while preserving the applied historical migration sequence.
- [ ] Replace direct cross-owner table reads in the legacy authentication and administration read models with public owner contracts.
- [ ] Run the identity test suite when verification is requested.

## Identity owner extraction - 2026-10-05

- [x] Move organization, settings, session, and audit implementation into owner folders.
- [x] Move HTTP transport, neutral support, and seed ordering into named composition folders.
- [x] Keep applied cross-capability migrations unchanged under `legacy`.
- [x] Give each active owner the canonical provider, migration, repository, schema, routes, controller, seed, service, types, and index files.
- [x] Compile the refactor and check formatting whitespace.
- [x] Route audit target lookups, role and membership audit writes, and role and membership session revocation through owner provider contracts.
- [ ] Replace remaining direct sibling-table access in authentication, roles, memberships, audit targeting, and user lifecycle with public owner contracts.
- [ ] Run identity tests when requested.


## Shared alignment audit - 2026-10-05

Seven tests, build and fresh source consumers passed after seeder, controller binding and browser schema corrections. Source 0.1.5 remains unpublished.

Authenticated live MCP verification passed. See the [alignment audit](D:/codexsun/projects/cxsun/agent/SHARED-ALIGNMENT.md). Version numbers remain unchanged. No release delivery was performed by this audit.
