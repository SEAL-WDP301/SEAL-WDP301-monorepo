import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Response } from "express";
import * as crypto from "crypto";
import { UserService } from "../../user/services/user.service";
import { RedisService } from "../../../core/redis/redis.service";
import { MailService } from "../../../core/mail/mail.service";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { SignUpDto } from "../dto/signup.dto";
import { SignInDto } from "../dto/signin.dto";
import { VerifyOtpDto } from "../dto/verify-otp.dto";
import { ForgotPasswordDto } from "../dto/forgot-password.dto";
import { ResetPasswordDto } from "../dto/reset-password.dto";
import { JwtPayload } from "../interfaces/jwt-payload.interface";
import { hashPassword, comparePassword } from "../../../common/utils/hash.util";
import { MESSAGES } from "../../../common/constants/messages.constant";
import { Provider } from "../../../common/enums/provider.enum";
import { User } from "@prisma/client";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import { APP_CONSTANTS } from "../../../common/constants/app.constant";

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly mailService: MailService,
    @InjectQueue("mail-notification") private readonly mailQueue: Queue,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: Logger,
  ) {}

  /**
   * Helper method to enforce 60s Cooldown & 24h Daily Limit for OTP / Reset Password emails
   */
  private async checkAndApplyOtpRateLimit(email: string) {
    const dailyLock = await this.redisService.get(`auth:daily_lock:${email}`);
    if (dailyLock) {
      throw new HttpException(
        "Tài khoản này đã vượt quá số lần nhận OTP trong ngày (tối đa 5 lần). Vui lòng thử lại sau 24 giờ.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const isCooldown = await this.redisService.get(`auth:cooldown:${email}`);
    if (isCooldown) {
      throw new HttpException(
        "Vui lòng chờ 60 giây trước khi yêu cầu mã OTP/link khôi phục mới.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Apply 60s cooldown
    await this.redisService.set(`auth:cooldown:${email}`, "1", 60);

    // Track daily count
    const dailyCountStr = await this.redisService.get(`auth:daily_count:${email}`);
    const currentCount = dailyCountStr ? parseInt(dailyCountStr, 10) : 0;
    const newCount = currentCount + 1;

    if (newCount >= 5) {
      // Lock for 24 hours (86400 seconds)
      await this.redisService.set(`auth:daily_lock:${email}`, "1", 86400);
    } else {
      await this.redisService.set(`auth:daily_count:${email}`, newCount.toString(), 86400);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SIGNUP
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Register a new local user.
   * @throws ConflictException if email already exists
   */
  async signup(dto: SignUpDto) {
    const existingUser = await this.userService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException(MESSAGES.USER_ALREADY_EXISTS);
    }

    const hashedPass = await hashPassword(dto.password);

    const user = await this.userService.createUser({
      email: dto.email,
      password: hashedPass,
      fullName: dto.fullName,
      provider: Provider.LOCAL,
      isActive: false,
    });

    this.logger.log(
      `New user registered: ${user.email}, awaiting OTP (UserId: ${user.id})`,
      "AuthService",
    );

    // Apply 60s Cooldown & 24h Daily Limit
    await this.checkAndApplyOtpRateLimit(user.email);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    this.logger.log(`[DEV] MOCK OTP for ${user.email}: ${otp}`, "AuthService");

    // Store in Redis with 5 minutes expiration (300 seconds)
    await this.redisService.set(`auth:otp:${user.email}`, otp, 300);

    // Push High Priority BullMQ Job
    await this.mailQueue.add(
      "send-otp",
      { to: user.email, otp },
      { priority: 1, attempts: 3, backoff: { type: "exponential", delay: 1000 } }
    ).catch(err => this.logger.warn(`Failed to queue OTP email: ${err.message}`));

    return {
      message:
        "Đăng ký thành công. Vui lòng kiểm tra email để lấy mã OTP xác thực.",
      data: { email: user.email },
    };
  }

  /**
   * Verify OTP and activate user account.
   */
  async verifyOtp(dto: VerifyOtpDto) {
    const storedOtp = await this.redisService.get(`auth:otp:${dto.email}`);

    if (!storedOtp) {
      throw new UnauthorizedException("Mã OTP đã hết hạn hoặc không tồn tại.");
    }

    if (storedOtp !== dto.otp) {
      throw new UnauthorizedException("Mã OTP không chính xác.");
    }

    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException("Không tìm thấy người dùng.");
    }

    // Activate user
    await this.userService.updateIsActive(user.id, true);

    // Remove OTP from Redis
    await this.redisService.del(`auth:otp:${dto.email}`);

    return {
      message: "Xác thực email thành công. Bạn có thể đăng nhập ngay bây giờ.",
      data: null,
    };
  }

  /**
   * Authenticate user with email and password.
   * @throws UnauthorizedException on invalid credentials or inactive account
   */
  async signin(dto: SignInDto) {
    const user = await this.userService.findByEmailWithPassword(dto.email);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException(MESSAGES.INVALID_CREDENTIALS);
    }

    const isPasswordValid = await comparePassword(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException(MESSAGES.INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        "Tài khoản chưa được kích hoạt. Vui lòng xác thực email.",
      );
    }

    const tokens = await this.generateTokens(user);
    this.logger.log(
      `Access token for ${user.email}: ${tokens.accessToken}`,
      "AuthService",
    );
    await this.userService.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      message: MESSAGES.SIGNIN_SUCCESS,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: this.sanitizeUser(user),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PASSWORD RESET
  // ─────────────────────────────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      // Return a generic success message to prevent email enumeration attacks
      return {
        message:
          "Nếu email hợp lệ, link khôi phục mật khẩu sẽ được gửi đến email của bạn.",
        data: null,
      };
    }

    // Apply 60s Cooldown & 24h Daily Limit
    await this.checkAndApplyOtpRateLimit(user.email);

    // Generate random 32-byte hex token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Store in Redis with 5 minutes (300 seconds) expiry
    await this.redisService.set(`auth:reset-pw:${resetToken}`, user.email, 300);

    // Get frontend URL to build the reset link
    const frontendUrl = this.configService.get<string>("app.frontendUrl");
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Push High Priority BullMQ Job
    await this.mailQueue.add(
      "send-reset-password",
      { to: user.email, resetLink },
      { priority: 1, attempts: 3, backoff: { type: "exponential", delay: 1000 } }
    ).catch(err => this.logger.warn(`Failed to queue reset password email: ${err.message}`));

    return {
      message:
        "Nếu email hợp lệ, link khôi phục mật khẩu sẽ được gửi đến email của bạn.",
      data: null,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    // Get email from Redis using the token
    const email = await this.redisService.get(`auth:reset-pw:${dto.token}`);

    if (!email) {
      throw new UnauthorizedException("Token không hợp lệ hoặc đã hết hạn.");
    }

    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException("Tài khoản không tồn tại.");
    }

    // Hash the new password and update user
    const hashedPass = await hashPassword(dto.newPassword);
    await this.userService.updatePassword(user.id, hashedPass);

    // Delete token from Redis to prevent reuse
    await this.redisService.del(`auth:reset-pw:${dto.token}`);

    return {
      message:
        "Khôi phục mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.",
      data: null,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REFRESH TOKEN
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Exchange a valid refresh token (from HttpOnly cookie) for new tokens.
   * @throws UnauthorizedException if cookie missing or token invalid
   */
  async refreshTokens(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException(MESSAGES.UNAUTHORIZED);
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>("jwt.refreshSecret"),
      });
    } catch {
      throw new UnauthorizedException("Refresh token is invalid or expired");
    }

    const user = await this.userService.findByIdWithRefreshToken(payload.sub);
    if (!user || !user.hashedRefreshToken) {
      throw new UnauthorizedException(MESSAGES.UNAUTHORIZED);
    }

    // Verify hashed refresh token matches stored hash
    const isRefreshTokenValid = await comparePassword(
      refreshToken,
      user.hashedRefreshToken,
    );
    if (!isRefreshTokenValid) {
      throw new UnauthorizedException("Refresh token mismatch");
    }

    const tokens = await this.generateTokens(user);
    await this.userService.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      message: MESSAGES.TOKEN_REFRESHED,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  }

  async logout(userId: number) {
    await this.userService.updateRefreshToken(userId, null);

    return { message: MESSAGES.LOGOUT_SUCCESS, data: null };
  }

  async googleLogin(googleUser: any, res: Response) {
    let user = await this.userService.findByEmail(googleUser.email);

    if (!user) {
      // Auto-create account for new Google users
      user = await this.userService.createUser({
        email: googleUser.email,
        fullName: googleUser.fullName,
        googleId: googleUser.googleId,
        provider: Provider.GOOGLE,
        password: null,
        avatarUrl: googleUser.picture,
      });

      this.logger.log(
        `New Google user created: ${user.email} (UserId: ${user.id})`,
        "AuthService",
      );
    } else if (!user.googleId || !user.isActive) {
      // User exists but might have registered locally first.
      // Update with Google ID, avatar, and activate them.
      user = await this.userService.updateGoogleAuthInfo(user.id, {
        googleId: googleUser.googleId,
        avatarUrl: user.avatarUrl || googleUser.picture, // keep existing avatar if present
        isActive: true,
      });

      this.logger.log(
        `Google account linked for user: ${user.email} (UserId: ${user.id})`,
        "AuthService",
      );
    }

    const tokens = await this.generateTokens(user);
    // log access token
    this.logger.log(`Access token: ${tokens.accessToken}`, "AuthService");
    await this.userService.updateRefreshToken(user.id, tokens.refreshToken);

    // Redirect to frontend with both tokens in query param
    const frontendUrl = this.configService.get<string>("app.frontendUrl");
    return res.redirect(
      `${frontendUrl}/auth/callback?token=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`,
    );
  }

  async githubLogin(githubUser: any, res: Response) {
    let user = await this.userService.findByGithubId(githubUser.githubId);

    if (!user) {
      user = await this.userService.findByEmail(githubUser.email);

      if (user?.githubId && user.githubId !== githubUser.githubId) {
        throw new ConflictException(
          "This email is already linked to another GitHub account",
        );
      }
    }

    if (!user) {
      user = await this.userService.createUser({
        email: githubUser.email,
        fullName: githubUser.fullName,
        githubId: githubUser.githubId,
        provider: Provider.GITHUB,
        password: null,
        avatarUrl: githubUser.picture,
      });

      this.logger.log(
        `New GitHub user created: ${user.email} (UserId: ${user.id})`,
        "AuthService",
      );
    } else if (!user.githubId || !user.isActive) {
      user = await this.userService.updateGithubAuthInfo(user.id, {
        githubId: githubUser.githubId,
        avatarUrl: user.avatarUrl || githubUser.picture,
        isActive: true,
      });

      this.logger.log(
        `GitHub account linked for user: ${user.email} (UserId: ${user.id})`,
        "AuthService",
      );
    }

    const tokens = await this.generateTokens(user);
    await this.userService.updateRefreshToken(user.id, tokens.refreshToken);

    const frontendUrl = this.configService.get<string>("app.frontendUrl");
    return res.redirect(
      `${frontendUrl}/auth/callback?token=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`,
    );
  }

  /**
   * Generate both access token and refresh token for a user.
   */
  private async generateTokens(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>("jwt.accessSecret"),
        expiresIn: this.configService.get<string>("jwt.accessExpiresIn"),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>("jwt.refreshSecret"),
        expiresIn: this.configService.get<string>("jwt.refreshExpiresIn"),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: User) {
    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      hashedRefreshToken: _hrt,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      passwordHash: _pw,
      ...safeUser
    } = user as any;
    return safeUser;
  }
}
