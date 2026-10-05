import { z } from "zod";
import { portalSchema } from "./user.schema.js";
import { resourceIdSchema } from "../identity.schema.js";
export const invitationSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((v) => v.trim().toLowerCase()),
    name: z.string().trim().min(1).max(100),
    roleId: portalSchema.default("user"),
    tenantId: resourceIdSchema.optional()
  })
  .strict();
export const recoverySchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((v) => v.trim().toLowerCase()),
    tenantId: resourceIdSchema.optional()
  })
  .strict();
export const tokenCompletionSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    password: z.string().min(12).max(256)
  })
  .strict();
