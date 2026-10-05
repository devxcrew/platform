import { verifyAdministration } from "./identity.administration.checks.js";
import { verifyListPerformance } from "./identity.performance.checks.js";
import { runIdentityRequest } from "../../support/identity.request-context.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { Kysely, SqliteDialect } from "kysely";
import { Migrator } from "kysely/migration";
import { createIdentityProvider } from "../../identity.provider.js";
import { identityMigration } from "../../legacy/identity.migration.js";
import { identityAdministrationMigration } from "../../legacy/identity.administration-migration.js";
import { identityRolesMigration } from "../../role/role.migration.js";
import { identityPermissionDeclarationsMigration } from "../../permission/permission.declarations.migration.js";
import { identityPermissionLabelsMigration } from "../../permission/permission.labels.migration.js";
import { seedIdentity } from "../../../../index.js";
import type { IdentitySchema, Portal } from "../../identity.types.js";

const password = "Test-only strong password!";

function openDatabase(path: string) {
  const sqlite = new DatabaseSync(path);
  sqlite.exec("PRAGMA foreign_keys = ON");
  return new Kysely<IdentitySchema>({
    dialect: new SqliteDialect({
      database: {
        close: () => sqlite.close(),
        prepare(query) {
          const statement = sqlite.prepare(query);
          statement.setReadBigInts(true);
          return {
            reader: statement.columns().length > 0,
            all: (parameters: readonly unknown[]) =>
              statement.all(...(parameters as SQLInputValue[])),
            run: (parameters: readonly unknown[]) =>
              statement.run(...(parameters as SQLInputValue[])),
            iterate: (parameters: readonly unknown[]) =>
              statement.iterate(...(parameters as SQLInputValue[]))
          };
        }
      }
    })
  });
}

test("public module permission declarations are owned, scoped and explicitly granted", async () => {
  const directory = await mkdtemp(join(tmpdir(), "platform-permissions-"));
  const db = openDatabase(join(directory, "permissions.sqlite"));
  let server: ReturnType<typeof createServer> | undefined;
  try {
    const migrator = new Migrator({
      db,
      provider: {
        async getMigrations() {
          return {
            "001_identity": identityMigration,
            "002_administration": identityAdministrationMigration,
            "003_roles": identityRolesMigration,
            "004_permissions": identityPermissionDeclarationsMigration,
            "005_labels": identityPermissionLabelsMigration
          };
        }
      }
    });
    assert.equal((await migrator.migrateToLatest()).error, undefined);
    server = createServer((request, response) => {
      if (request.url?.startsWith("/diagnostic-auth")) {
        const aborted = new AbortController();
        if (request.url.includes("abort")) aborted.abort();
        const portal =
          new URL(request.url, "http://localhost").searchParams.get("portal") ?? "user";
        void provider
          .authenticateRequest(request, portal as Portal, aborted.signal)
          .then((principal) => {
            response.writeHead(200, { "Content-Type": "application/json" });
            response.end(JSON.stringify({ portal: principal.portal }));
          })
          .catch((error) => {
            response.writeHead(error.status ?? 422);
            response.end("Denied");
          });
      } else void provider.handle(request, response);
    });
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test port");
    const env = {
      APP_ID: "testapp",
      APP_URL: `http://127.0.0.1:${address.port}`,
      IDENTITY_SEED_USER_EMAIL: "permissions@example.test",
      IDENTITY_SEED_USER_PASSWORD: password,
      IDENTITY_SEED_ADMIN_EMAIL: "permissions-admin@example.test",
      IDENTITY_SEED_ADMIN_PASSWORD: password,
      IDENTITY_SEED_SUPER_ADMIN_EMAIL: "permissions-super@example.test",
      IDENTITY_SEED_SUPER_ADMIN_PASSWORD: password
    };
    await seedIdentity(db, env);
    const declaration = {
      owner: "diagnostic",
      permissions: [
        {
          id: "testapp.diagnostic.read",
          portals: ["user" as const],
          label: "Read diagnostic status"
        },
        { id: "testapp.diagnostic.manage", portals: ["admin" as const] }
      ]
    };
    const provider = createIdentityProvider(db, env, { permissions: [declaration] });
    await provider.verify();
    await provider.registerPermissions(declaration);
    assert.equal(
      (await db.selectFrom("identity_permission_declarations").selectAll().execute()).length,
      2
    );
    assert.equal(
      (
        await db
          .selectFrom("identity_role_permissions")
          .selectAll()
          .where("permission_id", "like", "testapp.%")
          .execute()
      ).length,
      0
    );
    await assert.rejects(
      provider.registerPermissions({ owner: "other", permissions: declaration.permissions }),
      /namespace/
    );
    await assert.rejects(
      provider.registerPermissions({
        owner: "diagnostic",
        permissions: [{ id: "testapp.diagnostic.read", portals: ["admin"] }]
      }),
      /conflicts/
    );
    await assert.rejects(
      provider.registerPermissions({
        owner: "identity",
        permissions: [{ id: "identity.manage", portals: ["user"] }]
      })
    );
    await assert.rejects(
      provider.registerPermissions({
        owner: "diagnostic",
        permissions: [{ id: "testapp.diagnostic.unsafe", portals: ["user"], grant: true }]
      } as never)
    );
    const loginToken = async (portal: Portal, email: string, base = env.APP_URL) => {
      const response = await fetch(`${base}/api/v1/identity/${portal}/sessions`, {
        method: "POST",
        headers: { Origin: base, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      assert.equal(response.status, 201);
      return response.headers.get("set-cookie")!.split(";")[0].split("=")[1];
    };
    const actor = await provider.authenticate(
      "admin",
      await loginToken("admin", env.IDENTITY_SEED_ADMIN_EMAIL)
    );
    assert.throws(
      () => provider.requirePermission(actor, "testapp.diagnostic.read"),
      /Access denied/
    );
    const superActor = await provider.authenticate(
      "super-admin",
      await loginToken("super-admin", env.IDENTITY_SEED_SUPER_ADMIN_EMAIL)
    );
    const systemUser = await provider.administration.show(superActor, "roles", "user");
    await assert.rejects(
      provider.administration.update(superActor, "roles", "user", {
        permissionIds: [...(systemUser.permissionIds as string[]), "testapp.diagnostic.manage"],
        expectedVersion: systemUser.version
      }),
      /unavailable/
    );
    const systemAdmin = await provider.administration.show(superActor, "roles", "admin");
    await provider.administration.update(superActor, "roles", "admin", {
      permissionIds: [...(systemAdmin.permissionIds as string[]), "testapp.diagnostic.manage"],
      expectedVersion: systemAdmin.version
    });
    const grantedAdmin = await provider.authenticate(
      "admin",
      await loginToken("admin", env.IDENTITY_SEED_ADMIN_EMAIL)
    );
    provider.requirePermission(grantedAdmin, "testapp.diagnostic.manage");
    const catalog = await provider.administration.list(actor, "permissions", {
      page: 1,
      perPage: 100,
      search: "",
      sort: "id",
      direction: "asc"
    });
    assert.ok(catalog.data.some((row) => row.id === "testapp.diagnostic.read"));
    assert.deepEqual(
      catalog.data.find((row) => row.id === "testapp.diagnostic.read"),
      {
        id: "testapp.diagnostic.read",
        label: "Read diagnostic status",
        owner: "diagnostic",
        appId: "testapp",
        portals: ["user"]
      }
    );
    const fallback = await provider.administration.show(
      actor,
      "permissions",
      "testapp.diagnostic.manage"
    );
    assert.equal(fallback.label, "testapp.diagnostic.manage");
    assert.deepEqual(fallback.portals, ["admin"]);
    await provider.registerPermissions({
      owner: "diagnostic",
      permissions: [
        { id: "testapp.diagnostic.read", portals: ["user"], label: "View diagnostic status" }
      ]
    });
    const relabeled = await provider.administration.show(
      actor,
      "permissions",
      "testapp.diagnostic.read"
    );
    assert.equal(relabeled.label, "View diagnostic status");
    assert.equal(
      (
        await db
          .selectFrom("identity_role_permissions")
          .selectAll()
          .where("permission_id", "=", "testapp.diagnostic.read")
          .execute()
      ).length,
      0
    );
    await assert.rejects(
      provider.registerPermissions({
        owner: "diagnostic",
        permissions: [{ id: "testapp.diagnostic.unsafe", portals: ["user"], label: "\n" }]
      })
    );
    await assert.rejects(
      provider.administration.create(actor, "roles", {
        name: "Wrong portal",
        permissionIds: ["desk.user", "testapp.diagnostic.manage"]
      }),
      /unavailable/
    );
    const role = await provider.administration.create(actor, "roles", {
      name: "Diagnostic reader",
      permissionIds: ["desk.user", "testapp.diagnostic.read"]
    });
    const user = await db
      .selectFrom("identity_users")
      .select("id")
      .where("email", "=", env.IDENTITY_SEED_USER_EMAIL)
      .executeTakeFirstOrThrow();
    const membershipId = `${user.id}~default~user`;
    await provider.administration.update(actor, "memberships", membershipId, {
      roleId: role.id,
      active: true,
      expectedVersion: 0
    });
    // Authenticate through the same public provider after an explicitly granted membership.
    const readerToken = await loginToken("user", env.IDENTITY_SEED_USER_EMAIL);
    const reader = await provider.authenticate("user", readerToken);
    provider.requirePermission(reader, "testapp.diagnostic.read");
    assert.throws(
      () => provider.requirePermission(reader, "testapp.diagnostic.manage"),
      /Access denied/
    );
    const cookie = `testapp_user_session=${readerToken}`;
    const transport = (path: string, method = "GET", suppliedCookie = cookie, origin?: string) =>
      fetch(env.APP_URL + path, {
        method,
        headers: { Cookie: suppliedCookie, ...(origin ? { Origin: origin } : {}) }
      });
    assert.equal((await transport("/diagnostic-auth")).status, 200);
    assert.equal((await transport("/diagnostic-auth", "GET", "")).status, 401);
    assert.equal(
      (await transport("/diagnostic-auth", "GET", "testapp_user_session=invalid")).status,
      401
    );
    assert.equal((await transport("/diagnostic-auth?portal=admin")).status, 401);
    assert.equal((await transport("/diagnostic-auth?portal=invalid")).status, 422);
    assert.equal((await transport("/diagnostic-auth", "POST")).status, 403);
    assert.equal(
      (await transport("/diagnostic-auth", "POST", cookie, "https://untrusted.example")).status,
      403
    );
    assert.equal((await transport("/diagnostic-auth", "POST", cookie, env.APP_URL)).status, 200);
    assert.equal((await transport("/diagnostic-auth/abort")).status, 408);
    const other = createIdentityProvider(db, { ...env, APP_ID: "otherapp" });
    const otherActor = { ...actor, appId: "otherapp" };
    const otherCatalog = await other.administration.list(otherActor, "permissions", {
      page: 1,
      perPage: 100,
      search: "",
      sort: "id",
      direction: "asc"
    });
    assert.ok(!otherCatalog.data.some((row) => row.id === "testapp.diagnostic.read"));
    await assert.rejects(
      other.administration.create(otherActor, "roles", {
        name: "Cross app",
        permissionIds: ["desk.user", "testapp.diagnostic.read"]
      }),
      /unavailable/
    );
    let foreignProvider: ReturnType<typeof createIdentityProvider>;
    const foreignServer = createServer((request, response) => {
      void foreignProvider.handle(request, response);
    });
    try {
      await new Promise<void>((resolve) => foreignServer.listen(0, "127.0.0.1", resolve));
      const foreignAddress = foreignServer.address();
      if (!foreignAddress || typeof foreignAddress === "string")
        throw new Error("Missing foreign app port");
      const foreignBase = `http://127.0.0.1:${foreignAddress.port}`;
      foreignProvider = createIdentityProvider(db, {
        ...env,
        APP_ID: "otherapp",
        APP_URL: foreignBase
      });
      const foreignAdmin = await foreignProvider.authenticate(
        "admin",
        await loginToken("admin", env.IDENTITY_SEED_ADMIN_EMAIL, foreignBase)
      );
      assert.throws(
        () => foreignProvider.requirePermission(foreignAdmin, "testapp.diagnostic.manage"),
        /Access denied/
      );
    } finally {
      await new Promise<void>((resolve) => foreignServer.close(() => resolve()));
    }
    assert.equal((await migrator.migrateDown()).error, undefined);
    const rollback = await migrator.migrateDown();
    assert.match(String(rollback.error), /compatible snapshot/);
    assert.equal(
      (await db.selectFrom("identity_permission_declarations").selectAll().execute()).length,
      2
    );
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await db.destroy();
    await rm(directory, { recursive: true, force: true });
  }
});

test("identity HTTP authentication, roles, tenancy, revocation, and validation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "platform-identity-"));
  const databasePath = join(directory, "identity.sqlite");
  let db = openDatabase(databasePath);
  let provider: ReturnType<typeof createIdentityProvider>;
  const server = createServer((request, response) => {
    void provider.handle(request, response).then((handled) => {
      if (!handled) {
        response.writeHead(200);
        response.end("Desk HTML");
      }
    });
  });
  try {
    const migrator = new Migrator({
      db,
      provider: {
        async getMigrations() {
          return {
            "001_identity": identityMigration,
            "002_identity_administration": identityAdministrationMigration,
            "003_identity_roles": identityRolesMigration,
            "004_identity_permissions": identityPermissionDeclarationsMigration,
            "005_identity_labels": identityPermissionLabelsMigration
          };
        }
      }
    });
    assert.equal((await migrator.migrateToLatest()).error, undefined);
    assert.deepEqual((await migrator.migrateToLatest()).results, []);
    const environment: NodeJS.ProcessEnv = {
      APP_ID: "cxsun",
      APP_NAME: "Foundation test",
      IDENTITY_TENANT_ID: "default",
      IDENTITY_SEED_USER_EMAIL: "user@example.test",
      IDENTITY_SEED_USER_PASSWORD: password,
      IDENTITY_SEED_ADMIN_EMAIL: "admin@example.test",
      IDENTITY_SEED_ADMIN_PASSWORD: password,
      IDENTITY_SEED_SUPER_ADMIN_EMAIL: "super@example.test",
      IDENTITY_SEED_SUPER_ADMIN_PASSWORD: password
    };
    await seedIdentity(db, environment);
    await seedIdentity(db, environment);
    assert.equal((await db.selectFrom("identity_users").selectAll().execute()).length, 3);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test port");
    const base = `http://127.0.0.1:${address.port}`;
    environment.APP_URL = base;
    provider = createIdentityProvider(db, environment);
    await provider.verify();
    const request = (path: string, method = "GET", body?: unknown, cookie = "", origin = base) =>
      fetch(base + path, {
        method,
        redirect: "manual",
        headers: {
          Origin: origin,
          Cookie: cookie,
          "Content-Type": "application/json"
        },
        body: body ? JSON.stringify(body) : undefined
      });
    const login = (
      portal: Portal,
      email: string,
      secret = password,
      tenantId?: string,
      cookie?: string
    ) =>
      request(
        `/api/v1/identity/${portal}/sessions`,
        "POST",
        { email, password: secret, tenantId },
        cookie
      );
    const current = (portal: Portal, cookie: string) =>
      request(`/api/v1/identity/${portal}/sessions/current`, "GET", undefined, cookie);
    const publicConfiguration = await request("/api/v1/identity/user/configuration");
    assert.equal(publicConfiguration.status, 200);
    assert.deepEqual((await publicConfiguration.json()).data, {
      displayName: "Foundation test",
      requiresOrganizationId: false
    });
    for (const desk of ["/desk", "/admin/desk", "/sa/desk"])
      assert.equal((await request(desk)).status, 302);
    assert.equal((await current("user", "")).status, 401);
    assert.equal((await login("admin", "user@example.test")).status, 401);
    assert.equal((await login("user", "missing@example.test")).status, 401);
    assert.equal((await login("user", "user@example.test", "wrong")).status, 401);
    assert.equal((await login("user", "user@example.test", password, "foreign")).status, 401);
    assert.equal(
      (
        await request("/api/v1/identity/user/sessions", "POST", {
          email: "bad",
          password: "x"
        })
      ).status,
      422
    );
    assert.equal(
      (
        await request("/api/v1/identity/user/sessions", "POST", {
          email: "user@example.test",
          password,
          role: "super-admin"
        })
      ).status,
      422
    );
    assert.equal(
      (
        await request(
          "/api/v1/identity/user/sessions",
          "POST",
          { email: "user@example.test", password },
          "",
          "https://evil.example"
        )
      ).status,
      403
    );
    const cookies: Partial<Record<Portal, string>> = {};
    for (const [portal, email, desk] of [
      ["user", "user@example.test", "/desk"],
      ["admin", "admin@example.test", "/admin/desk"],
      ["super-admin", "super@example.test", "/sa/desk"]
    ] as const) {
      const response = await login(portal, email);
      assert.equal(response.status, 201);
      const setCookie = response.headers.get("set-cookie")!;
      assert.ok(setCookie.includes("HttpOnly"));
      assert.ok(setCookie.includes("SameSite=Strict"));
      cookies[portal] = setCookie.split(";")[0];
      const payload = await response.json();
      assert.equal(payload.data.portal, portal);
      assert.equal(payload.data.tenant.id, "default");
      assert.equal(payload.data.user.password_hash, undefined);
      assert.equal((await request(desk, "GET", undefined, cookies[portal])).status, 200);
    }
    const userCookie = cookies.user!;
    await verifyAdministration(db, environment, request, login, cookies, (options) => {
      provider = createIdentityProvider(db, environment, options);
    });
    const performanceSession = await login("super-admin", "super@example.test");
    assert.equal(performanceSession.status, 201);
    const performanceCookie = performanceSession.headers.get("set-cookie")!.split(";")[0];
    await verifyListPerformance(db, () =>
      request(
        "/api/v1/identity/super-admin/users?search=performance-fixture-&per_page=100&sort=name",
        "GET",
        undefined,
        performanceCookie
      )
    );
    const updatedConfiguration = (
      await request("/api/v1/identity/user/configuration").then((response) => response.json())
    ).data;
    assert.deepEqual(updatedConfiguration, {
      displayName: "Foundation app",
      requiresOrganizationId: false
    });
    assert.equal((await current("admin", userCookie.replace("_user_", "_admin_"))).status, 401);
    const token = userCookie.split("=")[1];
    const other = createIdentityProvider(db, { ...environment, APP_ID: "crm" });
    await assert.rejects(other.authenticate("user", token), /Sign in/);
    const persisted = await db.selectFrom("identity_sessions").selectAll().execute();
    assert.ok(
      persisted.every((session) => session.token_hash !== token && session.token_hash.length === 64)
    );
    const principal = await provider.authenticate("user", token);
    assert.throws(() => provider.requirePermission(principal, "desk.admin"), /Access denied/);
    const rotation = await login("user", "user@example.test", password, undefined, userCookie);
    const rotatedCookie = rotation.headers.get("set-cookie")!.split(";")[0];
    assert.equal((await current("user", userCookie)).status, 401);
    assert.equal((await current("user", rotatedCookie)).status, 200);
    await request("/api/v1/identity/user/sessions/current", "DELETE", undefined, rotatedCookie);
    assert.equal((await current("user", rotatedCookie)).status, 401);
    assert.equal((await current("admin", cookies.admin!)).status, 200);
    await db
      .insertInto("identity_tenants")
      .values({ id: "other", name: "Other tenant", active: 1 })
      .execute();
    provider = createIdentityProvider(db, {
      ...environment,
      IDENTITY_MODE: "multi-tenant"
    });
    assert.equal(
      (await request("/api/v1/identity/user/configuration").then((response) => response.json()))
        .data.requiresOrganizationId,
      true
    );
    const missingOrganization = await login("user", "user@example.test");
    assert.equal(missingOrganization.status, 422);
    assert.ok((await missingOrganization.json()).errors.tenantId.length > 0);
    const recoveryMissingOrganization = await request("/api/v1/identity/user/recovery", "POST", {
      email: "user@example.test"
    });
    assert.equal(recoveryMissingOrganization.status, 422);
    assert.ok((await recoveryMissingOrganization.json()).errors.tenantId.length > 0);
    assert.equal((await login("user", "user@example.test", password, "other")).status, 401);
    await db
      .insertInto("identity_memberships")
      .values({
        user_id: principal.user.id,
        tenant_id: "other",
        role_id: "user"
      })
      .execute();
    const tenantLogin = await login("user", "user@example.test", password, "other");
    assert.equal(tenantLogin.status, 201);
    assert.equal((await tenantLogin.json()).data.tenant.id, "other");
    const tenantCookie = tenantLogin.headers.get("set-cookie")!.split(";")[0];
    provider = createIdentityProvider(db, environment);
    assert.equal((await current("user", tenantCookie)).status, 401);
    const newLogin = await login("user", "user@example.test");
    const newCookie = newLogin.headers.get("set-cookie")!.split(";")[0];
    assert.equal(
      (
        await request(
          "/api/v1/identity/user/password",
          "PATCH",
          { currentPassword: password, password: "New test-only password!" },
          newCookie
        )
      ).status,
      204
    );
    assert.equal((await current("user", newCookie)).status, 401);
    await seedIdentity(db, environment);
    assert.equal((await login("user", "user@example.test", password)).status, 401);
    const changed = await login("user", "user@example.test", "New test-only password!");
    assert.equal(changed.status, 201);
    const changedCookie = changed.headers.get("set-cookie")!.split(";")[0];
    await db
      .updateTable("identity_users")
      .set({ active: 0 })
      .where("id", "=", principal.user.id)
      .execute();
    assert.equal((await current("user", changedCookie)).status, 401);
    await db
      .updateTable("identity_users")
      .set({ active: 1 })
      .where("id", "=", principal.user.id)
      .execute();
    await db
      .updateTable("identity_sessions")
      .set({ expires_at: new Date(0).toISOString() })
      .execute();
    assert.equal((await current("admin", cookies.admin!)).status, 401);
    for (let index = 0; index < 10; index++) await login("user", "blocked@example.test", "wrong");
    assert.equal((await login("user", "blocked@example.test", "wrong")).status, 429);
    assert.throws(
      () =>
        createIdentityProvider(db, {
          ...environment,
          APP_URL: "http://public.example"
        }),
      /HTTPS/
    );
    provider = createIdentityProvider(db, {
      ...environment,
      APP_URL: "https://cxsun.example"
    });
    const secure = await request(
      "/api/v1/identity/admin/sessions",
      "POST",
      { email: "admin@example.test", password },
      "",
      "https://cxsun.example"
    );
    assert.equal(secure.status, 201);
    assert.ok(secure.headers.get("set-cookie")!.startsWith("__Host-cxsun_admin_session="));
    assert.ok(secure.headers.get("set-cookie")!.includes("; Secure"));
    const persistedToken = secure.headers.get("set-cookie")!.split(";")[0].split("=")[1];
    await db.destroy();
    db = openDatabase(databasePath);
    provider = createIdentityProvider(db, {
      ...environment,
      APP_URL: "https://cxsun.example"
    });
    assert.equal(
      (await provider.authenticate("admin", persistedToken)).user.email,
      "admin@example.test"
    );
    const restarted = await provider.authenticate("admin", persistedToken);
    assert.equal((await provider.administration.settings(restarted)).displayName, "Configured");
    const expired = new AbortController();
    expired.abort();
    await assert.rejects(
      runIdentityRequest(expired.signal, () =>
        provider.administration.settings(restarted, {
          displayName: "Expired write",
          locale: "en",
          timeZone: "UTC",
          expectedVersion: 1
        })
      ),
      /expired/
    );
    assert.equal((await provider.administration.settings(restarted)).displayName, "Configured");
    assert.ok(
      (
        await provider.administration.list(restarted, "audit-events", {
          page: 1,
          perPage: 20,
          search: "",
          sort: "id",
          direction: "asc"
        })
      ).meta.total > 0
    );
    const settingsRead = await request(
      "/api/v1/identity/admin/security-settings",
      "GET",
      undefined,
      secure.headers.get("set-cookie")!.split(";")[0]
    );
    assert.equal(settingsRead.status, 200);
    const superLogin = await request(
      "/api/v1/identity/super-admin/sessions",
      "POST",
      { email: "super@example.test", password },
      "",
      "https://cxsun.example"
    );
    const restartedSuperCookie = superLogin.headers.get("set-cookie")!.split(";")[0];
    const security = await request(
      "/api/v1/identity/super-admin/security-settings",
      "PATCH",
      {
        sessionSeconds: 600,
        expectedVersion: (await settingsRead.json()).data.version
      },
      restartedSuperCookie,
      "https://cxsun.example"
    );
    assert.equal(security.status, 200);
    assert.equal(
      (await current("admin", secure.headers.get("set-cookie")!.split(";")[0])).status,
      401
    );
    const bounded = await request(
      "/api/v1/identity/admin/sessions",
      "POST",
      { email: "admin@example.test", password },
      "",
      "https://cxsun.example"
    );
    assert.ok(bounded.headers.get("set-cookie")!.includes("Max-Age=600"));
    const rolesBeforeRollback = await db
      .selectFrom("identity_custom_roles")
      .selectAll()
      .orderBy("id")
      .execute();
    const membersBeforeRollback = await db
      .selectFrom("identity_memberships")
      .selectAll()
      .orderBy("user_id")
      .orderBy("tenant_id")
      .orderBy("role_id")
      .execute();
    const rollbackMigrator = new Migrator({
      db,
      provider: {
        async getMigrations() {
          return {
            "001_identity": identityMigration,
            "002_identity_administration": identityAdministrationMigration,
            "003_identity_roles": identityRolesMigration,
            "004_identity_permissions": identityPermissionDeclarationsMigration,
            "005_identity_labels": identityPermissionLabelsMigration
          };
        }
      }
    });
    assert.equal((await rollbackMigrator.migrateDown()).error, undefined);
    assert.equal((await rollbackMigrator.migrateDown()).error, undefined);
    const rollback = await rollbackMigrator.migrateDown();
    assert.match(String(rollback.error), /Restore a compatible database snapshot/);
    assert.deepEqual(
      await db.selectFrom("identity_custom_roles").selectAll().orderBy("id").execute(),
      rolesBeforeRollback
    );
    assert.deepEqual(
      await db
        .selectFrom("identity_memberships")
        .selectAll()
        .orderBy("user_id")
        .orderBy("tenant_id")
        .orderBy("role_id")
        .execute(),
      membersBeforeRollback
    );
    await db.schema.dropTable("identity_tokens").execute();
    await assert.rejects(provider.verify());
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.destroy();
    await rm(directory, { recursive: true, force: true });
  }
});

test("role rollback preserves an inactive membership without custom roles", async () => {
  const directory = await mkdtemp(join(tmpdir(), "platform-rollback-"));
  const db = openDatabase(join(directory, "identity.sqlite"));
  try {
    const migrator = new Migrator({
      db,
      provider: {
        async getMigrations() {
          return {
            "001_identity": identityMigration,
            "002_administration": identityAdministrationMigration,
            "003_roles": identityRolesMigration
          };
        }
      }
    });
    assert.equal((await migrator.migrateToLatest()).error, undefined);
    await seedIdentity(db, {
      APP_ID: "rollback-test",
      IDENTITY_SEED_USER_EMAIL: "rollback@example.test",
      IDENTITY_SEED_USER_PASSWORD: password
    });
    const user = await db.selectFrom("identity_users").select("id").executeTakeFirstOrThrow();
    await db
      .updateTable("identity_memberships")
      .set({ active: 0 })
      .where("user_id", "=", user.id)
      .execute();
    const before = await db.selectFrom("identity_memberships").selectAll().execute();
    const rollback = await migrator.migrateDown();
    assert.match(String(rollback.error), /Restore a compatible database snapshot/);
    assert.deepEqual(await db.selectFrom("identity_memberships").selectAll().execute(), before);
    assert.equal((await db.selectFrom("identity_custom_roles").selectAll().execute()).length, 0);
  } finally {
    await db.destroy();
    await rm(directory, { recursive: true, force: true });
  }
});
