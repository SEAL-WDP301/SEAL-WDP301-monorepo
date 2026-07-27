import {
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthGuard } from "@nestjs/passport";

/**
 * GoogleOAuthGuard — initiates Google OAuth2 redirect and handles callback.
 *
 * NestJS Lifecycle position: Guard layer.
 * Flow: Middleware → [GoogleOAuthGuard] → GoogleStrategy.validate() → Handler
 *
 * Usage:
 * @UseGuards(GoogleOAuthGuard)
 * @Get('google')
 * googleLogin() {}  // Redirects to Google
 *
 * @UseGuards(GoogleOAuthGuard)
 * @Get('google/callback')
 * googleCallback() {}  // Handles redirect back from Google
 */
@Injectable()
export class GoogleOAuthGuard extends AuthGuard("google") {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (
      this.isMissing("GOOGLE_CLIENT_ID") ||
      this.isMissing("GOOGLE_CLIENT_SECRET") ||
      this.isMissing("GOOGLE_CALLBACK_URL")
    ) {
      throw new ServiceUnavailableException(
        "Google OAuth is not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL.",
      );
    }

    return super.canActivate(context);
  }

  private isMissing(key: string): boolean {
    const value = this.configService.get<string>(key);
    return !value || value.startsWith("your_");
  }
}
