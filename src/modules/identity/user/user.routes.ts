export const userResource = "users" as const;
export const userResourceRoute = (
  controller: import("./user.controller.js").IdentityUserController
) => ({ resource: userResource, controller });
export const userLifecyclePaths = {
  recovery: "recovery",
  recoveryComplete: "recovery/complete",
  invitationAccept: "invitations/accept",
  invitations: "invitations",
  profile: "profile"
} as const;
