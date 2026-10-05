import { z } from "zod";

const name = z.string().trim().min(1).max(100);
export const settingsSchema = z
  .object({
    displayName: name,
    expectedVersion: z.number().int().min(0),
    locale: z.enum(["en", "en-US", "en-GB"]),
    timeZone: z
      .string()
      .max(100)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, "Use a supported IANA time zone.")
  })
  .strict();
export const securitySettingsSchema = z
  .object({
    sessionSeconds: z.number().int().min(300).max(86400),
    expectedVersion: z.number().int().min(0)
  })
  .strict();
