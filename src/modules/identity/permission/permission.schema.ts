import { z } from "zod";
import { portalSchema } from "../support/identity.schema.js";

export const permissionDeclarationSchema = z
  .object({
    owner: z
      .string()
      .regex(/^[a-z][a-z0-9-]{0,63}$/)
      .refine((value) => !["identity", "desk"].includes(value)),
    permissions: z
      .array(
        z
          .object({
            id: z
              .string()
              .regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*){2,8}$/)
              .max(250),
            portals: z.array(portalSchema).min(1).max(3),
            label: z
              .string()
              .trim()
              .min(1)
              .max(100)
              .regex(/^[^\x00-\x1f\x7f]+$/)
              .optional()
          })
          .strict()
      )
      .min(1)
      .max(100)
  })
  .strict();

export type IdentityPermissionDeclaration = z.input<typeof permissionDeclarationSchema>;
