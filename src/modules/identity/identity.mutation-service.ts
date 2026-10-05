import { randomUUID } from "node:crypto";
import type { Kysely, Transaction } from "kysely";
import type { IdentityMutation, IdentitySchema, Principal } from "./identity.types.js";
import { checkIdentityRequest } from "./identity.request-context.js";

export class IdentityMutationService {
  constructor(private readonly db: Kysely<IdentitySchema>) {}

  readonly mutate: IdentityMutation = async <T>(
    actor: Principal,
    resource: string,
    id: string,
    action: (trx: Transaction<IdentitySchema>, id: string) => Promise<T>,
    affectedTenant?: string
  ) =>
    this.db.transaction().execute(async (trx) => {
      checkIdentityRequest();
      const result = await action(trx, id);
      checkIdentityRequest();
      const targetTenant =
        affectedTenant ??
        (resource === "organizations"
          ? id
          : resource === "memberships"
            ? id.split("~")[1]
            : actor.tenant.id);
      let targets = [targetTenant];
      if (!affectedTenant && ["users", "profile"].includes(resource))
        targets = (
          await trx
            .selectFrom("identity_memberships")
            .select("tenant_id")
            .where("user_id", "=", id)
            .distinct()
            .execute()
        ).map((row) => row.tenant_id);
      if (["roles", "application-settings", "security-settings"].includes(resource))
        targets = (await trx.selectFrom("identity_tenants").select("id").execute()).map(
          (row) => row.id
        );
      for (const tenant of new Set(targets))
        await trx
          .insertInto("identity_audit_events")
          .values({
            id: randomUUID(),
            app_id: actor.appId,
            actor_id: actor.user.id,
            tenant_id: tenant,
            action: `identity.${resource}.changed`,
            resource_id: id,
            created_at: new Date().toISOString()
          })
          .execute();
      checkIdentityRequest();
      return result;
    });
}
