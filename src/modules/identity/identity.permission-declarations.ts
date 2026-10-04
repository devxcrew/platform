import { z } from "zod";
import type { Kysely, Transaction } from "kysely";
import type { IdentitySchema, Portal } from "./identity.types.js";
import { IdentityError } from "./identity.error.js";
import { portalSchema } from "./identity.schema.js";

const declarationSchema = z.object({
  owner: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/).refine((value) => !["identity", "desk"].includes(value)),
  permissions: z.array(z.object({
    id: z.string().regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*){2,8}$/).max(250),
    portals: z.array(portalSchema).min(1).max(3),
    label: z.string().trim().min(1).max(100).regex(/^[^\x00-\x1f\x7f]+$/).optional(),
  }).strict()).min(1).max(100),
}).strict();

export type IdentityPermissionDeclaration = z.input<typeof declarationSchema>;

export async function registerIdentityPermissions(db: Kysely<IdentitySchema>, appId: string, raw: unknown) {
  const declaration = declarationSchema.parse(raw);
  const ids = new Set<string>();
  for (const permission of declaration.permissions) {
    if (!permission.id.startsWith(`${appId}.${declaration.owner}.`) || ids.has(permission.id))
      throw new IdentityError(422, "Use unique permission IDs in this app and owner namespace.");
    ids.add(permission.id);
  }
  return db.transaction().execute(async (trx) => {
    for (const permission of declaration.permissions) {
      const portals = JSON.stringify([...new Set(permission.portals)].sort());
      const previous = await trx.selectFrom("identity_permission_declarations").selectAll()
        .where("permission_id", "=", permission.id).executeTakeFirst();
      if (previous) {
        if (previous.app_id !== appId || previous.owner !== declaration.owner || previous.portals !== portals)
          throw new IdentityError(409, "Permission declaration conflicts with its registered owner or portal policy.");
        if (permission.label !== undefined && permission.label !== previous.label)
          await trx.updateTable("identity_permission_declarations").set({ label: permission.label })
            .where("permission_id", "=", permission.id).execute();
        continue;
      }
      if (await trx.selectFrom("identity_permissions").select("id").where("id", "=", permission.id).executeTakeFirst())
        throw new IdentityError(409, "Permission already exists without this owner declaration.");
      await trx.insertInto("identity_permissions").values({ id: permission.id }).execute();
      await trx.insertInto("identity_permission_declarations").values({
        permission_id: permission.id, app_id: appId, owner: declaration.owner, portals, label: permission.label ?? null,
      }).execute();
    }
    return { owner: declaration.owner, permissionIds: [...ids] };
  });
}

export async function validateDeclaredPermissions(
  db: Kysely<IdentitySchema> | Transaction<IdentitySchema>, appId: string, portal: Portal, ids: string[],
) {
  const declarations = await db.selectFrom("identity_permission_declarations").selectAll().execute();
  for (const id of ids) {
    const declaration = declarations.find((row) => row.permission_id === id);
    if (declaration && (declaration.app_id !== appId || !JSON.parse(declaration.portals).includes(portal)))
      throw new IdentityError(403, "Permission is unavailable in this app or portal.");
  }
}

export async function filterDeclaredPermissions(db: Kysely<IdentitySchema>, appId: string, portal: Portal, ids: string[]) {
  const declarations = await db.selectFrom("identity_permission_declarations").selectAll().execute();
  return ids.filter((id) => {
    const declaration = declarations.find((row) => row.permission_id === id);
    return !declaration || (declaration.app_id === appId && JSON.parse(declaration.portals).includes(portal));
  });
}
