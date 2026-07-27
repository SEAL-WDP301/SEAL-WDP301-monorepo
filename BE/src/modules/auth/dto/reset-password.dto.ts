import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength, MaxLength } from "class-validator";

export class ResetPasswordDto {
  @ApiProperty({ example: "abc123tokenXYZ" })
  @IsString()
  token: string;

  @ApiProperty({ example: "NewStrongPass@123" })
  @IsString()
  @MinLength(8, { message: "Mật khẩu phải chứa ít nhất 8 ký tự." })
  @MaxLength(32, { message: "Mật khẩu không được vượt quá 32 ký tự." })
  newPassword: string;
}
