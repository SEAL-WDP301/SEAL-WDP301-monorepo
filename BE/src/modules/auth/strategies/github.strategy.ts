import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Profile, Strategy } from "passport-github2";
import { VerifyCallback } from "passport-oauth2";

interface GithubEmail {
  value: string;
  primary?: boolean;
  verified?: boolean;
}

/**
 * Handles GitHub OAuth2 and normalizes the GitHub profile for AuthService.
 */
@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, "github") {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID:
        configService.get<string>("GITHUB_CLIENT_ID") || "not-configured",
      clientSecret:
        configService.get<string>("GITHUB_CLIENT_SECRET") || "not-configured",
      callbackURL:
        configService.get<string>("GITHUB_CALLBACK_URL") ||
        "http://localhost:3000/api/auth/github/callback",
      scope: ["user:email"],
      allRawEmails: true,
      userAgent: "seal-wdp301-backend",
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const emails = (profile.emails ?? []) as GithubEmail[];
    const email =
      emails.find((item) => item.primary && item.verified)?.value ??
      emails.find((item) => item.verified)?.value;

    if (!email) {
      return done(
        new UnauthorizedException(
          "GitHub account must have a verified email address",
        ),
      );
    }

    const githubProfile = profile as Profile & {
      username?: string;
      _json?: { avatar_url?: string };
    };

    done(null, {
      githubId: profile.id,
      email,
      fullName: profile.displayName || githubProfile.username || email,
      picture: githubProfile._json?.avatar_url,
    });
  }
}
