import { randomUUID } from "node:crypto";
import { sql, type Kysely, type Transaction } from "kysely";
import { IdentityError } from "../identity.error.js";
import type { IdentityMutation, IdentitySchema, Principal } from "../identity.types.js";
import type { IdentityRoleResolver } from "../role/index.js";
import { protectAdministrators } from "../user-role/index.js";
import type { IdentityUserRoleProvider } from "../user-role/index.js";
import { hashPassword } from "./user.password.js";
import { profileSchema, userCreateSchema, userUpdateSchema } from "./user.schema.js";

export class IdentityUserAdministrationService {
  constructor(
    private readonly db: Kysely<IdentitySchema>,
    private readonly resolveRole: IdentityRoleResolver,
    private readonly assignInitialMembership: IdentityUserRoleProvider["assignInitialMembership"],
    private readonly mutate: IdentityMutation
  ) {}

  async create(actor: Principal, raw: unknown) {
    const input = userCreateSchema.parse(raw);
    const tenantId = this.tenantId(actor, input.tenantId);
    await this.resolveRole(this.db, actor, input.roleId, tenantId);
    const passwordHash = await hashPassword(input.password);
    return this.mutate(
      actor,
      "users",
      randomUUID(),
      async (trx, id) => {
        await this.activeTenant(trx, tenantId);
        if (
          await trx
            .selectFrom("identity_users")
            .select("id")
            .where("email", "=", input.email)
            .executeTakeFirst()
        )
          throw new IdentityError(409, "Email already exists.");
        await trx
          .insertInto("identity_users")
          .values({
            id,
            email: input.email,
            name: input.name,
            active: 1,
            password_hash: passwordHash
          })
          .execute();
        await this.assignInitialMembership(trx, actor, id, tenantId, input.roleId);
        return { id, email: input.email, name: input.name, active: true, version: 0 };
      },
      tenantId
    );
  }

  async update(actor: Principal, id: string, raw: unknown) {
    const input = userUpdateSchema.parse(raw);
    return this.mutate(actor, "users", id, async (trx) => {
      const current = await trx
        .selectFrom("identity_users")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirstOrThrow();
      this.revision(current.version, input.expectedVersion);
      if (actor.portal !== "super-admin") await this.unprivilegedUser(trx, id);
      if (input.active === false) {
        await protectAdministrators(trx, id);
        await trx.deleteFrom("identity_sessions").where("user_id", "=", id).execute();
      }
      if (
        input.email &&
        (await trx
          .selectFrom("identity_users")
          .select("id")
          .where("email", "=", input.email)
          .where("id", "!=", id)
          .executeTakeFirst())
      )
        throw new IdentityError(409, "Email already exists.");
      const { expectedVersion, ...fields } = input;
      await trx
        .updateTable("identity_users")
        .set({
          ...fields,
          version: sql`version + 1`,
          active: input.active === undefined ? current.active : Number(input.active)
        })
        .where("id", "=", id)
        .execute();
      return {
        id,
        name: input.name ?? current.name,
        email: input.email ?? current.email,
        active: input.active ?? Boolean(current.active),
        version: expectedVersion + 1
      };
    });
  }

  async profile(actor: Principal, raw?: unknown) {
    if (!actor.permissions.includes("identity.self"))
      throw new IdentityError(403, "Access denied.");
    if (raw !== undefined) {
      const input = profileSchema.parse(raw);
      await this.mutate(actor, "profile", actor.user.id, async (trx) => {
        const changed = await trx
          .updateTable("identity_users")
          .set({
            name: input.name,
            version: sql`version + 1`
          })
          .where("id", "=", actor.user.id)
          .where("version", "=", input.expectedVersion)
          .executeTakeFirst();
        if (changed.numUpdatedRows !== 1n)
          throw new IdentityError(409, "This record changed. Reload before saving.");
      });
    }
    const user = await this.db
      .selectFrom("identity_users")
      .select(["id", "name", "email", "active", "version"])
      .where("id", "=", actor.user.id)
      .executeTakeFirstOrThrow();
    return { ...user, active: Boolean(user.active), version: Number(user.version) };
  }

  private tenantId(actor: Principal, requested?: string) {
    if (requested && requested !== actor.tenant.id && actor.portal !== "super-admin")
      throw new IdentityError(403, "Access denied.");
    return requested ?? actor.tenant.id;
  }

  private async activeTenant(trx: Transaction<IdentitySchema>, id: string) {
    if (
      !(await trx
        .selectFrom("identity_tenants")
        .select("id")
        .where("id", "=", id)
        .where("active", "=", 1)
        .executeTakeFirst())
    )
      throw new IdentityError(422, "Organization is inactive or unavailable.");
  }

  private async unprivilegedUser(trx: Transaction<IdentitySchema>, id: string) {
    const privileged = await trx
      .selectFrom("identity_memberships")
      .select("role_id")
      .where("user_id", "=", id)
      .where("role_id", "in", ["admin", "super-admin"])
      .executeTakeFirst();
    if (privileged)
      throw new IdentityError(403, "Only super administrators can change privileged accounts.");
    const tenants = await trx
      .selectFrom("identity_memberships")
      .select("tenant_id")
      .where("user_id", "=", id)
      .distinct()
      .execute();
    if (tenants.length > 1)
      throw new IdentityError(403, "Only super administrators can change shared accounts.");
  }

  private revision(current: number, expected: number) {
    if (Number(current) !== expected)
      throw new IdentityError(409, "This record changed. Reload before saving.");
  }
}
