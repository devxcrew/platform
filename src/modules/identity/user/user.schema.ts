import { z } from "zod";
import { identityKeySchema, portalSchema, resourceIdSchema } from "../support/identity.schema.js";

export { identityKeySchema, portalSchema } from "../support/identity.schema.js";

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1).max(256),
    password: z.string().min(12).max(256)
  })
  .strict();

export const accountSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    name: z.string().trim().min(1).max(100),
    password: z.string().min(12).max(256),
    portal: portalSchema,
    tenantId: identityKeySchema
  })
  .strict();

const userName = z.string().trim().min(1).max(100);
const userEmail = z
  .email()
  .max(254)
  .transform((value) => value.trim().toLowerCase());
const expectedVersion = z.number().int().min(0);

export const userCreateSchema = z
  .object({
    name: userName,
    email: userEmail,
    password: z.string().min(12).max(256),
    roleId: resourceIdSchema.default("user"),
    tenantId: identityKeySchema.optional()
  })
  .strict();

export const userUpdateSchema = z
  .object({
    name: userName.optional(),
    email: userEmail.optional(),
    active: z.boolean().optional(),
    expectedVersion
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1, "Provide a changed field.");

export const profileSchema = z.object({ name: userName, expectedVersion }).strict();
