import * as bcrypt from "bcrypt";
import { APP_CONSTANTS } from "../constants/app.constant";

/**
 * Password hashing utilities using bcrypt.
 * Centralized here to avoid duplicating salt rounds config.
 */

/**
 * Hash a plain-text password using bcrypt.
 * @param password - Plain-text password
 * @returns Bcrypt hash string
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, APP_CONSTANTS.BCRYPT_SALT_ROUNDS);
}

/**
 * Compare a plain-text password against a bcrypt hash.
 * @param password - Plain-text password to verify
 * @param hash - Stored bcrypt hash
 * @returns true if match, false otherwise
 */
export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
