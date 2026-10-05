import { randomUUID } from "node:crypto";
import { sql, type Kysely, type Transaction } from "kysely";
import type { IdentitySchema, Principal } from "../identity.types.js";
import type { IdentityListQuery } from "../support/pagination.schema.js";
import { listRows, showRow } from "../support/pagination.js";

function auditListSource(actor: Principal) {
  return sql`select id,actor_id as actorId,tenant_id as tenantId,action,resource_id as resourceId,created_at as createdAt
    from identity_audit_events where app_id=${actor.appId}
    ${actor.portal === "super-admin" ? sql`` : sql`and tenant_id=${actor.tenant.id}`}`;
}

export class IdentityAuditRepository {
  constructor(private readonly db: Kysely<IdentitySchema>) {}

  async verifySchema() {
    await this.db.selectFrom("identity_audit_events").select("created_at").limit(1).execute();
  }

  list(actor: Principal, query: IdentityListQuery) {
    return listRows(this.db, auditListSource(actor), ["id"], query, (row) => row);
  }
  show(actor: Principal, id: string) {
    return showRow(this.db, auditListSource(actor), id, (row) => row);
  }
  async record(
    trx: Transaction<IdentitySchema>,
    actor: Principal,
    tenantId: string,
    action: string,
    resourceId: string
  ) {
    await trx
      .insertInto("identity_audit_events")
      .values({
        id: randomUUID(),
        app_id: actor.appId,
        actor_id: actor.user.id,
        tenant_id: tenantId,
        action,
        resource_id: resourceId,
        created_at: new Date().toISOString()
      })
      .execute();
  }
}
