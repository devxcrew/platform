import { randomBytes, randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import { digest, hashPassword } from "./identity.password.js";
import { IdentityError } from "./identity.error.js";
import { IdentityRepository } from "./identity.repository.js";
import { checkIdentityRequest } from "./identity.request-context.js";
import {
  invitationSchema,
  recoverySchema,
  tokenCompletionSchema,
} from "./identity.lifecycle-schema.js";
import type {
  IdentityConfig,
  IdentityDeliveryProvider,
  IdentitySchema,
  Portal,
  Principal,
} from "./identity.types.js";
import type { IdentityListQuery } from "./identity.administration-schema.js";

export class IdentityLifecycleService {
  constructor(
    private readonly db: Kysely<IdentitySchema>,
    private readonly config: IdentityConfig,
    private readonly delivery?: IdentityDeliveryProvider,
  ) {}

  async invite(actor: Principal, raw: unknown) {
    if (
      actor.portal === "user" ||
      !actor.permissions.includes("identity.manage")
    )
      throw new IdentityError(403, "Access denied.");
    const input = invitationSchema.parse(raw);
    const tenantId = input.tenantId ?? actor.tenant.id;
    if (
      actor.portal !== "super-admin" &&
      (tenantId !== actor.tenant.id || input.roleId !== "user")
    )
      throw new IdentityError(403, "Access denied.");
    this.requireDelivery();
    if (
      (await new IdentityRepository(this.db).throttle(
        digest(`${actor.appId}:invitation:${actor.user.id}`),
      )) > 20
    )
      throw new IdentityError(429, "Too many invitations. Try again later.");
    const tenant = await this.db
      .selectFrom("identity_tenants")
      .select("id")
      .where("id", "=", tenantId)
      .where("active", "=", 1)
      .executeTakeFirst();
    if (!tenant)
      throw new IdentityError(422, "Organization is inactive or unavailable.");
    if (
      await this.db
        .selectFrom("identity_users")
        .select("id")
        .where("email", "=", input.email)
        .executeTakeFirst()
    )
      throw new IdentityError(
        409,
        "This account already exists. Manage its membership instead.",
      );
    const row = await this.issue(
      "invitation",
      input.email,
      input.name,
      input.roleId,
      tenantId,
      null,
      actor.user.id,
    );
    return this.present(row);
  }

  async requestRecovery(portal: Portal, raw: unknown, address: string) {
    const input = recoverySchema
      .refine(
        (value) =>
          this.config.mode !== "multi-tenant" || Boolean(value.tenantId),
        { path: ["tenantId"], message: "Enter an organization ID." },
      )
      .parse(raw);
    this.requireDelivery();
    const repository = new IdentityRepository(this.db);
    if (
      (await repository.throttle(
        digest(`${this.config.appId}:recovery-ip:${address}`),
      )) > 20
    )
      throw new IdentityError(
        429,
        "Too many recovery requests. Try again later.",
      );
    if (
      (await repository.throttle(
        digest(`${this.config.appId}:recovery:${address}:${input.email}`),
      )) > 5
    )
      throw new IdentityError(
        429,
        "Too many recovery requests. Try again later.",
      );
    const tenantId =
      this.config.mode === "single-client"
        ? this.config.tenantId
        : input.tenantId;
    const user = await repository.user(input.email);
    const principal = user?.active && tenantId
      ? await repository.principal(user.id, tenantId, portal, this.config.appId)
      : null;
    if (
      user?.active &&
      tenantId &&
      principal?.permissions.includes("identity.password")
    ) {
      await this.db
        .updateTable("identity_tokens")
        .set({ consumed_at: new Date().toISOString() })
        .where("app_id", "=", this.config.appId)
        .where("kind", "=", "recovery")
        .where("user_id", "=", user.id)
        .execute();
      await this.issue(
        "recovery",
        user.email,
        user.name,
        portal,
        tenantId,
        user.id,
      );
    }
    return {
      message: "If this account can recover access, an email will arrive.",
    };
  }

  async complete(
    portal: Portal,
    kind: "invitation" | "recovery",
    raw: unknown,
    address: string,
  ) {
    const input = tokenCompletionSchema.parse(raw);
    const repository = new IdentityRepository(this.db);
    if (
      (await repository.throttle(
        digest(`${this.config.appId}:complete:${address}`),
      )) > 10
    )
      throw new IdentityError(
        429,
        "Too many account requests. Try again later.",
      );
    const available = await this.db
      .selectFrom("identity_tokens")
      .select("id")
      .where("token_hash", "=", digest(input.token))
      .where("app_id", "=", this.config.appId)
      .where("kind", "=", kind)
      .where("role_id", "=", portal)
      .where("delivered", "=", 1)
      .where("consumed_at", "is", null)
      .where("expires_at", ">", new Date().toISOString())
      .executeTakeFirst();
    if (!available)
      throw new IdentityError(422, "This link is invalid or expired.");
    const passwordHash = await hashPassword(input.password);
    checkIdentityRequest();
    return this.db.transaction().execute(async (trx) => {
      checkIdentityRequest();
      const token = await trx
        .selectFrom("identity_tokens")
        .selectAll()
        .where("token_hash", "=", digest(input.token))
        .where("app_id", "=", this.config.appId)
        .where("kind", "=", kind)
        .where("role_id", "=", portal)
        .where("delivered", "=", 1)
        .where("consumed_at", "is", null)
        .where("expires_at", ">", new Date().toISOString())
        .executeTakeFirst();
      if (
        !token ||
        (this.config.mode === "single-client" &&
          token.tenant_id !== this.config.tenantId)
      )
        throw new IdentityError(422, "This link is invalid or expired.");
      const activeTenant = await trx
        .selectFrom("identity_tenants")
        .select("id")
        .where("id", "=", token.tenant_id)
        .where("active", "=", 1)
        .executeTakeFirst();
      if (!activeTenant)
        throw new IdentityError(422, "This link is invalid or expired.");
      const claimed = await trx
        .updateTable("identity_tokens")
        .set({ consumed_at: new Date().toISOString() })
        .where("id", "=", token.id)
        .where("consumed_at", "is", null)
        .executeTakeFirst();
      if (claimed.numUpdatedRows !== 1n)
        throw new IdentityError(409, "This link was already used.");
      const userId = token.user_id ?? randomUUID();
      if (kind === "invitation") {
        if (
          await trx
            .selectFrom("identity_users")
            .select("id")
            .where("email", "=", token.email)
            .executeTakeFirst()
        )
          throw new IdentityError(
            409,
            "Account already exists. Request a new invitation.",
          );
        await trx
          .insertInto("identity_users")
          .values({
            id: userId,
            email: token.email,
            name: token.name,
            password_hash: passwordHash,
            active: 1,
          })
          .execute();
        await trx
          .insertInto("identity_memberships")
          .values({
            user_id: userId,
            tenant_id: token.tenant_id,
            role_id: token.role_id,
          })
          .execute();
      } else {
        const principal = await new IdentityRepository(trx).principal(
          userId, token.tenant_id, portal, this.config.appId,
        );
        if (!principal?.permissions.includes("identity.password"))
          throw new IdentityError(422, "This link is invalid or expired.");
        await trx
          .updateTable("identity_users")
          .set({ password_hash: passwordHash })
          .where("id", "=", userId)
          .execute();
        await trx
          .deleteFrom("identity_sessions")
          .where("user_id", "=", userId)
          .execute();
        await trx
          .updateTable("identity_tokens")
          .set({ consumed_at: new Date().toISOString() })
          .where("user_id", "=", userId)
          .where("kind", "=", "recovery")
          .execute();
      }
      await trx
        .insertInto("identity_audit_events")
        .values({
          id: randomUUID(),
          app_id: this.config.appId,
          actor_id: userId,
          tenant_id: token.tenant_id,
          action: `identity.${kind}.completed`,
          resource_id: token.id,
          created_at: new Date().toISOString(),
        })
        .execute();
      checkIdentityRequest();
      return { message: "Account access updated. Sign in to continue." };
    });
  }

  async list(actor: Principal, query: IdentityListQuery) {
    if (
      actor.portal === "user" ||
      !actor.permissions.includes("identity.manage")
    )
      throw new IdentityError(403, "Access denied.");
    let select = this.db
      .selectFrom("identity_tokens")
      .where("app_id", "=", actor.appId)
      .where("kind", "=", "invitation");
    if (actor.portal !== "super-admin")
      select = select.where("tenant_id", "=", actor.tenant.id);
    if (query.search)
      select = select.where((eb) =>
        eb.or([
          eb("email", "like", `%${query.search}%`),
          eb("name", "like", `%${query.search}%`),
        ]),
      );
    const count = await select
      .select((eb) => eb.fn.countAll().as("total"))
      .executeTakeFirstOrThrow();
    const rows = await select
      .selectAll()
      .orderBy(query.sort, query.direction)
      .orderBy("id", "asc")
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage)
      .execute();
    const total = Number(count.total);
    return {
      data: rows.map((row) => this.present(row)),
      meta: {
        page: query.page,
        perPage: query.perPage,
        total,
        lastPage: Math.max(1, Math.ceil(total / query.perPage)),
      },
    };
  }

  async show(actor: Principal, id: string) {
    if (
      actor.portal === "user" ||
      !actor.permissions.includes("identity.manage")
    )
      throw new IdentityError(403, "Access denied.");
    let query = this.db
      .selectFrom("identity_tokens")
      .selectAll()
      .where("id", "=", id)
      .where("app_id", "=", actor.appId)
      .where("kind", "=", "invitation");
    if (actor.portal !== "super-admin")
      query = query.where("tenant_id", "=", actor.tenant.id);
    const row = await query.executeTakeFirst();
    if (!row) throw new IdentityError(404, "Invitation not found.");
    return this.present(row);
  }

  async resend(actor: Principal, id: string) {
    const old = await this.show(actor, id);
    if (old.status === "closed")
      throw new IdentityError(409, "This invitation is closed.");
    const result = await this.invite(actor, {
      email: old.email,
      name: old.name,
      roleId: old.roleId,
      tenantId: old.tenantId,
    });
    await this.revoke(actor, id);
    return result;
  }

  async revoke(actor: Principal, id: string) {
    if (
      actor.portal === "user" ||
      !actor.permissions.includes("identity.manage")
    )
      throw new IdentityError(403, "Access denied.");
    const token = await this.db
      .selectFrom("identity_tokens")
      .select("tenant_id")
      .where("id", "=", id)
      .where("app_id", "=", actor.appId)
      .where("kind", "=", "invitation")
      .executeTakeFirst();
    if (
      !token ||
      (actor.portal !== "super-admin" && token.tenant_id !== actor.tenant.id)
    )
      throw new IdentityError(404, "Invitation not found.");
    await this.db.transaction().execute(async (trx) => {
      checkIdentityRequest();
      let query = trx
        .updateTable("identity_tokens")
        .set({ consumed_at: new Date().toISOString() })
        .where("id", "=", id)
        .where("app_id", "=", actor.appId)
        .where("kind", "=", "invitation");
      if (actor.portal !== "super-admin")
        query = query.where("tenant_id", "=", actor.tenant.id);
      if ((await query.executeTakeFirst()).numUpdatedRows !== 1n)
        throw new IdentityError(404, "Invitation not found.");
      await trx
        .insertInto("identity_audit_events")
        .values({
          id: randomUUID(),
          app_id: actor.appId,
          actor_id: actor.user.id,
          tenant_id: token.tenant_id,
          action: "identity.invitation.revoked",
          resource_id: id,
          created_at: new Date().toISOString(),
        })
        .execute();
      checkIdentityRequest();
    });
  }

  private requireDelivery() {
    if (!this.delivery)
      throw new IdentityError(
        503,
        "Account email is unavailable. Contact your administrator.",
      );
  }

  private async issue(
    kind: "invitation" | "recovery",
    email: string,
    name: string,
    role: Portal,
    tenantId: string,
    userId: string | null,
    actorId = userId ?? "system",
  ) {
    const token = randomBytes(32).toString("base64url");
    const row: IdentitySchema["identity_tokens"] = {
      id: randomUUID(),
      token_hash: digest(token),
      app_id: this.config.appId,
      tenant_id: tenantId,
      kind,
      email,
      name,
      role_id: role,
      user_id: userId,
      expires_at: new Date(
        Date.now() + (kind === "recovery" ? 1800 : 86400) * 1000,
      ).toISOString(),
      consumed_at: null,
      delivered: 0,
    };
    checkIdentityRequest();
    await this.db.insertInto("identity_tokens").values(row).execute();
    const path = role === "user" ? "" : role === "admin" ? "/admin" : "/sa";
    const link = `${this.config.origin}${path}/${kind === "invitation" ? "accept-invitation" : "reset-password"}#token=${token}`;
    try {
      const delivered = await this.delivery!.send({
        to: email,
        subject:
          kind === "invitation"
            ? "Account invitation"
            : "Recover account access",
        text: `${name}, open this link to ${kind === "invitation" ? "set up your account" : "reset your password"}: ${link}\nThis link expires at ${row.expires_at}.`,
      });
      if (!delivered.messageId) throw new Error("Missing delivery receipt.");
      checkIdentityRequest();
      await this.db.transaction().execute(async (trx) => {
        await trx
          .updateTable("identity_tokens")
          .set({ delivered: 1 })
          .where("id", "=", row.id)
          .execute();
        await trx
          .insertInto("identity_audit_events")
          .values({
            id: randomUUID(),
            app_id: this.config.appId,
            actor_id: actorId,
            tenant_id: tenantId,
            action: `identity.${kind}.issued`,
            resource_id: row.id,
            created_at: new Date().toISOString(),
          })
          .execute();
        checkIdentityRequest();
      });
      return { ...row, delivered: 1 };
    } catch {
      await this.db
        .deleteFrom("identity_tokens")
        .where("id", "=", row.id)
        .execute();
      throw new IdentityError(
        503,
        "Account email is unavailable. Contact your administrator.",
      );
    }
  }

  private present(row: IdentitySchema["identity_tokens"]) {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      roleId: row.role_id,
      tenantId: row.tenant_id,
      expiresAt: row.expires_at,
      status: row.consumed_at
        ? "closed"
        : row.expires_at <= new Date().toISOString()
          ? "expired"
          : "pending",
    };
  }

  private async audit(
    actor: Principal,
    action: string,
    resourceId: string,
    tenantId = actor.tenant.id,
  ) {
    await this.db
      .insertInto("identity_audit_events")
      .values({
        id: randomUUID(),
        app_id: actor.appId,
        actor_id: actor.user.id,
        tenant_id: tenantId,
        action,
        resource_id: resourceId,
        created_at: new Date().toISOString(),
      })
      .execute();
  }
}
