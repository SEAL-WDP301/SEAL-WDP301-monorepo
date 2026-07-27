import { IsEmail, IsString, MinLength, MaxLength } from "class-validator";

/**
 * SignUp DTO — validates request body for POST /auth/signup.
 */
export class SignUpDto {
  /**
   * Valid email address
   * @example 'user@example.com'
   */
  @IsEmail({}, { message: "Please provide a valid email address" })
  email: string;

  /**
   * Password (min 8, max 32 characters)
   * @example 'StrongPass@123'
   */
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @MaxLength(32, { message: "Password must not exceed 32 characters" })
  password: string;

  /**
   * Full name (min 2, max 100 characters)
   * @example 'John Doe'
   */
  @IsString()
  @MinLength(2, { message: "Full name must be at least 2 characters" })
  @MaxLength(100, { message: "Full name must not exceed 100 characters" })
  fullName: string;
}
