import { z } from "zod";
import { resourceIdSchema, identityKeySchema } from "../identity.schema.js";

const name = z.string().trim().min(1).max(100);
const expectedVersion = z.number().int().min(0);

export const roleUpdateSchema = z
  .object({
    permissionIds: z.array(resourceIdSchema).max(100),
    expectedVersion
  })
  .strict();

export const customRoleCreateSchema = z
  .object({
    name,
    permissionIds: z.array(resourceIdSchema).max(100),
    tenantId: identityKeySchema.optional()
  })
  .strict();

export const customRoleUpdateSchema = z
  .object({
    name: name.optional(),
    permissionIds: z.array(resourceIdSchema).max(100).optional(),
    active: z.boolean().optional(),
    expectedVersion
  })
  .strict()
  .refine((input) => Object.keys(input).length > 1, "Provide a changed field.");
