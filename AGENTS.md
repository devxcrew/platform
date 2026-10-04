# Platform Core owner

Platform Core owns identity, sessions, role permissions, and tenant membership.
Keep all identity implementations inside `src/modules/identity`.
Applications consume intentional public exports from `src/index.ts`.

Retrieve current workspace rules from https://mcp.codexsun.com/mcp using npm run mcp:connect before edits.
The package now connects with APP_ID=platform. Deployed repository metadata registration remains pending.
A successful instruction connection does not prove that cloud repository metadata has been deployed.
Follow the live module architecture, validation, and provider contracts.
Use Zod for server inputs. Do not move identity engines into consuming apps.

Keep secrets and database files out of Git. Do not publish or push without user authorization.
Run `npm test` and `npm run build`. Record evidence in `agent/TASK.md` and `agent/AUDIT.md`.
