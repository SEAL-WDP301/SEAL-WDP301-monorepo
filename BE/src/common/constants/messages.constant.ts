/**
 * Application-wide message constants.
 * Centralizes all user-facing messages for consistency and i18n readiness.
 */
export const MESSAGES = {
  SIGNUP_SUCCESS: "Account created successfully",
  SIGNIN_SUCCESS: "Login successful",
  LOGOUT_SUCCESS: "Logged out successfully",
  TOKEN_REFRESHED: "Token refreshed successfully",
  UNAUTHORIZED: "Unauthorized access",
  FORBIDDEN: "Access forbidden",
  INVALID_CREDENTIALS: "Invalid email or password",
  // User
  USER_NOT_FOUND: "User not found",
  USER_ALREADY_EXISTS: "User with this email already exists",
  PROFILE_FETCHED: "Profile retrieved successfully",
  PROFILE_UPDATED: "Profile updated successfully",

  // General
  SUCCESS: "Success",
  INTERNAL_SERVER_ERROR: "Internal server error",
  VALIDATION_FAILED: "Validation failed",
  NOT_FOUND: "Resource not found",
} as const;
