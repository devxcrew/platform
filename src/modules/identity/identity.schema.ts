import { z } from "zod";
export const portalSchema = z.enum(["user", "admin", "super-admin"]);
export const identityKeySchema = z
  .string()
  .regex(/^[a-zA-Z0-9._-]{1,100}$/)
  .refine(
    (value) => !/^\.+$/.test(value),
    "Use an identifier with a letter or number.",
  );
export const loginSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((value) => value.trim().toLowerCase()),
    password: z.string().min(1).max(256),
    tenantId: identityKeySchema.optional(),
  })
  .strict();
export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1).max(256),
    password: z.string().min(12).max(256),
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
    tenantId: identityKeySchema,
  })
  .strict();
