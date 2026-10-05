import { verifyRoles } from "./role.checks.js";
import assert from "node:assert/strict";
import type { Kysely } from "kysely";
import type { IdentitySchema, IdentityProviderOptions, Portal } from "../identity.types.js";
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

export async function verifyAdministration(
  db: Kysely<IdentitySchema>,
  environment: NodeJS.ProcessEnv,
  request: Request,
  login: Login,
  cookies: Partial<Record<Portal, string>>,
  setProvider: (options: IdentityProviderOptions) => void
) {
  const userCookie = cookies.user!;
  const adminCookie = cookies.admin!;
  const superCookie = cookies["super-admin"]!;
  const api = (portal: Portal, resource: string, method = "GET", body?: unknown) =>
    request(
      `/api/v1/identity/${portal}/${resource}`,
      method,
      body,
      portal === "user" ? userCookie : portal === "admin" ? adminCookie : superCookie
    );
  assert.equal((await api("user", "users")).status, 403);
  const userList = await api("admin", "users?page=1&per_page=2");
  assert.equal(userList.status, 200);
  const listed = await userList.json();
  assert.equal(listed.data.length, 2);
  assert.equal(listed.meta.total, 3);
  assert.equal(listed.meta.current_page, 1);
  assert.equal(listed.meta.per_page, 2);
  assert.equal(listed.meta.last_page, 2);
  assert.equal(listed.meta.perPage, undefined);
  assert.ok(listed.data.every((row: Record<string, unknown>) => row.password_hash === undefined));
  assert.equal((await api("admin", "users?per_page=1000")).status, 422);
  assert.equal((await api("admin", "users?perPage=2")).status, 422);
  assert.equal((await api("admin", "sessions?sort=email")).status, 422);
  assert.equal((await api("admin", "organizations?sort=email")).status, 422);
  assert.equal((await api("admin", "audit-events?sort=name")).status, 422);
  assert.equal(
    (
      await api("admin", "users", "POST", {
        name: "Escalation",
        email: "bad-admin@example.test",
        password,
        roleId: "admin"
      })
    ).status,
    403
  );
  const created = await api("admin", "users", "POST", {
    name: "Managed user",
    email: "managed@example.test",
    password,
    roleId: "user"
  });
  assert.equal(created.status, 201);
  const managed = (await created.json()).data;
  await verifyRoles(environment, request, login, api, setProvider);
  assert.equal(
    (
      await api("admin", `users/${managed.id}`, "PATCH", {
        name: "Updated user",
        expectedVersion: 0
      })
    ).status,
    200
  );
  assert.equal(
    (
      await api("admin", `users/${managed.id}`, "PATCH", {
        name: "Stale update",
        expectedVersion: 0
      })
    ).status,
    409
  );
  assert.equal(
    (
      await api("admin", `users/${managed.id}`, "PATCH", {
        password_hash: "unsafe"
      })
    ).status,
    422
  );
  assert.equal(
    (
      await api("admin", "users", "POST", {
        name: "Duplicate",
        email: "managed@example.test",
        password
      })
    ).status,
    409
  );
  const adminId = (
    await db
      .selectFrom("identity_users")
      .select("id")
      .where("email", "=", "admin@example.test")
      .executeTakeFirstOrThrow()
  ).id;
  assert.equal(
    (
      await api("super-admin", `memberships/${adminId}~default~admin`, "PATCH", {
        roleId: "admin",
        active: false,
        expectedVersion: 0
      })
    ).status,
    409
  );
  assert.equal(
    (
      await api("super-admin", `users/${adminId}`, "PATCH", {
        active: false,
        expectedVersion: 0
      })
    ).status,
    409
  );
  assert.equal(
    (
      await api("admin", `users/${adminId}`, "PATCH", {
        name: "Unauthorized",
        expectedVersion: 0
      })
    ).status,
    403
  );
  assert.equal(
    (
      await api("admin", "organizations", "POST", {
        id: "isolated",
        name: "Isolated"
      })
    ).status,
    403
  );
  assert.equal(
    (
      await api("super-admin", "organizations", "POST", {
        id: "isolated",
        name: "Isolated"
      })
    ).status,
    201
  );
  assert.equal((await api("admin", "organizations/isolated")).status, 404);
  assert.equal(
    (
      await api("admin", "memberships", "POST", {
        userId: managed.id,
        tenantId: "isolated",
        roleId: "user"
      })
    ).status,
    403
  );
  const membership = await api("super-admin", "memberships", "POST", {
    userId: managed.id,
    tenantId: "isolated",
    roleId: "user"
  });
  assert.equal(membership.status, 201);
  assert.equal(
    (
      await api("admin", `users/${managed.id}`, "PATCH", {
        name: "Cross organization",
        expectedVersion: 1
      })
    ).status,
    403
  );
  const membershipId = (await membership.json()).data.id;
  assert.equal(
    (await api("super-admin", `memberships/${membershipId}?expectedVersion=0`, "DELETE")).status,
    204
  );
  const isolatedAudits = await db
    .selectFrom("identity_audit_events")
    .selectAll()
    .where("tenant_id", "=", "isolated")
    .execute();
  assert.ok(isolatedAudits.some((row) => row.resource_id === membershipId));
  assert.ok(!isolatedAudits.some((row) => row.resource_id === managed.id));
  const isolatedUser = await api("super-admin", "users", "POST", {
    name: "Isolated account",
    email: "isolated@example.test",
    password,
    tenantId: "isolated"
  });
  assert.equal(isolatedUser.status, 201);
  const isolatedId = (await isolatedUser.json()).data.id;
  assert.equal((await api("admin", `users/${isolatedId}`)).status, 404);
  const scopedAudit = await db
    .selectFrom("identity_audit_events")
    .select("tenant_id")
    .where("resource_id", "=", isolatedId)
    .execute();
  assert.deepEqual(
    scopedAudit.map((row) => row.tenant_id),
    ["isolated"]
  );
  const concurrent = await Promise.all([
    api("super-admin", "profile", "PATCH", {
      name: "First change",
      expectedVersion: 0
    }),
    api("super-admin", "profile", "PATCH", {
      name: "Second change",
      expectedVersion: 0
    })
  ]);
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [200, 409]);
  assert.equal(
    (
      await api("user", "profile", "PATCH", {
        name: "My profile",
        expectedVersion: 0
      })
    ).status,
    200
  );
  assert.equal(
    (
      await api("user", "settings", "PATCH", {
        displayName: "No",
        expectedVersion: 0,
        locale: "en",
        timeZone: "UTC"
      })
    ).status,
    403
  );
  const initialPresentation = (await api("user", "presentation").then((r) => r.json())).data;
  assert.equal(initialPresentation.displayName, environment.APP_NAME ?? environment.APP_ID);
  assert.equal((await api("user", "application-settings")).status, 403);
  assert.equal(
    (
      await api("super-admin", "application-settings", "PATCH", {
        displayName: "Foundation app",
        locale: "en-GB",
        timeZone: "Europe/London",
        expectedVersion: 0
      })
    ).status,
    200
  );
  assert.deepEqual((await api("user", "presentation").then((r) => r.json())).data, {
    displayName: "Foundation app",
    organizationDisplayName: "Default organization",
    locale: "en-GB",
    timeZone: "Europe/London"
  });
  assert.equal(
    (
      await api("admin", "settings", "PATCH", {
        displayName: "Configured",
        expectedVersion: 0,
        locale: "en",
        timeZone: "Asia/Calcutta"
      })
    ).status,
    200
  );
  assert.equal(
    (
      await api("admin", "settings", "PATCH", {
        displayName: "Invalid",
        expectedVersion: 1,
        locale: "en",
        timeZone: "made-up"
      })
    ).status,
    422
  );
  assert.equal(
    (await api("user", "settings").then((r) => r.json())).data.displayName,
    "Configured"
  );
  assert.deepEqual((await api("user", "presentation").then((r) => r.json())).data, {
    displayName: "Foundation app",
    organizationDisplayName: "Configured",
    locale: "en",
    timeZone: "Asia/Calcutta"
  });
  assert.equal(
    (
      await api("super-admin", "roles/user", "PATCH", {
        expectedVersion: 0,
        permissionIds: ["desk.user", "identity.password", "identity.manage"]
      })
    ).status,
    403
  );
  const audits = await api("admin", "audit-events").then((r) => r.json());
  assert.ok(audits.meta.total >= 4);
  assert.ok(audits.data.every((row: Record<string, unknown>) => row.password === undefined));
  const sessions = await api("user", "sessions").then((r) => r.json());
  const userId = (
    await db
      .selectFrom("identity_users")
      .select("id")
      .where("email", "=", "user@example.test")
      .executeTakeFirstOrThrow()
  ).id;
  assert.ok(sessions.data.every((row: Record<string, unknown>) => row.userId === userId));
  assert.equal(
    (
      await api("admin", "invitations", "POST", {
        name: "Invite",
        email: "invite@example.test"
      })
    ).status,
    503
  );
  assert.equal((await api("user", "recovery", "POST", { email: "user@example.test" })).status, 503);
  const deliveries: { to: string; text: string }[] = [];
  setProvider({
    delivery: {
      async send(input) {
        deliveries.push(input);
        return { messageId: `test-${deliveries.length}` };
      }
    }
  });
  const invitation = await api("admin", "invitations", "POST", {
    name: "Invited",
    email: "invite@example.test"
  });
  assert.equal(invitation.status, 201);
  assert.equal((await invitation.json()).data.status, "pending");
  const invitationToken = deliveries[0].text.match(/#token=([A-Za-z0-9_-]{43})/)![1];
  const invitationClaims = await Promise.all(
    [0, 1].map(() =>
      api("user", "invitations/accept", "POST", { token: invitationToken, password })
    )
  );
  assert.deepEqual(invitationClaims.map((response) => response.status).sort(), [200, 422]);
  assert.equal(
    (
      await api("user", "invitations/accept", "POST", {
        token: invitationToken,
        password
      })
    ).status,
    422
  );
  assert.equal((await login("user", "invite@example.test")).status, 201);
  const invitationRows = await api("admin", "invitations").then((r) => r.json());
  assert.ok(
    invitationRows.data.every((row: Record<string, unknown>) => !row.token_hash && !row.token)
  );
  assert.equal(
    (await api("user", "recovery", "POST", { email: "invite@example.test" })).status,
    202
  );
  const recoveryToken = deliveries[1].text.match(/#token=([A-Za-z0-9_-]{43})/)![1];
  assert.equal(
    (
      await api("admin", "recovery/complete", "POST", {
        token: recoveryToken,
        password
      })
    ).status,
    422
  );
  const recoveryClaims = await Promise.all(
    [0, 1].map(() =>
      api("user", "recovery/complete", "POST", {
        token: recoveryToken,
        password: "Recovered strong password!"
      })
    )
  );
  assert.deepEqual(recoveryClaims.map((response) => response.status).sort(), [200, 422]);
  assert.equal(
    (await login("user", "invite@example.test", "Recovered strong password!")).status,
    201
  );
  assert.equal(
    (
      await api("user", "recovery/complete", "POST", {
        token: recoveryToken,
        password
      })
    ).status,
    422
  );
  for (const restriction of ["disabled", "permission-removed", "expired"] as const) {
    const roleResponse = await api("admin", "roles", "POST", {
      name: `Recovery ${restriction}`,
      permissionIds: ["desk.user", "identity.password"]
    });
    assert.equal(roleResponse.status, 201);
    const role = (await roleResponse.json()).data;
    const email = `recovery-${restriction}@example.test`;
    assert.equal(
      (
        await api("admin", "users", "POST", {
          name: "Recovery policy test",
          email,
          password,
          roleId: role.id
        })
      ).status,
      201
    );
    const deliveryCount = deliveries.length;
    assert.equal((await api("user", "recovery", "POST", { email })).status, 202);
    const token = deliveries[deliveryCount].text.match(/#token=([A-Za-z0-9_-]{43})/)![1];
    const account = await db
      .selectFrom("identity_users")
      .selectAll()
      .where("email", "=", email)
      .executeTakeFirstOrThrow();
    if (restriction === "expired") {
      await db
        .updateTable("identity_tokens")
        .set({ expires_at: new Date(Date.now() - 1000).toISOString() })
        .where("email", "=", email)
        .execute();
    } else {
      assert.equal(
        (
          await api("admin", `roles/${role.id}`, "PATCH", {
            expectedVersion: role.version,
            ...(restriction === "disabled" ? { active: false } : { permissionIds: ["desk.user"] })
          })
        ).status,
        200
      );
    }
    assert.equal(
      (
        await api("user", "recovery/complete", "POST", {
          token,
          password: "Denied recovery replacement!"
        })
      ).status,
      422
    );
    assert.equal(
      (
        await db
          .selectFrom("identity_users")
          .select("password_hash")
          .where("id", "=", account.id)
          .executeTakeFirstOrThrow()
      ).password_hash,
      account.password_hash
    );
    assert.equal(
      (
        await db
          .selectFrom("identity_tokens")
          .select("consumed_at")
          .where("email", "=", email)
          .executeTakeFirstOrThrow()
      ).consumed_at,
      null
    );
    if (restriction !== "expired") {
      const countBeforeDeniedIssue = deliveries.length;
      assert.equal((await api("user", "recovery", "POST", { email })).status, 202);
      assert.equal(deliveries.length, countBeforeDeniedIssue);
    }
  }
  setProvider({
    delivery: {
      async send() {
        throw new Error("Delivery unavailable");
      }
    }
  });
  assert.equal(
    (
      await api("admin", "invitations", "POST", {
        name: "Failed",
        email: "failed@example.test"
      })
    ).status,
    503
  );
  assert.equal(
    (
      await db
        .selectFrom("identity_tokens")
        .selectAll()
        .where("email", "=", "failed@example.test")
        .execute()
    ).length,
    0
  );
  setProvider({});
}
