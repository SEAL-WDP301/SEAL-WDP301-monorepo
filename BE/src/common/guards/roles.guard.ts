import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "../enums/role.enum";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { MESSAGES } from "../constants/messages.constant";

/**
 * RolesGuard — checks if the authenticated user has the required roles.
 *
 * NestJS Lifecycle position: Guard layer (runs after Middleware, before Interceptor).
 * Flow: Middleware → [RolesGuard] → Interceptor → Pipe → Handler
 *
 * Usage: Apply AFTER JwtAuthGuard so req.user is already populated.
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles(Role.ADMIN)
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Read required roles from @Roles() decorator metadata
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no @Roles() is set, allow access (public or protected by JwtAuthGuard only)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // req.user is set by JwtAuthGuard's validate() method
    const { user } = context.switchToHttp().getRequest();

    // Check if user has at least one of the required roles
    const hasRole = requiredRoles.some((role) => user?.role === role);

    if (!hasRole) {
      throw new ForbiddenException(MESSAGES.FORBIDDEN);
    }

    return true;
  }
}
