import { sql, type Kysely, type RawBuilder } from "kysely";
import { IdentityError } from "./identity.error.js";
import type { IdentitySchema, Principal } from "./identity.types.js";
import type { IdentityListQuery, IdentityResource } from "./identity.administration-schema.js";

export class IdentityAdministrationRepository {
  constructor(private readonly db: Kysely<IdentitySchema>) {}

  async list(actor: Principal, resource: IdentityResource, query: IdentityListQuery) {
    const source = this.source(actor, resource);
    const fields =
      resource === "users"
        ? ["id", "name", "email"]
        : resource === "organizations" || resource === "roles"
          ? ["id", "name"]
          : resource === "memberships"
            ? ["id", "userName", "organizationName", "roleName"]
            : ["id"];
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
    }>`select count(*) as total from (${source}) as resources ${search}`.execute(this.db);
    const sort = query.sort;
    const rows = await sql<Record<string, unknown>>`select * from (${source}) as resources ${search}
      order by ${sql.ref(sort)} ${query.direction === "asc" ? sql`asc` : sql`desc`}, id asc
      limit ${query.perPage} offset ${(query.page - 1) * query.perPage}`.execute(this.db);
    const total = Number(count.rows[0].total);
    return {
      data: rows.rows.map((row) => this.present(resource, row)),
      meta: {
        page: query.page,
        perPage: query.perPage,
        total,
        lastPage: Math.max(1, Math.ceil(total / query.perPage))
      }
    };
  }

  async show(actor: Principal, resource: IdentityResource, id: string) {
    const result = await sql<
      Record<string, unknown>
    >`select * from (${this.source(actor, resource)}) as resources where id = ${id} limit 1`.execute(
      this.db
    );
    return result.rows[0] ? this.present(resource, result.rows[0]) : undefined;
  }

  private source(actor: Principal, resource: IdentityResource): RawBuilder<unknown> {
    const global = actor.portal === "super-admin";
    if (resource === "users")
      return sql`select u.id,u.name,u.email,u.active,u.version from identity_users u
      where exists (select 1 from identity_memberships m left join identity_custom_roles c on c.id=m.custom_role_id
        where m.user_id=u.id and (m.custom_role_id is null or c.app_id=${actor.appId})
        ${global ? sql`` : sql`and m.tenant_id=${actor.tenant.id}`})
        ${global ? sql`or not exists(select 1 from identity_memberships m where m.user_id=u.id)` : sql``}`;
    if (resource === "organizations")
      return sql`select id,name,active,version from identity_tenants ${global ? sql`` : sql`where id=${actor.tenant.id}`}`;
    if (resource === "memberships")
      return sql`select m.user_id||'~'||m.tenant_id||'~'||m.role_id as id,m.user_id as userId,m.tenant_id as tenantId,
      coalesce(m.custom_role_id,m.role_id) as roleId,m.role_id as portal,m.active,m.version,u.name as userName,t.name as organizationName,
      coalesce(c.name,m.role_id) as roleName from identity_memberships m
      join identity_users u on u.id=m.user_id join identity_tenants t on t.id=m.tenant_id
      left join identity_custom_roles c on c.id=m.custom_role_id
      where (m.custom_role_id is null or c.app_id=${actor.appId}) ${global ? sql`` : sql`and m.tenant_id=${actor.tenant.id}`}`;
    if (resource === "roles")
      return sql`select r.id,r.id as name,r.id as portal,1 as system,null as tenantId,1 as active,r.version,(select json_group_array(permission_id) from identity_role_permissions p where p.role_id=r.id) as permissionIds from identity_roles r
        union all select c.id,c.name,'user' as portal,0 as system,c.tenant_id as tenantId,c.active,c.version,
        (select json_group_array(permission_id) from identity_custom_role_permissions p where p.role_id=c.id) as permissionIds
        from identity_custom_roles c where c.app_id=${actor.appId} ${global ? sql`` : sql`and c.tenant_id=${actor.tenant.id}`}`;
    if (resource === "permissions")
      return sql`select p.id,coalesce(d.label,p.id) as label,
        coalesce(d.owner,case when p.id like 'desk.%' then 'desk' else 'identity' end) as owner,
        d.app_id as appId,
        coalesce(d.portals,case when p.id='desk.user' then '["user"]' when p.id='desk.admin' then '["admin"]'
          when p.id='desk.super-admin' then '["super-admin"]' when p.id='identity.manage' then '["admin","super-admin"]'
          else '["user","admin","super-admin"]' end) as portals
        from identity_permissions p left join identity_permission_declarations d on d.permission_id=p.id
        where d.permission_id is null or d.app_id=${actor.appId}`;
    if (resource === "sessions")
      return sql`select token_hash as id,user_id as userId,tenant_id as tenantId,portal,expires_at as expiresAt from identity_sessions
      where app_id=${actor.appId} and expires_at>${new Date().toISOString()}
      ${global ? sql`` : sql`and tenant_id=${actor.tenant.id}`}
      ${actor.portal === "user" ? sql`and user_id=${actor.user.id}` : sql``}`;
    return sql`select id,actor_id as actorId,tenant_id as tenantId,action,resource_id as resourceId,created_at as createdAt
      from identity_audit_events where app_id=${actor.appId} ${global ? sql`` : sql`and tenant_id=${actor.tenant.id}`}`;
  }

  private present(resource: IdentityResource, row: Record<string, unknown>) {
    if (resource === "permissions")
      return { ...row, portals: JSON.parse(String(row.portals)) as string[] };
    if (resource === "roles")
      return {
        ...row,
        version: Number(row.version),
        active: Boolean(row.active),
        system: Boolean(row.system),
        permissionIds: JSON.parse(String(row.permissionIds)) as string[]
      };
    if (resource === "users" || resource === "organizations" || resource === "memberships")
      return {
        ...row,
        active: Boolean(row.active),
        version: Number(row.version)
      };
    return row;
  }
}
