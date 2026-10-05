import { z } from "zod";
import { identityKeySchema } from "./identity.schema.js";

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

const name = z.string().trim().min(1).max(100);
const expectedVersion = z.number().int().min(0);

export const organizationCreateSchema = z
  .object({
    id: identityKeySchema,
    name,
    active: z.boolean().default(true)
  })
  .strict();

export const organizationUpdateSchema = z
  .object({
    name: name.optional(),
    active: z.boolean().optional(),
    expectedVersion
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1, "Provide a changed field.");

export const settingsSchema = z
  .object({
    displayName: name,
    expectedVersion,
    locale: z.enum(["en", "en-US", "en-GB"]),
    timeZone: z
      .string()
      .max(100)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, "Use a supported IANA time zone.")
  })
  .strict();

export const securitySettingsSchema = z
  .object({
    sessionSeconds: z.number().int().min(300).max(86400),
    expectedVersion
  })
  .strict();

export type IdentityListQuery = z.infer<typeof listSchema>;
export type IdentityResource =
  "users" | "organizations" | "memberships" | "roles" | "permissions" | "sessions" | "audit-events";
