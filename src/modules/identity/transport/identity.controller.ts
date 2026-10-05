import type { IncomingMessage, ServerResponse } from "node:http";
import { ZodError } from "zod";
import { portalSchema, IdentityUserLifecycleController } from "../user/index.js";
import { IdentitySessionAuthenticationController } from "../session/index.js";
import type { IdentityUserProvider } from "../user/index.js";
import { IdentityError } from "../support/identity.error.js";
import { identityRoutes, portalRoutes } from "./identity.routes.js";
import type { IdentityConfig, Portal } from "../identity.types.js";
import { IdentityAdministrationComposition } from "../composition/identity.composition.js";
import {
  listSchema,
  resourceListQuerySchema,
  type IdentityResource
} from "../support/pagination.schema.js";
import { membershipDeleteQuerySchema } from "../user-role/index.js";
import { resourceIdSchema } from "../support/identity.schema.js";

import { checkIdentityRequest, runIdentityRequest } from "../support/identity.request-context.js";

export class IdentityController {
  private readonly authentication: IdentitySessionAuthenticationController;
  private readonly accounts: IdentityUserLifecycleController;
  constructor(
    service: IdentityUserProvider["identity"],
    private readonly config: IdentityConfig,
    private readonly administration: IdentityAdministrationComposition,
    lifecycle: IdentityUserProvider["lifecycle"]
  ) {
    this.authentication = new IdentitySessionAuthenticationController(service, config);
    this.accounts = new IdentityUserLifecycleController(lifecycle);
  }

  async handle(
    request: IncomingMessage,
    response: ServerResponse,
    signal?: AbortSignal
  ): Promise<boolean> {
    return runIdentityRequest(signal, () => this.handleRequest(request, response));
  }

  async authenticateRequest(
    request: IncomingMessage,
    requestedPortal: Portal,
    signal?: AbortSignal
  ) {
    return runIdentityRequest(signal, async () => {
      checkIdentityRequest();
      const parsedPortal = portalSchema.safeParse(requestedPortal);
      if (!parsedPortal.success)
        throw new IdentityError(422, "Validation failed", {
          portal: ["Select a supported portal."]
        });
      const portal = parsedPortal.data;
      if (
        !["GET", "HEAD", "OPTIONS"].includes(request.method ?? "") &&
        request.headers.origin !== this.config.origin
      )
        throw new IdentityError(403, "Untrusted request origin.");
      const principal = await this.authentication.authenticate(portal, this.token(request, portal));
      checkIdentityRequest();
      return principal;
    });
  }

  private async handleRequest(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<boolean> {
    const path =
      new URL(request.url ?? "/", this.config.origin).pathname.replace(/\/+$/, "") || "/";
    const api = path.match(/^\/api\/v1\/identity\/(user|admin|super-admin)\/(.+)$/);
    const desk = Object.entries(portalRoutes).find(([, routes]) => routes.desk === path);
    if (!api && !desk) return false;
    const portal = portalSchema.parse(api?.[1] ?? desk?.[0]);
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    try {
      checkIdentityRequest();
      const token = this.token(request, portal);
      if (desk) {
        try {
          const principal = await this.authentication.authenticate(portal, token);
          this.authentication.requireDesk(principal, portal);
          return false;
        } catch (error) {
          if (!(error instanceof IdentityError)) throw error;
          response.writeHead(302, { Location: portalRoutes[portal].login });
          response.end();
          return true;
        }
      }
      const route = identityRoutes.find((r) => r.method === request.method && r.path === api?.[2]);
      if (request.method !== "GET" && request.headers.origin !== this.config.origin)
        throw new IdentityError(403, "Untrusted request origin.");
      if (!route) {
        await this.adminRequest(request, response, portal, token, api![2]);
        return true;
      }
      if (route.action === "login") {
        const result = await this.authentication.login(
          portal,
          await this.body(request),
          request.socket.remoteAddress ?? "unknown",
          token
        );
        response.setHeader("Set-Cookie", this.cookie(portal, result.token, result.sessionSeconds));
        this.json(response, 201, { data: result.principal });
      } else if (route.action === "logout") {
        await this.authentication.logout(portal, token);
        response.setHeader("Set-Cookie", this.cookie(portal, "", 0));
        response.writeHead(204);
        response.end();
      } else {
        const principal = await this.authentication.authenticate(portal, token);
        if (route.action === "password") {
          await this.authentication.changePassword(principal, await this.body(request));
          response.setHeader("Set-Cookie", this.cookie(portal, "", 0));
          response.writeHead(204);
          response.end();
        } else {
          this.json(response, 200, { data: this.authentication.current(principal, portal) });
        }
      }
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string[]> = {};
        for (const issue of error.issues)
          (errors[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
        this.json(response, 422, { message: "Validation failed", errors });
      } else if (error instanceof IdentityError)
        this.json(response, error.status, { message: error.message });
      else {
        console.error("Identity request failed.");
        this.json(response, 500, {
          message: "Unable to complete the request."
        });
      }
    }
    return true;
  }

  private async adminRequest(
    request: IncomingMessage,
    response: ServerResponse,
    portal: Portal,
    token: string | undefined,
    path: string
  ) {
    if (path === "configuration") {
      if (request.method !== "GET") throw new IdentityError(405, "Method not allowed.");
      this.json(response, 200, {
        data: await this.administration.settingsController.configuration(
          this.config.appId,
          this.config.mode === "multi-tenant"
        )
      });
      return;
    }
    if (["recovery", "recovery/complete", "invitations/accept"].includes(path)) {
      if (request.method !== "POST") throw new IdentityError(405, "Method not allowed.");
      const raw = await this.body(request);
      const data =
        path === "recovery"
          ? await this.accounts.requestRecovery(
              portal,
              raw,
              request.socket.remoteAddress ?? "unknown"
            )
          : await this.accounts.complete(
              portal,
              path === "recovery/complete" ? "recovery" : "invitation",
              raw,
              request.socket.remoteAddress ?? "unknown"
            );
      this.json(response, path === "recovery" ? 202 : 200, { data });
      return;
    }
    const principal = await this.authentication.authenticate(portal, token);
    if (path === "presentation") {
      if (request.method !== "GET") throw new IdentityError(405, "Method not allowed.");
      this.json(response, 200, {
        data: await this.administration.settingsController.presentation(principal)
      });
      return;
    }
    if (path === "invitations" || path.startsWith("invitations/")) {
      if (path === "invitations" && request.method === "GET") {
        const query = resourceListQuerySchema.parse(
          Object.fromEntries(new URL(request.url!, this.config.origin).searchParams)
        );
        this.json(response, 200, this.wireList(await this.accounts.index(principal, query)));
      } else if (path === "invitations" && request.method === "POST") {
        this.json(response, 201, {
          data: await this.accounts.store(principal, await this.body(request))
        });
      } else if (request.method === "GET") {
        this.json(response, 200, {
          data: await this.accounts.show(
            principal,
            resourceIdSchema.parse(path.slice("invitations/".length))
          )
        });
      } else if (request.method === "POST" && path.endsWith("/resend")) {
        this.json(response, 201, {
          data: await this.accounts.resend(
            principal,
            resourceIdSchema.parse(path.slice("invitations/".length, -"/resend".length))
          )
        });
      } else if (request.method === "DELETE") {
        await this.accounts.destroy(
          principal,
          resourceIdSchema.parse(path.slice("invitations/".length))
        );
        response.writeHead(204);
        response.end();
      } else throw new IdentityError(405, "Method not allowed.");
      return;
    }
    if (["profile", "settings", "application-settings", "security-settings"].includes(path)) {
      if (!["GET", "PATCH"].includes(request.method ?? ""))
        throw new IdentityError(405, "Method not allowed.");
      const input = request.method === "PATCH" ? await this.body(request) : undefined;
      const data =
        path === "profile"
          ? await this.administration.userController.profile(principal, input)
          : path === "settings"
            ? await this.administration.settingsController.organization(principal, input)
            : await this.administration.settingsController.application(
                principal,
                path === "security-settings",
                input,
                this.config.sessionSeconds
              );
      this.json(response, 200, { data });
      return;
    }
    const match = path.match(
      /^(users|organizations|memberships|roles|permissions|sessions|audit-events)(?:\/([^/]+))?$/
    );
    if (!match) throw new IdentityError(404, "Not found.");
    const resource = match[1] as IdentityResource;
    const controller = this.administration.controllers[resource];
    const id = match[2] ? resourceIdSchema.parse(decodeURIComponent(match[2])) : undefined;
    if (request.method === "GET") {
      const query = resourceListQuerySchema.parse(
        Object.fromEntries(new URL(request.url!, this.config.origin).searchParams)
      );
      this.json(
        response,
        200,
        id
          ? { data: await this.requireResult(controller.show(principal, id)) }
          : this.wireList(
              (await controller.index(principal, query)) as {
                data: unknown[];
                meta: { page: number; perPage: number; total: number; lastPage: number };
              }
            )
      );
    } else if (request.method === "POST" && !id) {
      this.json(response, 201, {
        data: await this.requireAction(
          controller.store?.bind(controller),
          principal,
          await this.body(request)
        )
      });
    } else if (request.method === "PATCH" && id) {
      this.json(response, 200, {
        data: await this.requireUpdate(
          controller.update?.bind(controller),
          principal,
          id,
          await this.body(request)
        )
      });
    } else if (request.method === "DELETE" && id) {
      const query = new URL(request.url!, this.config.origin).searchParams;
      const expectedVersion =
        resource === "memberships"
          ? membershipDeleteQuerySchema.parse(Object.fromEntries(query)).expectedVersion
          : undefined;
      if (!controller.destroy)
        throw new IdentityError(405, "Deletion is not supported for this resource.");
      await controller.destroy(principal, id, expectedVersion);
      response.writeHead(204);
      response.end();
    } else throw new IdentityError(405, "Method not allowed.");
  }

  private wireList<T>(page: {
    data: T[];
    meta: { page: number; perPage: number; total: number; lastPage: number };
  }) {
    return {
      data: page.data,
      meta: {
        current_page: page.meta.page,
        per_page: page.meta.perPage,
        total: page.meta.total,
        last_page: page.meta.lastPage
      }
    };
  }

  private async requireResult(result: Promise<unknown>) {
    const value = await result;
    if (!value) throw new IdentityError(404, "Resource not found.");
    return value;
  }

  private requireAction(
    action:
      | ((actor: import("../identity.types.js").Principal, raw: unknown) => Promise<unknown>)
      | undefined,
    actor: import("../identity.types.js").Principal,
    raw: unknown
  ) {
    if (!action) throw new IdentityError(405, "Creation is not supported for this resource.");
    return action(actor, raw);
  }

  private requireUpdate(
    action:
      | ((
          actor: import("../identity.types.js").Principal,
          id: string,
          raw: unknown
        ) => Promise<unknown>)
      | undefined,
    actor: import("../identity.types.js").Principal,
    id: string,
    raw: unknown
  ) {
    if (!action) throw new IdentityError(405, "Update is not supported for this resource.");
    return action(actor, id, raw);
  }

  private cookie(portal: Portal, token: string, age: number) {
    return `${this.cookieName(portal)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${this.config.origin.startsWith("https:") ? "; Secure" : ""}`;
  }
  private cookieName(portal: Portal) {
    return `${this.config.origin.startsWith("https:") ? "__Host-" : ""}${this.config.appId}_${portal}_session`;
  }
  private token(request: IncomingMessage, portal: Portal) {
    return request.headers.cookie
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${this.cookieName(portal)}=`))
      ?.split("=")[1];
  }
  private json(response: ServerResponse, status: number, body: unknown) {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
  }
  private async body(request: IncomingMessage): Promise<unknown> {
    if (request.headers["content-type"]?.split(";")[0].trim() !== "application/json")
      throw new IdentityError(415, "Use JSON request bodies.");
    const chunks: Buffer[] = [];
    let size = 0;
    if (Number(request.headers["content-length"] ?? 0) > 16384) {
      request.resume();
      throw new IdentityError(413, "Request body is too large.");
    }
    for await (const chunk of request.iterator({ destroyOnReturn: false })) {
      checkIdentityRequest();
      size += chunk.length;
      if (size > 16384) {
        request.resume();
        throw new IdentityError(413, "Request body is too large.");
      }
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new IdentityError(400, "Invalid JSON.");
    }
  }
}
