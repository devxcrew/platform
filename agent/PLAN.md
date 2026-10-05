# Platform Core plan

## Goal

Finish the open checks for Platform Core before production use.

## Plan

1. Confirm the required sign-in policy, including MFA and email verification.
2. Verify Cxsun administration and settings in a browser.
3. Rehearse a package upgrade in a consuming app when a new Platform release is available.
4. Verify invitation and recovery email delivery and failure handling.
5. Verify TLS, proxy, Origin, and cookie behavior in the target deployment.
6. Set data retention, account removal, and audit export rules.
7. Verify database protection, backup, restore, and recovery.
8. Check database behavior under concurrent use and document production operations.
9. Refresh Platform metadata in MCP and verify the deployed guidance.

## Completion rule

Record evidence for each step in `agent/TASK.md` and `agent/AUDIT.md`. Keep a step open until its evidence passes. Local tests do not count as production acceptance.
