import { z } from "zod";
import type { Kysely } from "kysely";
import { createIdentityUserProvider } from "./user/index.js";
import { IdentityController } from "./identity.controller.js";
import type { IdentitySchema, IdentityProviderOptions } from "./identity.types.js";
import { IdentityAdministrationService } from "./identity.administration-service.js";
import { identityKeySchema } from "./user/index.js";
import {
  createIdentityPermissionProvider,
  type IdentityPermissionDeclaration
} from "./permission/index.js";

export function createIdentityProvider(
  database: Kysely<IdentitySchema>,
  environment: NodeJS.ProcessEnv,
  options: IdentityProviderOptions = {}
) {
  const config = z
    .object({
      appId: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
      origin: z.url(),
      mode: z.enum(["single-client", "multi-tenant"]),
      tenantId: identityKeySchema,
      sessionSeconds: z.coerce.number().int().min(300).max(86400)
    })
    .parse({
      appId: environment.APP_ID,
      origin: environment.APP_URL,
      mode: environment.IDENTITY_MODE ?? "single-client",
      tenantId: environment.IDENTITY_TENANT_ID ?? "default",
      sessionSeconds: environment.IDENTITY_SESSION_SECONDS ?? 28800
    });
  const origin = new URL(config.origin);
  if (origin.origin !== config.origin || !["http:", "https:"].includes(origin.protocol))
    throw new Error("Identity requires a valid application origin.");
  if (
    origin.protocol !== "https:" &&
    !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)
  )
    throw new Error("Identity requires HTTPS outside loopback development.");
  const permissions = createIdentityPermissionProvider(database);
  const user = createIdentityUserProvider(database, config, permissions, options);
  const service = user.identity;
  const appName = z
    .string()
    .trim()
    .min(1)
    .max(100)
    .parse(environment.APP_NAME || config.appId);
  const administration = new IdentityAdministrationService(database, appName, permissions);
  const lifecycle = user.lifecycle;
  const controller = new IdentityController(service, config, administration, lifecycle);
  return {
    registerPermissions: (declaration: IdentityPermissionDeclaration) =>
      permissions.register(config.appId, declaration),
    handle: controller.handle.bind(controller),
    authenticate: service.authenticate.bind(service),
    authenticateRequest: controller.authenticateRequest.bind(controller),
    requirePermission: service.requirePermission.bind(service),
    administration: {
      list: administration.list.bind(administration),
      show: administration.show.bind(administration),
      create: administration.create.bind(administration),
      update: administration.update.bind(administration),
      remove: administration.remove.bind(administration),
      profile: administration.profile.bind(administration),
      settings: administration.settings.bind(administration),
      presentation: administration.presentation.bind(administration)
    },
    async verify() {
      await database
        .selectFrom("identity_permission_declarations")
        .select(["permission_id", "label"])
        .limit(1)
        .execute();
      for (const declaration of options.permissions ?? [])
        await permissions.register(config.appId, declaration);
      await database.selectFrom("identity_roles").select("id").limit(1).execute();
      await database.selectFrom("identity_users").select("version").limit(1).execute();
      await database.selectFrom("identity_tenants").select("version").limit(1).execute();
      await database.selectFrom("identity_roles").select("version").limit(1).execute();
      await database.selectFrom("identity_settings").select("version").limit(1).execute();
      await database
        .selectFrom("identity_app_settings")
        .select(["version", "session_seconds"])
        .limit(1)
        .execute();
      await database
        .selectFrom("identity_tokens")
        .select(["delivered", "consumed_at"])
        .limit(1)
        .execute();
      await database.selectFrom("identity_audit_events").select("created_at").limit(1).execute();
      await database
        .selectFrom("identity_custom_roles")
        .select(["app_id", "tenant_id", "version"])
        .limit(1)
        .execute();
      await database
        .selectFrom("identity_custom_role_permissions")
        .select("permission_id")
        .limit(1)
        .execute();
      await database
        .selectFrom("identity_memberships")
        .select(["custom_role_id", "active", "version"])
        .limit(1)
        .execute();
    }
  };
}
