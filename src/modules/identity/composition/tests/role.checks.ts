import assert from "node:assert/strict";
import type { IdentityProviderOptions, Portal } from "../../identity.types.js";
const password = "Test-only strong password!";
type Request = (
  path: string,
  method?: string,
  body?: unknown,
  cookie?: string,
  origin?: string
) => Promise<Response>;
type Login = (
  portal: Portal,
  email: string,
  secret?: string,
  tenantId?: string,
  cookie?: string
) => Promise<Response>;
type Api = (portal: Portal, resource: string, method?: string, body?: unknown) => Promise<Response>;
export async function verifyRoles(
  environment: NodeJS.ProcessEnv,
  request: Request,
  login: Login,
  api: Api,
  setProvider: (options: IdentityProviderOptions) => void
) {
  const custom = await api("admin", "roles", "POST", {
    name: "Read only",
    permissionIds: ["desk.user"]
  });
  assert.equal(custom.status, 201);
  const customRole = (await custom.json()).data;
  assert.equal(customRole.system, false);
  assert.equal(customRole.portal, "user");
  assert.equal(
    (
      await api("admin", "roles", "POST", {
        name: "Escalating role",
        permissionIds: ["desk.user", "identity.manage"]
      })
    ).status,
    403
  );
  assert.equal(
    (
      await api("admin", "roles", "POST", {
        name: "No desk",
        permissionIds: []
      })
    ).status,
    422
  );
  assert.equal(
    (
      await api("admin", "roles/user", "PATCH", {
        permissionIds: ["desk.user", "identity.password"],
        expectedVersion: 0
      })
    ).status,
    403
  );
  const customUserResponse = await api("admin", "users", "POST", {
    name: "Custom account",
    email: "custom@example.test",
    password,
    roleId: customRole.id
  });
  assert.equal(customUserResponse.status, 201);
  const customUser = (await customUserResponse.json()).data;
  const restrictedLogin = await login("user", "custom@example.test");
  assert.equal(restrictedLogin.status, 201);
  const restrictedCookie = restrictedLogin.headers.get("set-cookie")!.split(";")[0];
  assert.deepEqual((await restrictedLogin.json()).data.permissions, ["desk.user"]);
  assert.equal(
    (await request("/api/v1/identity/user/profile", "GET", undefined, restrictedCookie)).status,
    403
  );
  assert.equal(
    (
      await request(
        "/api/v1/identity/user/password",
        "PATCH",
        { currentPassword: password, password },
        restrictedCookie
      )
    ).status,
    403
  );
  const grant = await api("admin", `roles/${customRole.id}`, "PATCH", {
    permissionIds: ["desk.user", "identity.self"],
    expectedVersion: 0
  });
  assert.equal(grant.status, 200);
  assert.equal(
    (await request("/api/v1/identity/user/sessions/current", "GET", undefined, restrictedCookie))
      .status,
    401
  );
  assert.equal(
    (
      await api("admin", `roles/${customRole.id}`, "PATCH", {
        name: "Stale",
        expectedVersion: 0
      })
    ).status,
    409
  );
  const membershipKey = `${customUser.id}~default~user`;
  const originalApp = environment.APP_ID;
  environment.APP_ID = "other-app";
  setProvider({});
  assert.equal((await login("user", "custom@example.test")).status, 401);
  const otherLogin = await login("admin", "admin@example.test");
  assert.equal(otherLogin.status, 201);
  const otherCookie = otherLogin.headers.get("set-cookie")!.split(";")[0];
  assert.equal(
    (
      await request(
        `/api/v1/identity/admin/memberships/${membershipKey}`,
        "GET",
        undefined,
        otherCookie
      )
    ).status,
    404
  );
  assert.equal(
    (
      await request(
        `/api/v1/identity/admin/memberships/${membershipKey}?expectedVersion=0`,
        "DELETE",
        undefined,
        otherCookie
      )
    ).status,
    404
  );
  assert.equal(
    (await request(`/api/v1/identity/admin/users/${customUser.id}`, "GET", undefined, otherCookie))
      .status,
    404
  );
  assert.equal(
    (await request(`/api/v1/identity/admin/roles/${customRole.id}`, "GET", undefined, otherCookie))
      .status,
    404
  );
  environment.APP_ID = originalApp;
  setProvider({});
  assert.equal(
    (
      await api("admin", `memberships/${membershipKey}`, "PATCH", {
        roleId: "admin",
        active: true,
        expectedVersion: 0
      })
    ).status,
    403
  );
  assert.equal(
    (
      await api("admin", `memberships/${membershipKey}`, "PATCH", {
        roleId: customRole.id,
        active: false,
        expectedVersion: 0
      })
    ).status,
    200
  );
  assert.equal((await login("user", "custom@example.test")).status, 401);
  assert.equal(
    (
      await api("admin", `memberships/${membershipKey}`, "PATCH", {
        roleId: customRole.id,
        active: true,
        expectedVersion: 0
      })
    ).status,
    409
  );
  assert.equal(
    (
      await api("admin", `memberships/${membershipKey}`, "PATCH", {
        roleId: customRole.id,
        active: true,
        expectedVersion: 1
      })
    ).status,
    200
  );
  const grantedLogin = await login("user", "custom@example.test");
  assert.equal(grantedLogin.status, 201);
  assert.equal(
    (
      await request(
        "/api/v1/identity/user/profile",
        "GET",
        undefined,
        grantedLogin.headers.get("set-cookie")!.split(";")[0]
      )
    ).status,
    200
  );
  assert.equal(
    (
      await api("admin", `roles/${customRole.id}`, "PATCH", {
        active: false,
        expectedVersion: 1
      })
    ).status,
    200
  );
  assert.equal((await login("user", "custom@example.test")).status, 401);
  assert.equal(
    (
      await api("admin", `memberships/${membershipKey}`, "PATCH", {
        roleId: "user",
        active: true,
        expectedVersion: 2
      })
    ).status,
    200
  );
  assert.equal((await login("user", "custom@example.test")).status, 201);
  assert.equal(
    (await api("admin", `memberships/${membershipKey}?expectedVersion=2`, "DELETE")).status,
    409
  );
  assert.equal((await api("admin", `memberships/${membershipKey}`, "DELETE")).status, 422);
}
