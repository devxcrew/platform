import { type DatabaseInfrastructureSchema, HttpError } from "@devxcrew/framework";
import { z } from "zod";
import { IdentityError, createIdentityTenantDirectory } from "../identity/index.js";

import { TenantRepository } from "./tenant.repository.js";
import { TenantService } from "./tenant.service.js";
import { tenantRequestSchema } from "./tenant.schema.js";
import { tenantRoutes } from "./tenant.routes.js";
import type { TenantDatabase, TenantIdentity, TenantProvider } from "./tenant.types.js";
export function createTenantProvider<
  Schema extends DatabaseInfrastructureSchema = DatabaseInfrastructureSchema
>(
  database: TenantDatabase<Schema>,
  identity: TenantIdentity,
  environment: NodeJS.ProcessEnv
): TenantProvider<Schema> {
  const mode = z
    .enum(["single-client", "multi-tenant"])
    .parse(environment.IDENTITY_MODE ?? "single-client");
  const clientId = z
    .string()
    .min(1)
    .parse(environment.IDENTITY_TENANT_ID ?? "default");
  const service = new TenantService<Schema>(
    new TenantRepository(database.database),
    createIdentityTenantDirectory(database.database),
    database,
    mode,
    clientId
  );
  const provider: TenantProvider<Schema> = {
    handle: (request, response, signal) => tenantRoutes(provider, request, response, signal),
    current: () => service.current(),
    verify: () => service.verify(),
    withPrincipal: (...args) => service.withPrincipal(...args),
    async runRequest(request, work, signal) {
      const input = tenantRequestSchema.safeParse({
        portal: request.headers["x-identity-portal"] ?? "user",
        tenantId: request.headers["x-tenant-id"]
      });
      if (!input.success || request.headers["x-tenant-db"] !== undefined)
        throw new HttpError(422, "tenant_context_invalid", "Invalid tenant request context.");
      const principal = await identity
        .authenticateRequest(request, input.data.portal, signal)
        .catch((error) => {
          if (error instanceof IdentityError) {
            const fields = error.fields
              ? Object.fromEntries(
                  Object.entries(error.fields).map(([key, values]) => [key, [...values]])
                )
              : undefined;
            throw new HttpError(error.status, error.code, error.message, fields);
          }
          throw error;
        });
      return service.withPrincipal(principal, input.data.tenantId, work, signal);
    }
  };
  return provider;
}
