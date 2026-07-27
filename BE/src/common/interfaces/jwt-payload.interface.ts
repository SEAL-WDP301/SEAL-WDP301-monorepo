import { Role } from "../enums/role.enum";

/**
 * JWT Payload interface — shape of decoded JWT token.
 * Used by JwtStrategy.validate() to attach to req.user.
 */
export interface JwtPayload {
  /** User's UUID */
  sub: string;

  /** User's email address */
  email: string;

  /** User's role for RBAC */
  role: Role;

  /** Issued at timestamp (Unix) */
  iat?: number;

  /** Expiration timestamp (Unix) */
  exp?: number;
}
