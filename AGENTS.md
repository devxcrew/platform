# Platform Core owner

Platform Core owns identity, sessions, role permissions, and tenant membership.
Keep all identity implementations inside `src/modules/identity`.
Applications consume intentional public exports from `src/index.ts`.

Retrieve current workspace rules from `https://mcp.codexsun.com/mcp` using `npm run mcp:connect` before edits.
Use `npm run mcp:verify` to check authenticated repository metadata, required resources, and tools.
Stop and report a failed connection. Never use a local listener, guide file, or cached snapshot as
an app instruction source. The local listener is for governance development only.
Follow `governance://code-standard`, including the exact canonical module filenames, public provider
boundary, and mandatory backend controller flow. Keep code and user-facing language consistent
with the published cloud guidance.
Use Zod for server inputs. Do not move identity engines into consuming apps.

Keep secrets and database files out of Git. Do not publish or push without user authorization.
Run `npm test` and `npm run build`. Record evidence in `agent/TASK.md` and `agent/AUDIT.md`.
