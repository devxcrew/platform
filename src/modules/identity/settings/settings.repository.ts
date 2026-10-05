import type { Kysely, Transaction } from "kysely";
import type { IdentitySchema } from "../identity.types.js";

export class IdentitySettingsRepository {
  constructor(private readonly db: Kysely<IdentitySchema>) {}

  async verifySchema() {
    await this.db.selectFrom("identity_settings").select("version").limit(1).execute();
    await this.db
      .selectFrom("identity_app_settings")
      .select(["version", "session_seconds"])
      .limit(1)
      .execute();
  }

  app(appId: string) {
    return this.db
      .selectFrom("identity_app_settings")
      .selectAll()
      .where("app_id", "=", appId)
      .executeTakeFirst();
  }
  organization(tenantId: string) {
    return this.db
      .selectFrom("identity_settings")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
  }
  appInTransaction(trx: Transaction<IdentitySchema>, appId: string) {
    return trx
      .selectFrom("identity_app_settings")
      .selectAll()
      .where("app_id", "=", appId)
      .executeTakeFirst();
  }
  organizationInTransaction(trx: Transaction<IdentitySchema>, tenantId: string) {
    return trx
      .selectFrom("identity_settings")
      .select("version")
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
  }
  async saveOrganization(
    trx: Transaction<IdentitySchema>,
    input: {
      tenantId: string;
      displayName: string;
      locale: string;
      timeZone: string;
      version: number;
    }
  ) {
    await trx
      .insertInto("identity_settings")
      .values({
        tenant_id: input.tenantId,
        display_name: input.displayName,
        locale: input.locale,
        time_zone: input.timeZone,
        version: input.version
      })
      .onConflict((c) =>
        c.column("tenant_id").doUpdateSet({
          display_name: input.displayName,
          locale: input.locale,
          time_zone: input.timeZone,
          version: input.version
        })
      )
      .execute();
  }
  async saveApp(
    trx: Transaction<IdentitySchema>,
    row: {
      app_id: string;
      display_name: string;
      locale: string;
      time_zone: string;
      session_seconds: number;
      version: number;
    }
  ) {
    await trx
      .insertInto("identity_app_settings")
      .values(row)
      .onConflict((c) => c.column("app_id").doUpdateSet(row))
      .execute();
  }
}
