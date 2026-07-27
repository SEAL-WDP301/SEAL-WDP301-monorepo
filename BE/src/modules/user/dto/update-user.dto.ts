import { StudentType } from "@prisma/client";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from "class-validator";

/**
 * UpdateUserDto — partial update payload for user profile.
 * Only allow safe fields to be updated (not email, role, or provider).
 */
export class UpdateUserDto {
  /**
   * Full name of the user
   * @example 'Jane Doe'
   */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  /**
   * Avatar image URL
   * @example 'https://example.com/avatar.png'
   */
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  avatarUrl?: string;

  /**
   * Student type
   * @example 'fpt'
   */
  @IsOptional()
  @IsEnum(StudentType)
  studentType?: StudentType;

  /**
   * Student code
   * @example 'SE123456'
   */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  studentCode?: string;

  /**
   * University name for external students
   * @example 'FPT University'
   */
  @IsOptional()
  @IsString()
  @MaxLength(150)
  universityName?: string;

  /**
   * Contact phone number
   * @example '0901234567'
   */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  /**
   * GitHub Username
   * @example 'john_doe123'
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  githubUsername?: string;
}
