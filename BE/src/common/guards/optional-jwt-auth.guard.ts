import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Attaches req.user when a valid Bearer token is present.
 * Allows the request through when missing/invalid (guest mode).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers?: { authorization?: string };
    }>();
    const auth = req.headers?.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return true;
    }
    try {
      const ok = await super.canActivate(context);
      return Boolean(ok);
    } catch {
      return true;
    }
  }

  handleRequest<TUser>(err: Error | null, user: TUser): TUser | null {
    if (err || !user) return null;
    return user;
  }
}
