# Changelog

## Version State

Current version: 0.1.6

Release tag: v-0.1.6

Changelog label: v 0.1.6

## Unreleased

### 0.1.6 - 2026-10-05 19:21

- Move generic database and settings behavior into Framework and tenant behavior into Platform.
- Connect Cxsun through public exports and recorded development packages.
- Preserve migration history and current tenant mappings.
- Verify owner tests, app build, identity acceptance and live MariaDB fault checks.
- Verify a fresh offline Cxsun installation from recorded packages without shared source imports.
- Keep release versions unchanged. This work is not committed, pushed or published.

## v-0.1.6

### [v 0.1.6] 2026-10-05 7:35 pm - Extract module-owned tenancy

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Platform owns tenant mappings, scope middleware and provisioning through public Framework and identity contracts. Verify passed: 27 tests, build and package dry run. CI now checks out and builds its sibling Framework dependency.

### [v 0.1.6] 2026-10-05 3:46 pm - Complete identity module ownership

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Move identity behavior, routes, and tests into owner modules and use public provider contracts.
- Clean the compiled output before TypeScript builds so package archives exclude removed modules.

## v-0.1.5

### [v 0.1.5] 2026-10-05 12:50 pm - Keep runtime logs outside Git

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Remove generated governance output from source tracking and ignore runtime logs. Identity verification evidence remains in agent audit records.

### [v 0.1.5] 2026-10-05 12:46 pm - Align identity ownership and transport boundaries

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Record identity module refactor, seeder import, controller binding and browser schema isolation fixes; seven tests and source consumers passed.

### [v 0.1.5] 2026-10-05 9:40 am - Fix identity test exports

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Import identity schemas from their owning public modules.

## v-0.1.4

### [v 0.1.4] 2026-10-05 9:30 am - Refine identity module ownership

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Complete owner-local identity updates and close test authorization gaps.

## v-0.1.3

### [v 0.1.3] 2026-10-05 8:44 am - Align workspace packages

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Align maintenance tooling with @devxcrew/tools@0.1.8 and record the verified workspace package set.

## v-0.1.2

### [v 0.1.2] 2026-10-04 6:13 pm - Public MIT foundation release

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Prepare a new version after npm rejected the previously unpublished 0.1.1 version.

## v-0.1.1

### Local completion preparation - 2026-10-04

- Reconcile task status and preserve historical evidence.
- Apply the user-selected MIT license to first-party code and packed metadata.
- Add or expand isolated Windows, Linux and macOS source CI.
- npm run release:check passed six file-backed identity tests, build and a 59-file MIT package. The 1,000-row list benchmark maximum was 7.3 ms, below its 1,000 ms local budget.
- Publication and external acceptance gates remain open.


### [v 0.1.1] 2026-10-04 5:00 pm - Record Platform source delivery

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Record the public identity owner, permission declarations and labels, additive migrations and verified GitHub source delivery.

## v-0.1.0

### [v 0.1.0] 2026-10-04 4:49 pm - Initial Platform source release

#### Database Changes

- Database update: Yes (manual).

#### App Codebase Changes

- Prepare the shared identity owner, public permission extensions, additive migrations, verification records and GitHub CI.

### [v 0.1.0] 2026-10-04 10:00 am - Prepare identity foundation

Create the Platform Core identity owner with Kysely migrations, safe seeds, scrypt passwords, scoped sessions, RBAC, tenancy, and HTTP endpoints.
Prepare public provider exports and Cxsun frontend integration.
Record passing initial package tests and build. Application connection remains pending the package-source choice.

## 0.1.0 - 2026-10-04 10:19

Connect the verified identity owner to Cxsun through the approved bundled @devxcrew/platform package.
Fix blank optional seed names, body-size handling, and trailing-slash desk guards. Add the module public entry point.
Passed package tests/build and compiled Cxsun identity smoke. Browser and normal local database checks passed.
Package publication, live registration, and production operational verification remain pending.

## Unreleased release preparation - 2026-10-04

Add public Tools maintenance scripts, release metadata and package checks. Verify token races, token expiry and 1000-row list/count budget.

## Unreleased module permission extensions - 2026-10-04

Add public app-qualified owner declarations, protected portal assignment, scoped principal enforcement and additive migration. Five tests and release:check pass.

## Unreleased request authentication boundary - 2026-10-04

Expose authenticateRequest through the identity provider. Verify real HTTP cookie, portal, Origin and cancellation behavior.

## Unreleased public error contract - 2026-10-04

Export module-owned IdentityError with safe status, message and optional copied fields. Preserve identity transport behavior.

## Unreleased permission catalog presentation - 2026-10-04

Expose owner labels and allowed portals. Add label migration without rewriting applied declaration UP.


## Unreleased alignment - 2026-10-05

Seven tests, build and fresh source consumers passed after seeder, controller binding and browser schema corrections. Source 0.1.5 remains unpublished.

Authenticated live MCP verification passed. See the [alignment audit](D:/codexsun/projects/cxsun/agent/SHARED-ALIGNMENT.md). Version numbers remain unchanged. No release delivery was performed by this audit.
