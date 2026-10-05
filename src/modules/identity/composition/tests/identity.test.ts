import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "../../user/user.password.js";
import { accountSchema } from "../../user/index.js";
import { loginSchema } from "../../session/index.js";
import { IdentityError } from "../../index.js";
import { organizationCreateSchema } from "../../organization/index.js";
import { resourceIdSchema } from "../../support/identity.schema.js";

test("public IdentityError exposes a safe stable status and copied field contract", () => {
  const fields = { name: ["Enter a name."] };
  const error = new IdentityError(422, "Validation failed", fields);
  assert.ok(error instanceof Error);
  assert.equal(error.name, "IdentityError");
  assert.equal(error.code, "identity_error");
  assert.equal(error.status, 422);
  assert.equal(error.message, "Validation failed");
  fields.name.push("Changed outside error");
  assert.deepEqual(error.fields, { name: ["Enter a name."] });
  assert.ok(Object.isFrozen(error.fields));
  assert.ok(Object.isFrozen(error.fields!.name));
  assert.equal(new IdentityError(403, "Access denied.").fields, undefined);
  assert.throws(() => new IdentityError(200, "Invalid"), /HTTP error status/);
});

test("password hashes are salted and reject incorrect passwords", async () => {
  const password = "Test-only strong password!";
  const first = await hashPassword(password);
  assert.notEqual(first, await hashPassword(password));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("wrong", first), false);
  assert.equal(await verifyPassword(password, "invalid"), false);
});

test("login rejects role injection and malformed fields", () => {
  for (const id of [".", "..", "..."]) {
    assert.equal(resourceIdSchema.safeParse(id).success, false);
    assert.equal(organizationCreateSchema.safeParse({ id, name: "Invalid" }).success, false);
  }
  assert.equal(
    loginSchema.safeParse({
      email: "user@example.test",
      password: "x",
      role: "super-admin"
    }).success,
    false
  );
  assert.equal(loginSchema.safeParse({ email: "bad", password: "x" }).success, false);
  assert.equal(
    accountSchema.safeParse({
      email: "user@example.test",
      name: "User",
      password: "short",
      portal: "user",
      tenantId: "default"
    }).success,
    false
  );
});
