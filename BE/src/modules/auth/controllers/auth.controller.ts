import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from "@nestjs/swagger";
import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { SignUpDto } from "../dto/signup.dto";
import { SignInDto } from "../dto/signin.dto";
import { VerifyOtpDto } from "../dto/verify-otp.dto";
import { ForgotPasswordDto } from "../dto/forgot-password.dto";
import { ResetPasswordDto } from "../dto/reset-password.dto";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { GoogleOAuthGuard } from "../guards/google-oauth.guard";
import { GithubOAuthGuard } from "../guards/github-oauth.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { APP_CONSTANTS } from "../../../common/constants/app.constant";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user account
   */
  @Post("signup")
  @HttpCode(HttpStatus.CREATED)
  @ApiResponse({ status: 409, description: "Email already exists" })
  @ApiResponse({ status: 422, description: "Validation failed" })
  async signup(@Body() dto: SignUpDto) {
    return this.authService.signup(dto);
  }

  /**
   * Verify OTP and activate user account
   */
  @Post("verify-otp")
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 401, description: "Invalid OTP" })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  /**
   * Login with email and password
   */
  @Post("signin")
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  async signin(@Body() dto: SignInDto) {
    return this.authService.signin(dto);
  }

  /**
   * Forgot Password - Request reset link
   */
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /**
   * Reset Password - Set new password using token
   */
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 401, description: "Invalid or expired token" })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  /**
   * Refresh access token using HttpOnly refresh token cookie
   */
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth("refresh_token")
  @ApiResponse({ status: 401, description: "Invalid or expired refresh token" })
  async refresh(@Body("refreshToken") refreshToken: string) {
    return this.authService.refreshTokens(refreshToken);
  }

  /**
   * Logout and invalidate refresh token
   */
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async logout(@CurrentUser("id") userId: string) {
    return this.authService.logout(Number(userId));
  }

  /**
   * Initiate Google OAuth2 login
   * Redirects browser to Google consent screen. Not for API clients.
   */
  @Get("google")
  @UseGuards(GoogleOAuthGuard)
  googleLogin() {
    // Guard handles the redirect — this handler body is never executed
  }

  /**
   * Google OAuth2 callback — handled by GoogleStrategy
   * Google redirects here after user grants permissions.
   */
  @Get("google/callback")
  @UseGuards(GoogleOAuthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    return this.authService.googleLogin(req.user, res);
  }

  /**
   * Initiate GitHub OAuth2 login.
   */
  @Get("github")
  @UseGuards(GithubOAuthGuard)
  githubLogin() {
    // Guard handles the redirect
  }

  /**
   * GitHub OAuth2 callback.
   */
  @Get("github/callback")
  @UseGuards(GithubOAuthGuard)
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    return this.authService.githubLogin(req.user, res);
  }
}
