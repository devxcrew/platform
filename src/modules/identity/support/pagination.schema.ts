import { z } from "zod";
export { organizationCreateSchema, organizationUpdateSchema } from "../organization/organization.schema.js";
export { settingsSchema, securitySettingsSchema } from "../settings/settings.schema.js";

export const listSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).default(""),
    sort: z.enum(["id", "name", "email"]).default("id"),
    direction: z.enum(["asc", "desc"]).default("asc")
  })
  .strict();

export const resourceListQuerySchema = listSchema
  .omit({ perPage: true })
  .extend({ per_page: listSchema.shape.perPage })
  .strict()
  .transform(({ per_page, ...input }) => ({ ...input, perPage: per_page }));

export type IdentityListQuery = z.infer<typeof listSchema>;
export type IdentityResource =
  | "users"
  | "organizations"
  | "memberships"
  | "roles"
  | "permissions"
  | "sessions"
  | "audit-events";
