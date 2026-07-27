/**
 * Application-wide constants.
 * Avoid magic strings/numbers scattered across codebase.
 */
export const APP_CONSTANTS = {
  REDIS_CLIENT: "REDIS_CLIENT",
  REFRESH_TOKEN_COOKIE: "refresh_token",
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
  BCRYPT_SALT_ROUNDS: 12,
} as const;
