/**
 * JWT Payload — data encoded inside access tokens.
 * Keep minimal: only IDs and role (no PII like email in access tokens).
 */
export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
}
