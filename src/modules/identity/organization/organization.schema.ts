import { z } from "zod";
import { identityKeySchema } from "../support/identity.schema.js";

const name = z.string().trim().min(1).max(100);
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
    expectedVersion: z.number().int().min(0)
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1, "Provide a changed field.");
