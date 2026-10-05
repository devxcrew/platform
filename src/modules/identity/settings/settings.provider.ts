import type { Kysely, Transaction } from "kysely";
import type { IdentityMutation, IdentitySchema } from "../identity.types.js";
import { IdentitySettingsRepository } from "./settings.repository.js";
import { IdentitySettingsService } from "./settings.service.js";

export function createIdentitySettingsProvider(
  database: Kysely<IdentitySchema>,
  appName: string,
  mutate: IdentityMutation,
  revokeAppSessions: (trx: Transaction<IdentitySchema>, appId: string) => Promise<void>
) {
  const repository = new IdentitySettingsRepository(database);
  const service = new IdentitySettingsService(repository, appName, mutate, revokeAppSessions);
  return Object.freeze({
    verify: repository.verifySchema.bind(repository),
    configuration: service.configuration.bind(service),
    presentation: service.presentation.bind(service),
    organizationSettings: service.organizationSettings.bind(service),
    applicationSettings: service.applicationSettings.bind(service)
  });
}
