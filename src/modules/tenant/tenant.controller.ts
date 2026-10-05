import type { DatabaseInfrastructureSchema } from "@devxcrew/framework";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { TenantProvider } from "./tenant.types.js";
export async function tenantController<Schema extends DatabaseInfrastructureSchema>(
  provider: TenantProvider<Schema>,
  request: IncomingMessage,
  response: ServerResponse,
  signal?: AbortSignal
) {
  await provider.runRequest(
    request,
    async () => {
      const scope = provider.current();
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      });
      response.end(
        JSON.stringify({ data: { tenantId: scope.tenantId, portal: scope.principal.portal } })
      );
    },
    signal
  );
  return true;
}
