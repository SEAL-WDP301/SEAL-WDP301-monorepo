import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpsertStakeholderProfileDto {
  @ApiPropertyOptional({ description: "Job Title" })
  @IsString()
  @IsOptional()
  jobTitle?: string;

  @ApiPropertyOptional({ description: "Organization" })
  @IsString()
  @IsOptional()
  organization?: string;

  @ApiPropertyOptional({ description: "Years of Experience" })
  @IsString()
  @IsOptional()
  experience?: string;

  @ApiPropertyOptional({ description: "Achievements" })
  @IsString()
  @IsOptional()
  achievements?: string;

  @ApiPropertyOptional({ description: "Biography" })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiPropertyOptional({ description: "Is profile public?" })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}
