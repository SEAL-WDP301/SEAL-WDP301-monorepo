import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, VerifyCallback } from "passport-google-oauth20";
import { ConfigService } from "@nestjs/config";

/**
 * GoogleStrategy — handles Google OAuth2 authentication flow.
 *
 * NestJS Lifecycle position: Strategy runs inside GoogleOAuthGuard (Guard layer).
 * Flow: Middleware → [GoogleOAuthGuard → GoogleStrategy.validate()] → Controller callback
 *
 * Flow:
 * 1. GET /auth/google → redirects user to Google consent screen
 * 2. Google redirects to /auth/google/callback with authorization code
 * 3. passport-google-oauth20 exchanges code for profile
 * 4. validate() receives profile → attaches to req.user
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID:
        configService.get<string>("GOOGLE_CLIENT_ID") || "not-configured",
      clientSecret:
        configService.get<string>("GOOGLE_CLIENT_SECRET") || "not-configured",
      callbackURL:
        configService.get<string>("GOOGLE_CALLBACK_URL") ||
        "http://localhost:3000/api/auth/google/callback",
      scope: ["email", "profile"],
    });
  }

  /**
   * Called after Google validates the OAuth code.
   * Returns the normalized user profile that will be attached to req.user.
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<void> {
    const { id, name, emails, photos } = profile;

    const googleUser = {
      googleId: id,
      email: emails[0].value,
      fullName: [name?.givenName, name?.familyName].filter(Boolean).join(" "),
      picture: photos?.[0]?.value,
    };

    done(null, googleUser);
  }
}
