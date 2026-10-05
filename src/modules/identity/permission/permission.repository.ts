import { sql, type Kysely, type Transaction } from "kysely";
import type { IdentitySchema, Principal } from "../identity.types.js";
import type { IdentityListQuery } from "../support/pagination.schema.js";
import { listRows, showRow } from "../support/pagination.js";

type Database = Kysely<IdentitySchema> | Transaction<IdentitySchema>;

function permissionListSource(actor: Principal) {
  return sql`select p.id,coalesce(d.label,p.id) as label,
    coalesce(d.owner,case when p.id like 'desk.%' then 'desk' else 'identity' end) as owner,
    d.app_id as appId,
    coalesce(d.portals,case when p.id='desk.user' then '["user"]' when p.id='desk.admin' then '["admin"]'
      when p.id='desk.super-admin' then '["super-admin"]' when p.id='identity.manage' then '["admin","super-admin"]'
      else '["user","admin","super-admin"]' end) as portals
    from identity_permissions p left join identity_permission_declarations d on d.permission_id=p.id
    where d.permission_id is null or d.app_id=${actor.appId}`;
}

export class IdentityPermissionRepository {
  constructor(private readonly db: Kysely<IdentitySchema>) {}

  async verifySchema() {
    await this.db.selectFrom("identity_permissions").select("id").limit(1).execute();
    await this.db
      .selectFrom("identity_permission_declarations")
      .select(["permission_id", "label"])
      .limit(1)
      .execute();
  }

  list(actor: Principal, query: IdentityListQuery) {
    const present = (row: Record<string, unknown>) => ({
      ...row,
      portals: JSON.parse(String(row.portals)) as string[]
    });
    return listRows(this.db, permissionListSource(actor), ["id"], query, present);
  }

  show(actor: Principal, id: string) {
    const present = (row: Record<string, unknown>) => ({
      ...row,
      portals: JSON.parse(String(row.portals)) as string[]
    });
    return showRow(this.db, permissionListSource(actor), id, present);
  }

  transaction<T>(action: (trx: Transaction<IdentitySchema>) => Promise<T>) {
    return this.db.transaction().execute(action);
  }

  declaration(db: Database, id: string) {
    return db
      .selectFrom("identity_permission_declarations")
      .selectAll()
      .where("permission_id", "=", id)
      .executeTakeFirst();
  }

  declarations(db: Database) {
    return db.selectFrom("identity_permission_declarations").selectAll().execute();
  }

  permission(db: Database, id: string) {
    return db
      .selectFrom("identity_permissions")
      .select("id")
      .where("id", "=", id)
      .executeTakeFirst();
  }

  async knownIds(db: Database) {
    const rows = await db.selectFrom("identity_permissions").select("id").execute();
    return new Set(rows.map((row) => row.id));
  }

  async updateLabel(trx: Transaction<IdentitySchema>, id: string, label: string) {
    await trx
      .updateTable("identity_permission_declarations")
      .set({ label })
      .where("permission_id", "=", id)
      .execute();
  }

  async create(
    trx: Transaction<IdentitySchema>,
    input: {
      id: string;
      appId: string;
      owner: string;
      portals: string;
      label: string | null;
    }
  ) {
    await trx.insertInto("identity_permissions").values({ id: input.id }).execute();
    await trx
      .insertInto("identity_permission_declarations")
      .values({
        permission_id: input.id,
        app_id: input.appId,
        owner: input.owner,
        portals: input.portals,
        label: input.label
      })
      .execute();
  }
}
