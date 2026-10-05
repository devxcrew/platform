import { sql, type Kysely, type RawBuilder } from "kysely";
import { IdentityError } from "./identity.error.js";
import type { IdentitySchema } from "../identity.types.js";
import type { IdentityListQuery } from "./pagination.schema.js";

export async function listRows<T>(
  db: Kysely<IdentitySchema>,
  source: RawBuilder<unknown>,
  fields: readonly string[],
  query: IdentityListQuery,
  present: (row: Record<string, unknown>) => T
) {
  if (!fields.includes(query.sort))
    throw new IdentityError(422, "This sort field is not supported for this resource.");
  const search = query.search
    ? sql`where ${sql.join(
        fields.map(
          (field) =>
            sql`lower(cast(${sql.ref(field)} as text)) like ${`%${query.search.toLowerCase()}%`}`
        ),
        sql` or `
      )}`
    : sql``;
  const count = await sql<{
    total: number;
  }>`select count(*) as total from (${source}) as resources ${search}`.execute(db);
  const rows = await sql<Record<string, unknown>>`select * from (${source}) as resources ${search}
    order by ${sql.ref(query.sort)} ${query.direction === "asc" ? sql`asc` : sql`desc`}, id asc
    limit ${query.perPage} offset ${(query.page - 1) * query.perPage}`.execute(db);
  const total = Number(count.rows[0].total);
  return {
    data: rows.rows.map(present),
    meta: {
      page: query.page,
      perPage: query.perPage,
      total,
      lastPage: Math.max(1, Math.ceil(total / query.perPage))
    }
  };
}

export async function showRow<T>(
  db: Kysely<IdentitySchema>,
  source: RawBuilder<unknown>,
  id: string,
  present: (row: Record<string, unknown>) => T
) {
  const result = await sql<
    Record<string, unknown>
  >`select * from (${source}) as resources where id = ${id} limit 1`.execute(db);
  return result.rows[0] ? present(result.rows[0]) : undefined;
}
