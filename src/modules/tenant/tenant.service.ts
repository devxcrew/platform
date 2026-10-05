import { AsyncLocalStorage } from "node:async_hooks";
import type { IdentityTenantDirectory } from "../identity/index.js";
import { HttpError } from "@devxcrew/framework";
import {
  type DatabaseInfrastructureSchema,
  DatabaseCapacityError,
  ResumableTransfer,
  DatabaseExecution
} from "@devxcrew/framework";
import { tenantMappingSchema } from "./tenant.schema.js";
import { TenantRepository } from "./tenant.repository.js";
import type { TenantDatabase, TenantPrincipal, TenantScope } from "./tenant.types.js";
export class TenantService<
  Schema extends DatabaseInfrastructureSchema = DatabaseInfrastructureSchema
> {
  private readonly context = new AsyncLocalStorage<TenantScope<Schema>>();
  constructor(
    private readonly repository: TenantRepository,
    private readonly directory: IdentityTenantDirectory,
    private readonly connections: TenantDatabase<Schema>,
    private readonly mode: "single-client" | "multi-tenant",
    private readonly clientId: string
  ) {}
  current() {
    const scope = this.context.getStore();
    if (!scope)
      throw new HttpError(
        401,
        "tenant_context_required",
        "An authenticated tenant context is required."
      );
    return scope;
  }
  verify() {
    return this.repository.verify();
  }
  async withPrincipal<T>(
    principal: TenantPrincipal,
    requested: string | undefined,
    work: () => Promise<T>,
    signal?: AbortSignal
  ) {
    signal?.throwIfAborted();
    const id = principal.tenant.id;
    if (
      !id ||
      (requested && requested !== id) ||
      (this.mode === "single-client" && id !== this.clientId)
    )
      throw new HttpError(403, "tenant_denied", "The session does not authorize this tenant.");
    const activeTenant = await this.directory.active(id);
    const mapping = await this.repository.find(id);
    if (!activeTenant || !mapping || Number(mapping.active) !== 1)
      throw new HttpError(403, "tenant_unavailable", "No active tenant database is available.");
    const target = tenantMappingSchema.safeParse({
      tenantId: id,
      driver: mapping.driver,
      databaseName: mapping.databaseName,
      sqlitePath: mapping.sqlitePath,
      active: Number(mapping.active),
      version: Number(mapping.version)
    });
    if (!target.success)
      throw new HttpError(
        503,
        "tenant_mapping_invalid",
        "Tenant database configuration is invalid."
      );
    return this.connections
      .withConnection(
        {
          key: id,
          driver: target.data.driver,
          databaseName: target.data.databaseName,
          sqlitePath: target.data.sqlitePath,
          version: target.data.version
        },
        async (database) => {
          signal?.throwIfAborted();
          return this.context.run(
            {
              tenantId: id,
              principal,
              database,
              data: new DatabaseExecution(database),
              transfers: new ResumableTransfer(database)
            },
            work
          );
        }
      )
      .catch((error) => {
        if (error instanceof DatabaseCapacityError)
          throw new HttpError(503, "tenant_busy", "Tenant connection capacity is currently busy.");
        throw error;
      });
  }
}
