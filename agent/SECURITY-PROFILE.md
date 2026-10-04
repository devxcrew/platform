# Identity security and privacy operating profile

Updated: 2026-10-04. Scope: current local foundation. This document does not certify a production deployment.

## Supported authentication

Passwords use salted scrypt. Sessions and lifecycle tokens store hashes, never raw tokens.
Three portals require explicit memberships and current permissions. Session lookup repeats active-account and role checks.
Unsafe requests require the configured Origin. External HTTP origins are rejected. HTTPS cookies use Secure, HttpOnly and SameSite=Strict.
MFA, WebAuthn and verified-email enforcement are not implemented. Production requiring these controls cannot use this release unchanged.
The current password-only profile is accepted for local foundation verification. Production account policy needs explicit release acceptance.

## Expiry and revocation

Recovery links expire after 30 minutes. Invitation links expire after 24 hours. Links require successful delivery and allow one claim.
Sessions expire using the configured app policy. Editable sessionSeconds ranges from 300 to 86400 seconds.
Password, role and membership changes revoke affected sessions. Existing sessions recheck access on each lookup.
Concurrent invitation/recovery claims and expired recovery denial pass file-backed tests.

## Retention status

Expired sessions are removed when sessions are issued. Expired throttle rows are removed during throttle updates.
Consumed/expired lifecycle tokens and audit rows have no scheduled retention cleanup in this version.
There is no user erasure, anonymization, legal hold or audit export policy implementation.
Do not describe token expiry as record deletion. Expired records can still contain names and email addresses.
The production owner must approve retention periods, lawful audit preservation and account erasure before production acceptance.
A future cleanup job must be module-owned, scoped, tested and explicit. Do not silently delete operational data.

## Logs and audit

Identity audit records contain actor, tenant, action, target and timestamps. They are protected by scoped permissions.
API responses exclude password/session/token hashes. Transport errors expose safe messages.
The identity provider does not emit passwords, raw tokens, email message bodies or credentials to console logs.
Consumers must redact Cookie, Authorization, password, token and provider credentials in application and reverse-proxy logs.
Consumer log retention and access controls remain deployment acceptance gates. No durable log transport is supplied here.

## SQLite and backups

The application owns the file-backed database and backup/restore process. Platform owns its identity migrations and records.
SQLite database and backup files are not encrypted by this package. Protect them with restricted filesystem permissions and encrypted host storage.
Backups contain personal data and credential hashes. Keep them outside Git and frontend artifacts.
The production owner must select backup frequency, recovery targets, encryption, access and retention.
Verify a restored copy before recovery. Never downgrade role migrations in a way that removes active restrictions.
Local Cxsun backup and restore evidence belongs to its app audit. It does not prove off-host disaster recovery.

## Production release gates

- [ ] Approve the password-only profile or implement required MFA and email verification.
- [ ] Verify proxy origin, TLS and cookie behavior in the actual deployment.
- [ ] Approve token, audit, application-log and backup retention.
- [ ] Verify real email delivery and failure operations.
- [ ] Verify encrypted storage, restricted backup access and off-host recovery targets.

No operational records were removed, no policy was silently assumed and no external services were configured.
