import { registerAs } from "@nestjs/config";

/**
 * JWT configuration namespace: 'jwt'
 * Access token (short-lived) + Refresh token (long-lived, stored in HttpOnly cookie).
 */
export default registerAs("jwt", () => ({
  /** Secret key for signing access tokens */
  accessSecret: process.env.JWT_ACCESS_SECRET || "access_secret_change_me",

  /** Access token time-to-live (short: 15m) */
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",

  /** Secret key for signing refresh tokens */
  refreshSecret: process.env.JWT_REFRESH_SECRET || "refresh_secret_change_me",

  /** Refresh token time-to-live (long: 7d) */
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
}));
