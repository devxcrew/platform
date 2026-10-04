import type { IncomingMessage, ServerResponse } from "node:http";
import { ZodError } from "zod";
import {
  portalSchema,
  loginSchema,
  passwordSchema,
} from "./identity.schema.js";
import type { IdentityService } from "./identity.service.js";
import { IdentityError } from "./identity.error.js";
import { identityRoutes, portalRoutes } from "./identity.routes.js";
import type { IdentityConfig, Portal } from "./identity.types.js";
import { IdentityAdministrationService } from "./identity.administration-service.js";
import {
  listSchema,
  resourceListQuerySchema,
  membershipDeleteQuerySchema,
  resourceIdSchema,
  type IdentityResource,
} from "./identity.administration-schema.js";
import { IdentityLifecycleService } from "./identity.lifecycle-service.js";
import {
  checkIdentityRequest,
  runIdentityRequest,
} from "./identity.request-context.js";

export class IdentityController {
  constructor(
    private readonly service: IdentityService,
    private readonly config: IdentityConfig,
    private readonly administration: IdentityAdministrationService,
    private readonly lifecycle: IdentityLifecycleService,
  ) {}

  async handle(
    request: IncomingMessage,
    response: ServerResponse,
    signal?: AbortSignal,
  ): Promise<boolean> {
    return runIdentityRequest(signal, () =>
      this.handleRequest(request, response),
    );
  }

  async authenticateRequest(request: IncomingMessage, requestedPortal: Portal, signal?: AbortSignal) {
    return runIdentityRequest(signal, async () => {
      checkIdentityRequest();
      const parsedPortal = portalSchema.safeParse(requestedPortal);
      if (!parsedPortal.success) throw new IdentityError(422, "Validation failed", { portal: ["Select a supported portal."] });
      const portal = parsedPortal.data;
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method ?? "") && request.headers.origin !== this.config.origin)
        throw new IdentityError(403, "Untrusted request origin.");
      const principal = await this.service.authenticate(portal, this.token(request, portal));
      checkIdentityRequest();
      return principal;
    });
  }

  private async handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<boolean> {
    const path =
      new URL(request.url ?? "/", this.config.origin).pathname.replace(
        /\/+$/,
        "",
      ) || "/";
    const api = path.match(
      /^\/api\/v1\/identity\/(user|admin|super-admin)\/(.+)$/,
    );
    const desk = Object.entries(portalRoutes).find(
      ([, routes]) => routes.desk === path,
    );
    if (!api && !desk) return false;
    const portal = portalSchema.parse(api?.[1] ?? desk?.[0]);
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    try {
      checkIdentityRequest();
      const token = this.token(request, portal);
      if (desk) {
        try {
          const principal = await this.service.authenticate(portal, token);
          this.service.requirePermission(principal, `desk.${portal}`);
          return false;
        } catch (error) {
          if (!(error instanceof IdentityError)) throw error;
          response.writeHead(302, { Location: portalRoutes[portal].login });
          response.end();
          return true;
        }
      }
      const route = identityRoutes.find(
        (r) => r.method === request.method && r.path === api?.[2],
      );
      if (
        request.method !== "GET" &&
        request.headers.origin !== this.config.origin
      )
        throw new IdentityError(403, "Untrusted request origin.");
      if (!route) {
        await this.adminRequest(request, response, portal, token, api![2]);
        return true;
      }
      if (route.action === "login") {
        const result = await this.service.login(
          portal,
          loginSchema
            .refine(
              (input) =>
                this.config.mode !== "multi-tenant" || Boolean(input.tenantId),
              { path: ["tenantId"], message: "Enter an organization ID." },
            )
            .parse(await this.body(request)),
          request.socket.remoteAddress ?? "unknown",
          token,
        );
        response.setHeader(
          "Set-Cookie",
          this.cookie(portal, result.token, result.sessionSeconds),
        );
        this.json(response, 201, { data: result.principal });
      } else if (route.action === "logout") {
        await this.service.logout(portal, token);
        response.setHeader("Set-Cookie", this.cookie(portal, "", 0));
        response.writeHead(204);
        response.end();
      } else {
        const principal = await this.service.authenticate(portal, token);
        if (route.action === "password") {
          await this.service.changePassword(
            principal,
            passwordSchema.parse(await this.body(request)),
          );
          response.setHeader("Set-Cookie", this.cookie(portal, "", 0));
          response.writeHead(204);
          response.end();
        } else {
          this.service.requirePermission(principal, `desk.${portal}`);
          this.json(response, 200, { data: principal });
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
          message: "Unable to complete the request.",
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
    path: string,
  ) {
    if (path === "configuration") {
      if (request.method !== "GET")
        throw new IdentityError(405, "Method not allowed.");
      this.json(response, 200, {
        data: await this.administration.configuration(
          this.config.appId,
          this.config.mode === "multi-tenant",
        ),
      });
      return;
    }
    if (
      ["recovery", "recovery/complete", "invitations/accept"].includes(path)
    ) {
      if (request.method !== "POST")
        throw new IdentityError(405, "Method not allowed.");
      const raw = await this.body(request);
      const data =
        path === "recovery"
          ? await this.lifecycle.requestRecovery(
              portal,
              raw,
              request.socket.remoteAddress ?? "unknown",
            )
          : await this.lifecycle.complete(
              portal,
              path === "recovery/complete" ? "recovery" : "invitation",
              raw,
              request.socket.remoteAddress ?? "unknown",
            );
      this.json(response, path === "recovery" ? 202 : 200, { data });
      return;
    }
    const principal = await this.service.authenticate(portal, token);
    if (path === "presentation") {
      if (request.method !== "GET")
        throw new IdentityError(405, "Method not allowed.");
      this.json(response, 200, {
        data: await this.administration.presentation(principal),
      });
      return;
    }
    if (path === "invitations" || path.startsWith("invitations/")) {
      if (path === "invitations" && request.method === "GET") {
        const query = resourceListQuerySchema.parse(
          Object.fromEntries(
            new URL(request.url!, this.config.origin).searchParams,
          ),
        );
        this.json(
          response,
          200,
          this.wireList(await this.lifecycle.list(principal, query)),
        );
      } else if (path === "invitations" && request.method === "POST") {
        this.json(response, 201, {
          data: await this.lifecycle.invite(
            principal,
            await this.body(request),
          ),
        });
      } else if (request.method === "GET") {
        this.json(response, 200, {
          data: await this.lifecycle.show(
            principal,
            resourceIdSchema.parse(path.slice("invitations/".length)),
          ),
        });
      } else if (request.method === "POST" && path.endsWith("/resend")) {
        this.json(response, 201, {
          data: await this.lifecycle.resend(
            principal,
            resourceIdSchema.parse(
              path.slice("invitations/".length, -"/resend".length),
            ),
          ),
        });
      } else if (request.method === "DELETE") {
        await this.lifecycle.revoke(
          principal,
          resourceIdSchema.parse(path.slice("invitations/".length)),
        );
        response.writeHead(204);
        response.end();
      } else throw new IdentityError(405, "Method not allowed.");
      return;
    }
    if (
      [
        "profile",
        "settings",
        "application-settings",
        "security-settings",
      ].includes(path)
    ) {
      if (!["GET", "PATCH"].includes(request.method ?? ""))
        throw new IdentityError(405, "Method not allowed.");
      const input =
        request.method === "PATCH" ? await this.body(request) : undefined;
      const data =
        path === "profile"
          ? await this.administration.profile(principal, input)
          : path === "settings"
            ? await this.administration.settings(principal, input)
            : await this.administration.applicationSettings(
                principal,
                path === "security-settings",
                input,
                this.config.sessionSeconds,
              );
      this.json(response, 200, { data });
      return;
    }
    const match = path.match(
      /^(users|organizations|memberships|roles|permissions|sessions|audit-events)(?:\/([^/]+))?$/,
    );
    if (!match) throw new IdentityError(404, "Not found.");
    const resource = match[1] as IdentityResource;
    const id = match[2]
      ? resourceIdSchema.parse(decodeURIComponent(match[2]))
      : undefined;
    if (request.method === "GET") {
      const query = resourceListQuerySchema.parse(
        Object.fromEntries(
          new URL(request.url!, this.config.origin).searchParams,
        ),
      );
      this.json(
        response,
        200,
        id
          ? { data: await this.administration.show(principal, resource, id) }
          : this.wireList(
              await this.administration.list(principal, resource, query),
            ),
      );
    } else if (request.method === "POST" && !id) {
      this.json(response, 201, {
        data: await this.administration.create(
          principal,
          resource,
          await this.body(request),
        ),
      });
    } else if (request.method === "PATCH" && id) {
      this.json(response, 200, {
        data: await this.administration.update(
          principal,
          resource,
          id,
          await this.body(request),
        ),
      });
    } else if (request.method === "DELETE" && id) {
      const query = new URL(request.url!, this.config.origin).searchParams;
      const expectedVersion =
        resource === "memberships"
          ? membershipDeleteQuerySchema.parse(Object.fromEntries(query))
              .expectedVersion
          : undefined;
      await this.administration.remove(
        principal,
        resource,
        id,
        expectedVersion,
      );
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
        last_page: page.meta.lastPage,
      },
    };
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
    if (
      request.headers["content-type"]?.split(";")[0].trim() !==
      "application/json"
    )
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
