import { z } from "zod";
import type { Kysely } from "kysely";
import { createIdentityUserProvider } from "./user/index.js";
import { IdentityController } from "./transport/identity.controller.js";
import type { IdentitySchema, IdentityProviderOptions } from "./identity.types.js";
import { IdentityAdministrationComposition } from "./composition/identity.composition.js";
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
  const administration = new IdentityAdministrationComposition(database, appName, permissions);
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
      await permissions.verify();
      await user.verify();
      await administration.verify();
      for (const declaration of options.permissions ?? [])
        await permissions.register(config.appId, declaration);
    }
  };
}
