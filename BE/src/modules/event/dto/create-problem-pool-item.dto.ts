import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class CreateProblemPoolItemDto {
  @ApiProperty({ example: "Smart Factory" })
  @IsString()
  @MinLength(1)
  label: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  problemFileUrl: string;
}
