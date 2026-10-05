import { sessionRoutes, portalRoutes } from "../session/index.js";
import { userRoutes } from "../user/index.js";
export const identityRoutes = [...sessionRoutes, ...userRoutes] as const;
export { portalRoutes };
