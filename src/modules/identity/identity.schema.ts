import { z } from "zod";

export const portalSchema = z.enum(["user", "admin", "super-admin"]);
export const identityKeySchema = z
  .string()
  .regex(/^[a-zA-Z0-9._-]{1,100}$/)
  .refine((value) => !/^\.+$/.test(value), "Use an identifier with a letter or number.");
export const resourceIdSchema = z
  .string()
  .regex(/^[a-zA-Z0-9._~-]{1,300}$/)
  .refine((value) => !/^\.+$/.test(value), "Use an identifier with a letter or number.");
