import type { IdentityRoleProvider } from "./role.provider.js";
export { createIdentityRoleProvider } from "./role.provider.js";
export { identityRolesMigration } from "./role.migration.js";
export { verifyRoles } from "./role.checks.js";
export { customRoleCreateSchema, customRoleUpdateSchema, roleUpdateSchema } from "./role.schema.js";
export type { IdentityRoleProvider };
export type IdentityRoleResolver = IdentityRoleProvider["resolve"];
