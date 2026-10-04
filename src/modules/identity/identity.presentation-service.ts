import type { Kysely } from "kysely";
import type { IdentitySchema, Principal } from "./identity.types.js";

export class IdentityPresentationService {
  constructor(
    private readonly db: Kysely<IdentitySchema>,
    private readonly appName: string,
  ) {}

  async configuration(appId: string, requiresOrganizationId: boolean) {
    const app = await this.db
      .selectFrom("identity_app_settings")
      .select("display_name")
      .where("app_id", "=", appId)
      .executeTakeFirst();
    return {
      displayName: app?.display_name ?? this.appName,
      requiresOrganizationId,
    };
  }

  async presentation(actor: Principal) {
    const app = await this.db
      .selectFrom("identity_app_settings")
      .select(["display_name", "locale", "time_zone"])
      .where("app_id", "=", actor.appId)
      .executeTakeFirst();
    const organization = await this.db
      .selectFrom("identity_settings")
      .selectAll()
      .where("tenant_id", "=", actor.tenant.id)
      .executeTakeFirst();
    return {
      displayName: app?.display_name ?? this.appName,
      organizationDisplayName: organization?.display_name ?? actor.tenant.name,
      locale: organization?.locale ?? app?.locale ?? "en",
      timeZone: organization?.time_zone ?? app?.time_zone ?? "UTC",
    };
  }

  async organizationSettings(actor: Principal) {
    const organization = await this.db
      .selectFrom("identity_settings")
      .select("version")
      .where("tenant_id", "=", actor.tenant.id)
      .executeTakeFirst();
    const presentation = await this.presentation(actor);
    return {
      displayName: presentation.organizationDisplayName,
      locale: presentation.locale,
      timeZone: presentation.timeZone,
      version: Number(organization?.version ?? 0),
    };
  }
}
