import { z } from "zod";
import { identityKeySchema } from "../support/identity.schema.js";
import { permissionIdsSchema } from "../role-permission/role-permission.schema.js";

const name = z.string().trim().min(1).max(100);
const expectedVersion = z.number().int().min(0);

export const roleUpdateSchema = z
  .object({
    permissionIds: permissionIdsSchema,
    expectedVersion
  })
  .strict();

export const customRoleCreateSchema = z
  .object({
    name,
    permissionIds: permissionIdsSchema,
    tenantId: identityKeySchema.optional()
  })
  .strict();

export const customRoleUpdateSchema = z
  .object({
    name: name.optional(),
    permissionIds: permissionIdsSchema.optional(),
    active: z.boolean().optional(),
    expectedVersion
  })
  .strict()
  .refine((input) => Object.keys(input).length > 1, "Provide a changed field.");
