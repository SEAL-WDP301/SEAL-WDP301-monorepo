import { IsEmail, IsString, IsNotEmpty } from "class-validator";

export class SignInDto {
  /**
   * Registered email address
   * @example 'admin@gmail.com'
   */
  @IsEmail({}, { message: "Please provide a valid email address" })
  email: string;

  /**
   * Account password
   * @example '12345678'
   */
  @IsString()
  @IsNotEmpty({ message: "Password is required" })
  password: string;
}
