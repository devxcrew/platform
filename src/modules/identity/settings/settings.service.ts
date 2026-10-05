import type { Transaction } from "kysely";
import { IdentityError } from "../support/identity.error.js";
import type { IdentityMutation, IdentitySchema, Principal } from "../identity.types.js";
import { IdentitySettingsRepository } from "./settings.repository.js";
import { securitySettingsSchema, settingsSchema } from "./settings.schema.js";

export class IdentitySettingsService {
  constructor(
    private readonly repository: IdentitySettingsRepository,
    private readonly appName: string,
    private readonly mutate: IdentityMutation,
    private readonly revokeAppSessions: (
      trx: Transaction<IdentitySchema>,
      appId: string
    ) => Promise<void>
  ) {}

  async configuration(appId: string, requiresOrganizationId: boolean) {
    const app = await this.repository.app(appId);
    return { displayName: app?.display_name ?? this.appName, requiresOrganizationId };
  }

  async presentation(actor: Principal) {
    const app = await this.repository.app(actor.appId);
    const organization = await this.repository.organization(actor.tenant.id);
    return {
      displayName: app?.display_name ?? this.appName,
      organizationDisplayName: organization?.display_name ?? actor.tenant.name,
      locale: organization?.locale ?? app?.locale ?? "en",
      timeZone: organization?.time_zone ?? app?.time_zone ?? "UTC"
    };
  }

  async organizationSettings(actor: Principal, raw?: unknown) {
    if (raw !== undefined) {
      if (actor.portal === "user" || !actor.permissions.includes("identity.manage"))
        throw new IdentityError(403, "Access denied.");
      const input = settingsSchema.parse(raw);
      await this.mutate(actor, "settings", actor.tenant.id, async (trx) => {
        const current = await this.repository.organizationInTransaction(trx, actor.tenant.id);
        this.revision(current?.version ?? 0, input.expectedVersion);
        await this.repository.saveOrganization(trx, {
          tenantId: actor.tenant.id,
          displayName: input.displayName,
          locale: input.locale,
          timeZone: input.timeZone,
          version: input.expectedVersion + 1
        });
      });
    }
    const organization = await this.repository.organization(actor.tenant.id);
    const presentation = await this.presentation(actor);
    return {
      displayName: presentation.organizationDisplayName,
      locale: presentation.locale,
      timeZone: presentation.timeZone,
      version: Number(organization?.version ?? 0)
    };
  }

  async applicationSettings(
    actor: Principal,
    security: boolean,
    raw: unknown,
    fallbackSeconds: number
  ) {
    if (actor.portal === "user") throw new IdentityError(403, "Access denied.");
    if (raw !== undefined) {
      if (actor.portal !== "super-admin" || !actor.permissions.includes("identity.manage"))
        throw new IdentityError(403, "Access denied.");
      const input = security ? securitySettingsSchema.parse(raw) : settingsSchema.parse(raw);
      await this.mutate(
        actor,
        security ? "security-settings" : "application-settings",
        actor.appId,
        async (trx) => {
          const current = await this.repository.appInTransaction(trx, actor.appId);
          this.revision(current?.version ?? 0, input.expectedVersion);
          const row = {
            app_id: actor.appId,
            display_name: current?.display_name ?? this.appName,
            locale: current?.locale ?? "en",
            time_zone: current?.time_zone ?? "UTC",
            session_seconds: current?.session_seconds ?? fallbackSeconds,
            version: input.expectedVersion + 1
          };
          if ("sessionSeconds" in input) row.session_seconds = input.sessionSeconds;
          else {
            row.display_name = input.displayName;
            row.locale = input.locale;
            row.time_zone = input.timeZone;
          }
          await this.repository.saveApp(trx, row);
          if (security) await this.revokeAppSessions(trx, actor.appId);
        }
      );
    }
    const row = await this.repository.app(actor.appId);
    return security
      ? {
          sessionSeconds: Number(row?.session_seconds ?? fallbackSeconds),
          version: Number(row?.version ?? 0)
        }
      : {
          displayName: row?.display_name ?? this.appName,
          locale: row?.locale ?? "en",
          timeZone: row?.time_zone ?? "UTC",
          version: Number(row?.version ?? 0)
        };
  }

  private revision(current: number, expected: number) {
    if (Number(current) !== expected)
      throw new IdentityError(409, "This record changed. Reload before saving.");
  }
}
