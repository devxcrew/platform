import type { Kysely, Transaction } from "kysely";
import { IdentityError } from "../support/identity.error.js";
import type { IdentitySchema, Portal } from "../identity.types.js";
import { IdentityPermissionRepository } from "./permission.repository.js";
import { permissionDeclarationSchema } from "./permission.schema.js";
import type { Principal } from "../identity.types.js";
import type { IdentityListQuery } from "../support/pagination.schema.js";

export class IdentityPermissionService {
  constructor(private readonly repository: IdentityPermissionRepository) {}

  verify() {
    return this.repository.verifySchema();
  }

  list(actor: Principal, query: IdentityListQuery) {
    if (actor.portal === "user") throw new IdentityError(403, "Access denied.");
    return this.repository.list(actor, query);
  }

  show(actor: Principal, id: string) {
    if (actor.portal === "user") throw new IdentityError(403, "Access denied.");
    return this.repository.show(actor, id);
  }

  async register(appId: string, raw: unknown) {
    const declaration = permissionDeclarationSchema.parse(raw);
    const ids = new Set<string>();
    for (const permission of declaration.permissions) {
      if (!permission.id.startsWith(`${appId}.${declaration.owner}.`) || ids.has(permission.id))
        throw new IdentityError(422, "Use unique permission IDs in this app and owner namespace.");
      ids.add(permission.id);
    }
    return this.repository.transaction(async (trx) => {
      for (const permission of declaration.permissions) {
        const portals = JSON.stringify([...new Set(permission.portals)].sort());
        const previous = await this.repository.declaration(trx, permission.id);
        if (previous) {
          if (
            previous.app_id !== appId ||
            previous.owner !== declaration.owner ||
            previous.portals !== portals
          )
            throw new IdentityError(
              409,
              "Permission declaration conflicts with its registered owner or portal policy."
            );
          if (permission.label !== undefined && permission.label !== previous.label)
            await this.repository.updateLabel(trx, permission.id, permission.label);
          continue;
        }
        if (await this.repository.permission(trx, permission.id))
          throw new IdentityError(409, "Permission already exists without this owner declaration.");
        await this.repository.create(trx, {
          id: permission.id,
          appId,
          owner: declaration.owner,
          portals,
          label: permission.label ?? null
        });
      }
      return { owner: declaration.owner, permissionIds: [...ids] };
    });
  }

  async validateDeclared(
    db: Kysely<IdentitySchema> | Transaction<IdentitySchema>,
    appId: string,
    portal: Portal,
    ids: string[]
  ) {
    const declarations = await this.repository.declarations(db);
    for (const id of ids) {
      const declaration = declarations.find((row) => row.permission_id === id);
      if (
        declaration &&
        (declaration.app_id !== appId || !JSON.parse(declaration.portals).includes(portal))
      )
        throw new IdentityError(403, "Permission is unavailable in this app or portal.");
    }
  }

  async validateKnown(db: Transaction<IdentitySchema>, ids: string[]) {
    const known = await this.repository.knownIds(db);
    if (ids.some((id) => !known.has(id))) throw new IdentityError(422, "Unknown permission.");
  }

  async filterDeclared(db: Kysely<IdentitySchema>, appId: string, portal: Portal, ids: string[]) {
    const declarations = await this.repository.declarations(db);
    return ids.filter((id) => {
      const declaration = declarations.find((row) => row.permission_id === id);
      return (
        !declaration ||
        (declaration.app_id === appId && JSON.parse(declaration.portals).includes(portal))
      );
    });
  }
}
