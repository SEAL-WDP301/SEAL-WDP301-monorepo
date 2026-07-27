import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { StudentType } from "@prisma/client";

export class UpsertStudentProfileDto {
  @ApiProperty({ enum: StudentType, description: "Type of student" })
  @IsEnum(StudentType)
  @IsNotEmpty()
  studentType: StudentType;

  @ApiProperty({ description: "Student Code (e.g., SE123456)" })
  @IsString()
  @IsNotEmpty()
  studentCode: string;

  @ApiPropertyOptional({ description: "University Name" })
  @IsString()
  @IsOptional()
  universityName?: string;

  @ApiPropertyOptional({ description: "Phone number" })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: "GitHub Username" })
  @IsString()
  @IsOptional()
  githubUsername?: string;
}
