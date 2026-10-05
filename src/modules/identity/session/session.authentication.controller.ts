import { IdentityError } from "../support/identity.error.js";
import type { IdentityConfig, Portal, Principal } from "../identity.types.js";
import type { IdentityUserProvider } from "../user/index.js";
import { loginSchema } from "./session.schema.js";
import { passwordSchema } from "../user/index.js";

export class IdentitySessionAuthenticationController {
  constructor(
    private readonly identity: IdentityUserProvider["identity"],
    private readonly config: IdentityConfig
  ) {}

  login(portal: Portal, raw: unknown, address: string, previous?: string) {
    const input = loginSchema
      .refine((value) => this.config.mode !== "multi-tenant" || Boolean(value.tenantId), {
        path: ["tenantId"],
        message: "Enter an organization ID."
      })
      .parse(raw);
    return this.identity.login(portal, input, address, previous);
  }

  authenticate(portal: Portal, token?: string) {
    return this.identity.authenticate(portal, token);
  }

  current(principal: Principal, portal: Portal) {
    this.identity.requirePermission(principal, `desk.${portal}`);
    return principal;
  }

  logout(portal: Portal, token?: string) {
    return this.identity.logout(portal, token);
  }

  changePassword(principal: Principal, raw: unknown) {
    return this.identity.changePassword(principal, passwordSchema.parse(raw));
  }

  requireDesk(principal: Principal, portal: Portal) {
    if (!principal.permissions.includes(`desk.${portal}`))
      throw new IdentityError(403, "Access denied.");
  }
}
