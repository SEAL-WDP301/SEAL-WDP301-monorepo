import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { UserService } from "../../user/services/user.service";
import { JwtPayload } from "../interfaces/jwt-payload.interface";
import { MESSAGES } from "../../../common/constants/messages.constant";

/**
 * JwtStrategy — validates Bearer tokens on protected routes.
 *
 * NestJS Lifecycle position: Strategy runs inside Guard layer.
 * Flow: Middleware → [JwtAuthGuard → JwtStrategy.validate()] → Interceptor → Pipe → Handler
 *
 * What it does:
 * 1. Extracts the Bearer token from Authorization header
 * 2. Verifies signature and expiry against JWT_ACCESS_SECRET
 * 3. Calls validate() with decoded payload → attaches result to req.user
 *
 * If token is invalid/expired: throws 401 Unauthorized automatically.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {
    super({
      // Extract token from "Authorization: Bearer <token>" header
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // Reject expired tokens (passport-jwt default: false)
      ignoreExpiration: false,

      // Secret for verifying token signature
      secretOrKey: configService.get<string>("jwt.accessSecret"),
    });
  }

  /**
   * Called after token signature is verified.
   * Return value is attached to req.user.
   *
   * @param payload - Decoded JWT payload
   * @throws UnauthorizedException if user no longer exists
   */
  async validate(payload: JwtPayload) {
    const user = await this.userService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException(MESSAGES.UNAUTHORIZED);
    }

    // req.user = { id, email, role, ... }
    return user;
  }
}
