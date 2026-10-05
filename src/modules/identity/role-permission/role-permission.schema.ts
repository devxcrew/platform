import { z } from "zod";
import { resourceIdSchema } from "../support/identity.schema.js";

export const permissionIdsSchema = z.array(resourceIdSchema).max(100);
