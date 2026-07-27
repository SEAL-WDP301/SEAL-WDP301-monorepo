import {
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthGuard } from "@nestjs/passport";

/**
 * Initiates GitHub OAuth and processes the callback.
 */
@Injectable()
export class GithubOAuthGuard extends AuthGuard("github") {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (
      this.isMissing("GITHUB_CLIENT_ID") ||
      this.isMissing("GITHUB_CLIENT_SECRET") ||
      this.isMissing("GITHUB_CALLBACK_URL")
    ) {
      throw new ServiceUnavailableException(
        "GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and GITHUB_CALLBACK_URL.",
      );
    }

    return super.canActivate(context);
  }

  private isMissing(key: string): boolean {
    const value = this.configService.get<string>(key);
    return !value || value.startsWith("your_");
  }
}
