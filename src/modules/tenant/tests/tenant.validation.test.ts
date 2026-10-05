import assert from "node:assert/strict";
import { test } from "node:test";
import { tenantMappingSchema } from "../tenant.schema.js";
const valid = {
  tenantId: "tenant-1",
  driver: "mariadb",
  databaseName: "tenant_db",
  sqlitePath: null,
  active: 1,
  version: 1
};
for (const patch of [
  { tenantId: "" },
  { driver: "postgres" },
  { databaseName: "db; DROP TABLE users" },
  { databaseName: null },
  { active: 2 },
  { active: -1 },
  { version: 0 },
  { version: 1.5 },
  { unexpected: "secret" },
  { driver: "sqlite", sqlitePath: null },
  { driver: "sqlite", sqlitePath: " " }
]) {
  test(`tenant mapping validation rejects ${JSON.stringify(patch)}`, () => {
    assert.equal(tenantMappingSchema.safeParse({ ...valid, ...patch }).success, false);
  });
}
test("valid MariaDB and SQLite mappings retain explicit values", () => {
  assert.equal(tenantMappingSchema.safeParse(valid).success, true);
  assert.equal(
    tenantMappingSchema.safeParse({
      ...valid,
      driver: "sqlite",
      databaseName: null,
      sqlitePath: "storage/private/data/tenant.sqlite"
    }).success,
    true
  );
});
