import type { DatabaseInfrastructureSchema } from "@devxcrew/framework";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { TenantProvider } from "./tenant.types.js";
import { tenantController } from "./tenant.controller.js";
export function tenantRoutes<Schema extends DatabaseInfrastructureSchema>(
  provider: TenantProvider<Schema>,
  request: IncomingMessage,
  response: ServerResponse,
  signal?: AbortSignal
) {
  if (
    new URL(request.url ?? "/", "http://localhost").pathname !== "/api/v1/tenants/current" ||
    request.method !== "GET"
  )
    return false;
  return tenantController(provider, request, response, signal);
}
