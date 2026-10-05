import { randomUUID } from "node:crypto";
import type { Kysely, Transaction } from "kysely";
import type { IdentitySchema, Portal, Principal } from "../identity.types.js";
import { IdentityError } from "../identity.error.js";
import { checkIdentityRequest } from "../identity.request-context.js";
import { protectAdministrators } from "./user-role.policy.js";
import { membershipSchema, membershipUpdateSchema } from "./user-role.schema.js";
import type { IdentityRoleResolver } from "../role/index.js";
import type { IdentityMutation } from "../identity.types.js";

export class IdentityUserRoleService {
  constructor(
    private readonly db: Kysely<IdentitySchema>,
    private readonly resolveRole: IdentityRoleResolver,
    private readonly mutate: IdentityMutation,
    private readonly assertUserVisible: (actor: Principal, userId: string) => Promise<unknown>
  ) {}

  async createMembership(actor: Principal, raw: unknown) {
    this.manage(actor);
    const input = membershipSchema.parse(raw);
    const tenantId = this.tenantId(actor, input.tenantId);
    await this.assertUserVisible(actor, input.userId);
    const selected = await this.resolveRole(this.db, actor, input.roleId, tenantId);
    const id = `${input.userId}~${tenantId}~${selected.portal}`;
    return this.mutate(actor, "memberships", id, async (trx) => {
      await this.activeTenant(trx, tenantId);
      const currentRole = await this.resolveRole(trx, actor, input.roleId, tenantId);
      if (
        await trx
          .selectFrom("identity_memberships")
          .select("user_id")
          .where("user_id", "=", input.userId)
          .where("tenant_id", "=", tenantId)
          .where("role_id", "=", currentRole.portal)
          .executeTakeFirst()
      )
        throw new IdentityError(409, "Membership already exists.");
      await trx
        .insertInto("identity_memberships")
        .values({
          user_id: input.userId,
          tenant_id: tenantId,
          role_id: currentRole.portal,
          custom_role_id: currentRole.customRoleId
        })
        .execute();
      return {
        id,
        userId: input.userId,
        tenantId,
        roleId: input.roleId,
        portal: currentRole.portal,
        active: true,
        version: 0
      };
    });
  }

  async assignInitialMembership(
    trx: Transaction<IdentitySchema>,
    actor: Principal,
    userId: string,
    tenantId: string,
    roleId: string
  ) {
    await this.activeTenant(trx, tenantId);
    const selected = await this.resolveRole(trx, actor, roleId, tenantId);
    await trx
      .insertInto("identity_memberships")
      .values({
        user_id: userId,
        tenant_id: tenantId,
        role_id: selected.portal,
        custom_role_id: selected.customRoleId
      })
      .execute();
  }

  async updateMembership(actor: Principal, id: string, raw: unknown) {
    this.manage(actor);
    const input = membershipUpdateSchema.parse(raw);
    const [userId, tenantId, oldPortal, extra] = id.split("~");
    if (!userId || !tenantId || !oldPortal || extra)
      throw new IdentityError(404, "Membership not found.");
    this.scope(actor, tenantId);
    if (actor.portal !== "super-admin" && oldPortal !== "user")
      throw new IdentityError(403, "Only super administrators can change privileged memberships.");
    return this.db.transaction().execute(async (trx) => {
      checkIdentityRequest();
      const current = await trx
        .selectFrom("identity_memberships")
        .selectAll()
        .where("user_id", "=", userId)
        .where("tenant_id", "=", tenantId)
        .where("role_id", "=", oldPortal)
        .executeTakeFirst();
      if (!current) throw new IdentityError(404, "Membership not found.");
      if (
        current.custom_role_id &&
        !(await trx
          .selectFrom("identity_custom_roles")
          .select("id")
          .where("id", "=", current.custom_role_id)
          .where("app_id", "=", actor.appId)
          .executeTakeFirst())
      )
        throw new IdentityError(404, "Membership not found.");
      if (
        input.active &&
        !(await trx
          .selectFrom("identity_tenants")
          .select("id")
          .where("id", "=", tenantId)
          .where("active", "=", 1)
          .executeTakeFirst())
      )
        throw new IdentityError(422, "Organization is inactive or unavailable.");
      if (Number(current.version) !== input.expectedVersion)
        throw new IdentityError(409, "This record changed. Reload before saving.");
      const selected = await this.resolveRole(trx, actor, input.roleId, tenantId);
      if (!input.active || selected.portal !== oldPortal)
        await protectAdministrators(trx, userId, tenantId, oldPortal);
      if (
        selected.portal !== oldPortal &&
        (await trx
          .selectFrom("identity_memberships")
          .select("user_id")
          .where("user_id", "=", userId)
          .where("tenant_id", "=", tenantId)
          .where("role_id", "=", selected.portal)
          .executeTakeFirst())
      )
        throw new IdentityError(409, "This account already has that portal membership.");
      const changed = await trx
        .updateTable("identity_memberships")
        .set({
          role_id: selected.portal,
          custom_role_id: selected.customRoleId,
          active: Number(input.active),
          version: input.expectedVersion + 1
        })
        .where("user_id", "=", userId)
        .where("tenant_id", "=", tenantId)
        .where("role_id", "=", oldPortal)
        .where("version", "=", input.expectedVersion)
        .executeTakeFirst();
      if (changed.numUpdatedRows !== 1n)
        throw new IdentityError(409, "This record changed. Reload before saving.");
      await trx
        .deleteFrom("identity_sessions")
        .where("app_id", "=", actor.appId)
        .where("user_id", "=", userId)
        .where("tenant_id", "=", tenantId)
        .where("portal", "=", oldPortal as Portal)
        .execute();
      const nextId = `${userId}~${tenantId}~${selected.portal}`;
      await this.audit(trx, actor, tenantId, "identity.membership.changed", nextId);
      checkIdentityRequest();
      return {
        id: nextId,
        userId,
        tenantId,
        roleId: selected.customRoleId ?? selected.portal,
        portal: selected.portal,
        active: input.active,
        version: input.expectedVersion + 1
      };
    });
  }

  async removeMembership(actor: Principal, id: string, expectedVersion?: number) {
    this.manage(actor);
    if (!Number.isInteger(expectedVersion) || Number(expectedVersion) < 0)
      throw new IdentityError(422, "Provide the current membership version.");
    const [userId, tenantId, portal, extra] = id.split("~");
    if (!userId || !tenantId || !portal || extra)
      throw new IdentityError(404, "Membership not found.");
    this.scope(actor, tenantId);
    if (actor.portal !== "super-admin" && portal !== "user")
      throw new IdentityError(403, "Only super administrators can change privileged memberships.");
    await this.db.transaction().execute(async (trx) => {
      checkIdentityRequest();
      const current = await trx
        .selectFrom("identity_memberships")
        .select(["custom_role_id", "version"])
        .where("user_id", "=", userId)
        .where("tenant_id", "=", tenantId)
        .where("role_id", "=", portal)
        .executeTakeFirst();
      if (
        !current ||
        (current.custom_role_id &&
          !(await trx
            .selectFrom("identity_custom_roles")
            .select("id")
            .where("id", "=", current.custom_role_id)
            .where("app_id", "=", actor.appId)
            .executeTakeFirst()))
      )
        throw new IdentityError(404, "Membership not found.");
      if (Number(current.version) !== expectedVersion)
        throw new IdentityError(409, "This record changed. Reload before saving.");
      await protectAdministrators(trx, userId, tenantId, portal);
      await trx
        .deleteFrom("identity_memberships")
        .where("user_id", "=", userId)
        .where("tenant_id", "=", tenantId)
        .where("role_id", "=", portal)
        .execute();
      await trx
        .deleteFrom("identity_sessions")
        .where("app_id", "=", actor.appId)
        .where("user_id", "=", userId)
        .where("tenant_id", "=", tenantId)
        .where("portal", "=", portal as Portal)
        .execute();
      await this.audit(trx, actor, tenantId, "identity.membership.removed", id);
      checkIdentityRequest();
    });
  }

  private manage(actor: Principal) {
    if (actor.portal === "user" || !actor.permissions.includes("identity.manage"))
      throw new IdentityError(403, "Access denied.");
  }

  private scope(actor: Principal, tenantId: string) {
    if (actor.portal !== "super-admin" && tenantId !== actor.tenant.id)
      throw new IdentityError(403, "Access denied.");
  }

  private tenantId(actor: Principal, requested?: string) {
    if (requested && requested !== actor.tenant.id && actor.portal !== "super-admin")
      throw new IdentityError(403, "Access denied.");
    return requested ?? actor.tenant.id;
  }

  private async activeTenant(trx: Transaction<IdentitySchema>, tenantId: string) {
    if (
      !(await trx
        .selectFrom("identity_tenants")
        .select("id")
        .where("id", "=", tenantId)
        .where("active", "=", 1)
        .executeTakeFirst())
    )
      throw new IdentityError(422, "Organization is inactive or unavailable.");
  }

  private async audit(
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
