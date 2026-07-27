/**
 * User role enumeration.
 * Used in JWT payload, UserEntity, and RolesGuard.
 *
 * Lifecycle: Guard reads this enum to authorize protected routes.
 */
export enum Role {
  STUDENT = "student",
  ADMIN = "admin",
  ORGANIZER = "organizer",
  STAKEHOLDER = "stakeholder",
}
