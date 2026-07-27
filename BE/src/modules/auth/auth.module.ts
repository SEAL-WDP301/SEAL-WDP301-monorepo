import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./controllers/auth.controller";
import { AuthService } from "./services/auth.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { GoogleStrategy } from "./strategies/google.strategy";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { GoogleOAuthGuard } from "./guards/google-oauth.guard";
import { GithubOAuthGuard } from "./guards/github-oauth.guard";
import { GithubStrategy } from "./strategies/github.strategy";
import { UserModule } from "../user/user.module";
import { RedisModule } from "../../core/redis/redis.module";
import { MailModule } from "../../core/mail/mail.module";
import { WsJwtGuard } from "./guards/ws-jwt.guard";

/**
 * AuthModule — encapsulates authentication concerns.
 *
 * Exports: JwtAuthGuard (used in UserModule and other protected modules)
 *
 * Note: JwtModule is configured without a secret here because each signAsync/verify
 * call in AuthService explicitly passes the secret from ConfigService.
 * This allows using different secrets for access vs refresh tokens.
 */
import { BullModule } from "@nestjs/bullmq";

@Module({
  imports: [
    UserModule,
    RedisModule,
    MailModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.register({}),
    BullModule.registerQueue({
      name: "mail-notification",
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    GithubStrategy,
    JwtAuthGuard,
    GoogleOAuthGuard,
    GithubOAuthGuard,
    WsJwtGuard,
  ],
  exports: [AuthService, JwtAuthGuard, WsJwtGuard, JwtModule],
})
export class AuthModule {}
