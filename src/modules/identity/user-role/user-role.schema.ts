import { z } from "zod";
import { identityKeySchema, resourceIdSchema } from "../support/identity.schema.js";

const expectedVersion = z.number().int().min(0);

export const membershipDeleteQuerySchema = z
  .object({
    expectedVersion: z
      .string()
      .regex(/^(0|[1-9][0-9]{0,9})$/)
      .transform(Number)
  })
  .strict();

export const membershipSchema = z
  .object({
    userId: identityKeySchema,
    tenantId: identityKeySchema.optional(),
    roleId: resourceIdSchema
  })
  .strict();

export const membershipUpdateSchema = z
  .object({
    roleId: resourceIdSchema,
    active: z.boolean(),
    expectedVersion
  })
  .strict();
