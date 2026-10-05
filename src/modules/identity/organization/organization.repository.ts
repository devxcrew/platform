import { sql, type Kysely, type Transaction } from "kysely";
import type { IdentitySchema, Principal } from "../identity.types.js";
import type { IdentityListQuery } from "../support/pagination.schema.js";
import { listRows, showRow } from "../support/pagination.js";

function organizationListSource(actor: Principal) {
  return sql`select id,name,active,version from identity_tenants ${actor.portal === "super-admin" ? sql`` : sql`where id=${actor.tenant.id}`}`;
}

export class IdentityOrganizationRepository {
  constructor(private readonly db: Kysely<IdentitySchema>) {}

  async verifySchema() {
    await this.db.selectFrom("identity_tenants").select("version").limit(1).execute();
  }

  async tenantIds(trx: Transaction<IdentitySchema>) {
    const rows = await trx.selectFrom("identity_tenants").select("id").execute();
    return rows.map((row) => row.id);
  }

  list(actor: Principal, query: IdentityListQuery) {
    const present = (row: Record<string, unknown>) => ({
      ...row,
      active: Boolean(row.active),
      version: Number(row.version)
    });
    return listRows(this.db, organizationListSource(actor), ["id", "name"], query, present);
  }
  show(actor: Principal, id: string) {
    const present = (row: Record<string, unknown>) => ({
      ...row,
      active: Boolean(row.active),
      version: Number(row.version)
    });
    return showRow(this.db, organizationListSource(actor), id, present);
  }
  exists(trx: Transaction<IdentitySchema>, id: string) {
    return trx.selectFrom("identity_tenants").select("id").where("id", "=", id).executeTakeFirst();
  }
  version(trx: Transaction<IdentitySchema>, id: string) {
    return trx
      .selectFrom("identity_tenants")
      .select("version")
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
  }
  async create(
    trx: Transaction<IdentitySchema>,
    input: { id: string; name: string; active: boolean }
  ) {
    await trx
      .insertInto("identity_tenants")
      .values({
        id: input.id,
        name: input.name,
        active: Number(input.active)
      })
      .execute();
  }
  async update(
    trx: Transaction<IdentitySchema>,
    id: string,
    input: {
      name?: string;
      active?: boolean;
      expectedVersion: number;
    }
  ) {
    const updated = await trx
      .updateTable("identity_tenants")
      .set({
        name: input.name,
        active: input.active === undefined ? undefined : Number(input.active),
        version: sql`version + 1`
      })
      .where("id", "=", id)
      .where("version", "=", input.expectedVersion)
      .executeTakeFirst();
    return updated.numUpdatedRows === 1n;
  }
  async get(trx: Transaction<IdentitySchema>, id: string) {
    return trx
      .selectFrom("identity_tenants")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
  }
}
