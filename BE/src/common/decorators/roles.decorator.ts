import { SetMetadata } from "@nestjs/common";
import { Role } from "../enums/role.enum";

/**
 * Roles decorator — attaches required roles metadata to a route handler.
 *
 * NestJS Lifecycle position: This metadata is read by RolesGuard (Guard layer).
 * Flow: Middleware → [Guard reads @Roles metadata] → Interceptor → Pipe → Handler
 *
 * @example
 * @Roles(Role.ADMIN)
 * @Get('admin-only')
 * adminOnlyRoute() {}
 */
export const ROLES_KEY = "roles";
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
