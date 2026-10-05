export { createIdentityUserRoleProvider } from "./user-role.provider.js";
export type { IdentityUserRoleProvider } from "./user-role.provider.js";
export { protectAdministrators } from "./user-role.policy.js";
export {
  membershipDeleteQuerySchema,
  membershipSchema,
  membershipUpdateSchema
} from "./user-role.schema.js";
export { seedMemberships } from "./user-role.seed.js";
export { userRoleResource } from "./user-role.routes.js";
export type { IdentityMembershipRow } from "./user-role.types.js";
export { IdentityUserRoleController } from "./user-role.controller.js";
