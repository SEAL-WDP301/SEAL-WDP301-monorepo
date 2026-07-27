import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";
import { Role } from "@prisma/client";

export class OrganizerUpdateUserDto {
  @ApiPropertyOptional({ description: "Full Name" })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: Role, description: "User Role" })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({ description: "Active status" })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
