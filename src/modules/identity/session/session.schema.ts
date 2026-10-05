import { z } from "zod";
import { identityKeySchema } from "../support/identity.schema.js";

export const loginSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((value) => value.trim().toLowerCase()),
    password: z.string().min(1).max(256),
    tenantId: identityKeySchema.optional()
  })
  .strict();
