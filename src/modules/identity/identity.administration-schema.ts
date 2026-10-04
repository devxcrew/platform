import { z } from "zod";
import { identityKeySchema } from "./identity.schema.js";

export const resourceIdSchema = z
  .string()
  .regex(/^[a-zA-Z0-9._~-]{1,300}$/)
  .refine(
    (value) => !/^\.+$/.test(value),
    "Use an identifier with a letter or number.",
  );
export const listSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).default(""),
    sort: z.enum(["id", "name", "email"]).default("id"),
    direction: z.enum(["asc", "desc"]).default("asc"),
  })
  .strict();
export const resourceListQuerySchema = listSchema
  .omit({ perPage: true })
  .extend({ per_page: listSchema.shape.perPage })
  .strict()
  .transform(({ per_page, ...input }) => ({ ...input, perPage: per_page }));
export const membershipDeleteQuerySchema = z
  .object({
    expectedVersion: z
      .string()
      .regex(/^(0|[1-9][0-9]{0,9})$/)
      .transform(Number),
  })
  .strict();
const name = z.string().trim().min(1).max(100);
const email = z
  .email()
  .max(254)
  .transform((v) => v.trim().toLowerCase());
export const userCreateSchema = z
  .object({
    name,
    email,
    password: z.string().min(12).max(256),
    roleId: resourceIdSchema.default("user"),
    tenantId: identityKeySchema.optional(),
  })
  .strict();
const expectedVersion = z.number().int().min(0);
export const userUpdateSchema = z
  .object({
    name: name.optional(),
    email: email.optional(),
    active: z.boolean().optional(),
    expectedVersion,
  })
  .strict()
  .refine((v) => Object.keys(v).length > 1, "Provide a changed field.");
export const organizationCreateSchema = z
  .object({ id: identityKeySchema, name, active: z.boolean().default(true) })
  .strict();
export const organizationUpdateSchema = z
  .object({
    name: name.optional(),
    active: z.boolean().optional(),
    expectedVersion,
  })
  .strict()
  .refine((v) => Object.keys(v).length > 1, "Provide a changed field.");
export const membershipSchema = z
  .object({
    userId: identityKeySchema,
    tenantId: identityKeySchema.optional(),
    roleId: resourceIdSchema,
  })
  .strict();
export const roleUpdateSchema = z
  .object({
    permissionIds: z.array(resourceIdSchema).max(100),
    expectedVersion,
  })
  .strict();
export const profileSchema = z.object({ name, expectedVersion }).strict();
export const customRoleCreateSchema = z
  .object({
    name,
    permissionIds: z.array(resourceIdSchema).max(100),
    tenantId: identityKeySchema.optional(),
  })
  .strict();
export const customRoleUpdateSchema = z
  .object({
    name: name.optional(),
    permissionIds: z.array(resourceIdSchema).max(100).optional(),
    active: z.boolean().optional(),
    expectedVersion,
  })
  .strict()
  .refine((input) => Object.keys(input).length > 1, "Provide a changed field.");
export const membershipUpdateSchema = z
  .object({ roleId: resourceIdSchema, active: z.boolean(), expectedVersion })
  .strict();
export const settingsSchema = z
  .object({
    displayName: name,
    expectedVersion,
    locale: z.enum(["en", "en-US", "en-GB"]),
    timeZone: z
      .string()
      .max(100)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }, "Use a supported IANA time zone."),
  })
  .strict();
export const securitySettingsSchema = z
  .object({
    sessionSeconds: z.number().int().min(300).max(86400),
    expectedVersion,
  })
  .strict();
export type IdentityListQuery = z.infer<typeof listSchema>;
export type IdentityResource =
  | "users"
  | "organizations"
  | "memberships"
  | "roles"
  | "permissions"
  | "sessions"
  | "audit-events";
