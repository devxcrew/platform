import type { Principal } from "../identity.types.js";
import type { createIdentitySettingsProvider } from "./settings.provider.js";

export class IdentitySettingsController {
  constructor(private readonly service: ReturnType<typeof createIdentitySettingsProvider>) {}
  configuration(appId: string, requiresOrganizationId: boolean) {
    return this.service.configuration(appId, requiresOrganizationId);
  }
  presentation(actor: Principal) {
    return this.service.presentation(actor);
  }
  organization(actor: Principal, raw?: unknown) {
    return this.service.organizationSettings(actor, raw);
  }
  application(actor: Principal, security: boolean, raw: unknown, fallbackSeconds: number) {
    return this.service.applicationSettings(actor, security, raw, fallbackSeconds);
  }
}
