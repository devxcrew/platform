import type { ResumableTransfer } from "@devxcrew/framework";
import type { Principal, Portal, IdentitySchema } from "../identity/index.js";
import type { Generated, Kysely } from "kysely";
import type { IncomingMessage } from "node:http";
import type {
  DatabaseInfrastructureSchema,
  ConnectionTarget,
  DatabaseExecution
} from "@devxcrew/framework";
export type TenantPrincipal = Principal;
export interface TenantIdentity {
  authenticateRequest(
    request: IncomingMessage,
    portal: Portal,
    signal?: AbortSignal
  ): Promise<Principal>;
}
export interface TenantRegistrySchema {
  tenant_connections: {
    tenant_id: string;
    driver: "sqlite" | "mariadb";
    database_name: string | null;
    sqlite_path: string | null;
    active: number;
    version: Generated<number>;
  };
}
export interface TenantMasterSchema
  extends IdentitySchema, TenantRegistrySchema, DatabaseInfrastructureSchema {}
export interface TenantScope<
  Schema extends DatabaseInfrastructureSchema = DatabaseInfrastructureSchema
> {
  tenantId: string;
  principal: Principal;
  database: Kysely<Schema>;
  data: DatabaseExecution<Schema>;
  transfers: ResumableTransfer<Schema>;
}
export interface TenantProvider<
  Schema extends DatabaseInfrastructureSchema = DatabaseInfrastructureSchema
> {
  handle(
    request: IncomingMessage,
    response: import("node:http").ServerResponse,
    signal?: AbortSignal
  ): boolean | Promise<boolean>;
  verify(): Promise<void>;
  runRequest<T>(request: IncomingMessage, work: () => Promise<T>, signal?: AbortSignal): Promise<T>;
  withPrincipal<T>(
    principal: Principal,
    requestedTenant: string | undefined,
    work: () => Promise<T>,
    signal?: AbortSignal
  ): Promise<T>;
  current(): TenantScope<Schema>;
}
export interface TenantDatabase<
  Schema extends DatabaseInfrastructureSchema = DatabaseInfrastructureSchema
> {
  database: Kysely<TenantMasterSchema>;
  withConnection<T>(
    target: ConnectionTarget,
    work: (database: Kysely<Schema>) => Promise<T>
  ): Promise<T>;
}
