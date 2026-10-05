import { z } from "zod";
export const tenantRequestSchema = z.strictObject({
  portal: z.enum(["user", "admin", "super-admin"]).default("user"),
  tenantId: z.string().trim().min(1).max(255).optional()
});
export const tenantMappingSchema = z
  .strictObject({
    tenantId: z.string().min(1),
    driver: z.enum(["sqlite", "mariadb"]),
    databaseName: z
      .string()
      .regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/)
      .nullable(),
    sqlitePath: z.string().trim().min(1).nullable(),
    active: z.number().int().min(0).max(1),
    version: z.number().int().min(1)
  })
  .superRefine((value, context) => {
    if (value.driver === "mariadb" && !value.databaseName)
      context.addIssue({
        code: "custom",
        path: ["databaseName"],
        message: "Database name is required."
      });
    if (value.driver === "sqlite" && !value.sqlitePath)
      context.addIssue({
        code: "custom",
        path: ["sqlitePath"],
        message: "Database path is required."
      });
  });
