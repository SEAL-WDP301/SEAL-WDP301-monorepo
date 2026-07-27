import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsUrl, IsInt } from "class-validator";
import { Type } from "class-transformer";

export class SubmitProjectDto {
  @ApiProperty({ description: "ID của vòng thi", example: 1 })
  @Type(() => Number)
  @IsInt()
  roundId: number;

  @ApiProperty({ description: "ID của event", example: 1 })
  @Type(() => Number)
  @IsInt()
  eventId: number;

  @ApiProperty({ description: "Link Github", required: false })
  @IsOptional()
  @IsUrl({}, { message: "Link Github không hợp lệ" })
  githubUrl?: string;

  @ApiProperty({ description: "Mô tả ngắn về dự án", required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
