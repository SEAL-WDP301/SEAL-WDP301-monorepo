import { IsInt, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AssignMentorDto {
  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  stakeholderId: number;
}
