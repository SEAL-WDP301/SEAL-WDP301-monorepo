import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * JwtAuthGuard — protects routes by validating the JWT Bearer token.
 *
 * NestJS Lifecycle position: Guard layer.
 * Flow: Middleware → [JwtAuthGuard] → Interceptor → Pipe → Handler
 *
 * How to use:
 * @UseGuards(JwtAuthGuard)
 * @Get('protected-route')
 * handler() {}
 *
 * Internally calls JwtStrategy.validate(), which:
 * 1. Extracts and verifies Bearer token
 * 2. Attaches user to req.user
 * 3. Throws 401 if token is missing/invalid/expired
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
