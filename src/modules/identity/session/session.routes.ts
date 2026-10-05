import type { Portal } from "../identity.types.js";

export const sessionResource = "sessions" as const;
export const sessionRoutes = [
  { method: "POST", path: "sessions", action: "login" },
  { method: "GET", path: "sessions/current", action: "session" },
  { method: "DELETE", path: "sessions/current", action: "logout" }
] as const;
export const portalRoutes: Record<Portal, { login: string; desk: string }> = {
  user: { login: "/login", desk: "/desk" },
  admin: { login: "/admin/login", desk: "/admin/desk" },
  "super-admin": { login: "/sa/login", desk: "/sa/desk" }
};
