import { randomBytes } from "node:crypto";
import { IdentityRepository } from "./identity.repository.js";
import { digest, hashPassword, verifyPassword } from "./identity.password.js";
import type { IdentityConfig, Portal, Principal } from "./identity.types.js";
import type { z } from "zod";
import type { loginSchema, passwordSchema } from "./identity.schema.js";
import { IdentityError } from "./identity.error.js";

export class IdentityService {
  private readonly dummyHash = hashPassword(randomBytes(32).toString("hex"));
  constructor(
    private readonly repository: IdentityRepository,
    private readonly config: IdentityConfig,
  ) {}

  async login(
    portal: Portal,
    input: z.infer<typeof loginSchema>,
    address: string,
    previous?: string,
  ) {
    const key = digest(
      `${this.config.appId}:${portal}:${address}:${input.email}`,
    );
    const ipKey = digest(`${this.config.appId}:ip:${address}`);
    if (
      (await this.repository.throttle(ipKey)) > 100 ||
      (await this.repository.throttle(key)) > 10
    )
      throw new IdentityError(
        429,
        "Too many sign-in attempts. Try again later.",
      );
    const user = await this.repository.user(input.email);
    const valid = await verifyPassword(
      input.password,
      user?.password_hash ?? (await this.dummyHash),
    );
    const tenantId =
      this.config.mode === "single-client"
        ? this.config.tenantId
        : input.tenantId;
    if (
      !valid ||
      !user ||
      !Number(user.active) ||
      !tenantId ||
      (this.config.mode === "single-client" &&
        input.tenantId &&
        input.tenantId !== tenantId)
    )
      throw new IdentityError(401, "Invalid credentials or portal access.");
    const principal = await this.repository.principal(
      user.id,
      tenantId,
      portal,
      this.config.appId,
    );
    if (!principal?.permissions.includes(`desk.${portal}`))
      throw new IdentityError(401, "Invalid credentials or portal access.");
    const token = randomBytes(32).toString("base64url");
    const sessionSeconds = await this.repository.sessionSeconds(
      this.config.appId,
      this.config.sessionSeconds,
    );
    const created = await this.repository.createSession(
      {
        token_hash: digest(token),
        user_id: user.id,
        tenant_id: tenantId,
        app_id: this.config.appId,
        portal,
        expires_at: new Date(Date.now() + sessionSeconds * 1000).toISOString(),
      },
      user.password_hash,
      previous ? digest(previous) : undefined,
    );
    if (!created)
      throw new IdentityError(401, "Invalid credentials or portal access.");
    await this.repository.clearThrottle(key);
    return {
      token,
      sessionSeconds,
      principal: { ...principal, appId: this.config.appId, portal },
    };
  }

  async authenticate(portal: Portal, token?: string): Promise<Principal> {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new IdentityError(401, "Sign in to continue.");
    const session = await this.repository.session(
      digest(token),
      this.config.appId,
      portal,
      new Date().toISOString(),
    );
    if (
      !session ||
      (this.config.mode === "single-client" &&
        session.tenant_id !== this.config.tenantId)
    )
      throw new IdentityError(401, "Sign in to continue.");
    const principal = await this.repository.principal(
      session.user_id,
      session.tenant_id,
      portal,
      this.config.appId,
    );
    if (!principal) throw new IdentityError(401, "Sign in to continue.");
    return { ...principal, appId: this.config.appId, portal };
  }

  requirePermission(principal: Principal, permission: string) {
    if (!principal.permissions.includes(permission))
      throw new IdentityError(403, "Access denied.");
  }

  async logout(portal: Portal, token?: string) {
    if (token)
      await this.repository.revoke(digest(token), this.config.appId, portal);
  }

  async changePassword(
    principal: Principal,
    input: z.infer<typeof passwordSchema>,
  ) {
    this.requirePermission(principal, "identity.password");
    const user = await this.repository.user(principal.user.email);
    if (
      !user ||
      !(await verifyPassword(input.currentPassword, user.password_hash))
    )
      throw new IdentityError(422, "Current password is incorrect.");
    if (
      !(await this.repository.changePassword(
        user.id,
        user.password_hash,
        await hashPassword(input.password),
      ))
    )
      throw new IdentityError(409, "Account changed. Sign in again.");
  }
}
