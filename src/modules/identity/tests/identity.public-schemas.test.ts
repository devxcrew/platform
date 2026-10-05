import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("public browser schemas load without database or Node runtime dependencies", () => {
  const script = `
    import { registerHooks } from 'node:module';
    registerHooks({ resolve(specifier, context, nextResolve) {
      if (context.parentURL?.includes('/src/modules/identity/') &&
          (specifier === 'kysely' || specifier.startsWith('node:')))
        throw new Error('Backend dependency in browser schemas: ' + specifier);
      return nextResolve(specifier, context);
    }});
    const schemas = await import('./src/modules/identity/identity.public-schemas.ts');
    if (!schemas.loginSchema || !schemas.profileSchema || !schemas.settingsSchema)
      throw new Error('Required public schemas are absent.');
  `;
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
    cwd: new URL("../../../../", import.meta.url),
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});
