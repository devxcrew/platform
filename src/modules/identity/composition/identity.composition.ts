import type { Kysely } from "kysely";
import { IdentityError } from "../support/identity.error.js";
import type { IdentitySchema, Principal } from "../identity.types.js";
import type { IdentityListQuery, IdentityResource } from "../support/pagination.schema.js";
import { createIdentityAuditProvider, auditResourceRoute } from "../audit/index.js";
import { createIdentitySessionProvider, sessionResourceRoute } from "../session/index.js";
import {
  createIdentityOrganizationProvider,
  organizationResourceRoute
} from "../organization/index.js";
import { createIdentitySettingsProvider } from "../settings/index.js";
import { createIdentityRoleProvider, roleResourceRoute } from "../role/index.js";
import { createIdentityUserRoleProvider, userRoleResourceRoute } from "../user-role/index.js";
import {
  activeUserIds,
  createIdentityUserAdministrationProvider,
  userNameSource,
  userResourceRoute
} from "../user/index.js";
import { permissionResourceRoute, type IdentityPermissionProvider } from "../permission/index.js";
import { IdentityUserController } from "../user/index.js";
import { IdentityOrganizationController } from "../organization/index.js";
import { IdentityUserRoleController } from "../user-role/index.js";
import { IdentityRoleController } from "../role/index.js";
import { IdentityPermissionController } from "../permission/index.js";
import { IdentitySessionController } from "../session/index.js";
import { IdentityAuditController } from "../audit/index.js";
import { IdentitySettingsController } from "../settings/index.js";
import type { IdentityResourceRoute } from "../support/resource-controller.js";
import type { IdentityUserOwnership } from "../user/index.js";

export class IdentityAdministrationComposition {
  private readonly audit;
  private readonly session;
  private readonly organization;
  private readonly settingsProvider;
  private readonly roles;
  private readonly userRoles;
  private readonly users;
  private readonly permissions;
  readonly userController: IdentityUserController;
  readonly settingsController: IdentitySettingsController;
  readonly routes: readonly IdentityResourceRoute[];

  userOwnership(): IdentityUserOwnership {
    return {
      activeOrganization: this.organization.active,
      assignInvitedMembership: this.userRoles.assignInvitedMembership,
      revokeUserSessions: this.session.revokeUser,
      recordEvent: this.audit.recordEvent,
      sessionSeconds: this.settingsProvider.sessionSeconds,
      activeSession: this.session.active,
      createSession: this.session.create,
      revokeSession: this.session.revoke,
      throttle: this.session.throttle,
      clearThrottle: this.session.clearThrottle,
      activeMembership: this.userRoles.activeMembership,
      activeOrganizationDetail: this.organization.activeDetail,
      permissionIds: this.roles.permissionIds
    };
  }

  constructor(
    database: Kysely<IdentitySchema>,
    appName: string,
    permissions: IdentityPermissionProvider
  ) {
    this.permissions = permissions;
    this.audit = createIdentityAuditProvider(
      database,
      (trx, userId) => this.userRoles.tenantIdsForUser(trx, userId),
      (trx) => this.organization.tenantIds(trx)
    );
    this.session = createIdentitySessionProvider(database, this.audit.mutate);
    this.organization = createIdentityOrganizationProvider(
      database,
      this.audit.mutate,
      this.session.revokeTenant
    );
    this.settingsProvider = createIdentitySettingsProvider(
      database,
      appName,
      this.audit.mutate,
      this.session.revokeApp
    );
    this.roles = createIdentityRoleProvider(
      database,
      permissions,
      this.audit.mutate,
      this.audit.record,
      this.organization.active,
      async (trx, appId, tenantId, roleId) => {
        const userIds = await this.userRoles.userIdsForCustomRole(trx, roleId);
        await this.session.revokeRoleMembers(trx, appId, tenantId, userIds);
      }
    );
    this.userRoles = createIdentityUserRoleProvider(
      database,
      {
        users: userNameSource,
        organizations: this.organization.nameSource,
        roles: this.roles.customRoleNameSource,
        customRoleIds: this.roles.customRoleIdsSource
      },
      activeUserIds,
      this.roles.resolve,
      this.roles.customRoleInApp,
      this.audit.mutate,
      async (actor, userId) => {
        if (!(await this.users.show(actor, userId)))
          throw new IdentityError(404, "Resource not found.");
      },
      this.organization.active,
      this.audit.record,
      this.session.revokeMembership
    );
    this.users = createIdentityUserAdministrationProvider(
      database,
      (actor, userId) =>
        this.userRoles.userVisibility(actor, this.roles.customRoleIdsSource, userId),
      this.roles.resolve,
      this.userRoles,
      this.audit.mutate,
      this.organization.active,
      this.session.revokeUser
    );
    this.userController = new IdentityUserController(this.users);
    this.settingsController = new IdentitySettingsController(this.settingsProvider);
    this.routes = [
      userResourceRoute(this.userController),
      organizationResourceRoute(new IdentityOrganizationController(this.organization)),
      userRoleResourceRoute(new IdentityUserRoleController(this.userRoles)),
      roleResourceRoute(new IdentityRoleController(this.roles)),
      permissionResourceRoute(new IdentityPermissionController(this.permissions)),
      sessionResourceRoute(new IdentitySessionController(this.session)),
      auditResourceRoute(new IdentityAuditController(this.audit))
    ];
  }

  async list(actor: Principal, resource: IdentityResource, query: IdentityListQuery) {
    if (resource === "users") return this.users.list(actor, query);
    if (resource === "organizations") return this.organization.list(actor, query);
    if (resource === "memberships") return this.userRoles.list(actor, query);
    if (resource === "roles") return this.roles.list(actor, query);
    if (resource === "permissions") return this.permissions.list(actor, query);
    if (resource === "sessions") return this.session.list(actor, query);
    return this.audit.list(actor, query);
  }

  async show(actor: Principal, resource: IdentityResource, id: string) {
    const row =
      resource === "users"
        ? await this.users.show(actor, id)
        : resource === "organizations"
          ? await this.organization.show(actor, id)
          : resource === "memberships"
            ? await this.userRoles.show(actor, id)
            : resource === "roles"
              ? await this.roles.show(actor, id)
              : resource === "permissions"
                ? await this.permissions.show(actor, id)
                : resource === "sessions"
                  ? await this.session.show(actor, id)
                  : await this.audit.show(actor, id);
    if (!row) throw new IdentityError(404, "Resource not found.");
    return row;
  }

  async create(actor: Principal, resource: IdentityResource, raw: unknown) {
    if (resource === "roles") return this.roles.create(actor, raw);
    if (resource === "users") return this.users.create(actor, raw);
    if (resource === "organizations") return this.organization.create(actor, raw);
    if (resource === "memberships") return this.userRoles.createMembership(actor, raw);
    throw new IdentityError(405, "Creation is not supported for this resource.");
  }

  async update(actor: Principal, resource: IdentityResource, id: string, raw: unknown) {
    if (resource === "memberships") return this.userRoles.updateMembership(actor, id, raw);
    if (resource === "roles" && !["user", "admin", "super-admin"].includes(id))
      return this.roles.update(actor, id, raw);
    if (resource === "roles") {
      await this.show(actor, resource, id);
      return this.roles.updateSystemPermissions(actor, id, raw);
    }
    if (resource === "users") return this.users.update(actor, id, raw);
    if (resource === "organizations") return this.organization.update(actor, id, raw);
    throw new IdentityError(405, "Update is not supported for this resource.");
  }

  async remove(actor: Principal, resource: IdentityResource, id: string, expectedVersion?: number) {
    if (resource === "memberships")
      return this.userRoles.removeMembership(actor, id, expectedVersion);
    if (resource === "sessions") {
      await this.session.remove(actor, id);
      return;
    }
    await this.show(actor, resource, id);
    throw new IdentityError(405, "Deletion is not supported for this resource.");
  }

  profile(actor: Principal, raw?: unknown) {
    return this.users.profile(actor, raw);
  }
  settings(actor: Principal, raw?: unknown) {
    return this.settingsProvider.organizationSettings(actor, raw);
  }
  applicationSettings(actor: Principal, security: boolean, raw: unknown, fallbackSeconds: number) {
    return this.settingsProvider.applicationSettings(actor, security, raw, fallbackSeconds);
  }
  presentation(actor: Principal) {
    return this.settingsProvider.presentation(actor);
  }
  configuration(appId: string, requiresOrganizationId: boolean) {
    return this.settingsProvider.configuration(appId, requiresOrganizationId);
  }

  async verify() {
    await this.audit.verify();
    await this.session.verify();
    await this.organization.verify();
    await this.settingsProvider.verify();
    await this.roles.verify();
    await this.userRoles.verify();
  }
}
