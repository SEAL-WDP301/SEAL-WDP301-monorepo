import { IsInt, IsString, IsArray, IsEmail } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RegisterTeamDto {
  @ApiProperty()
  @IsInt()
  trackId: number;

  @ApiProperty()
  @IsString()
  teamName: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsEmail({}, { each: true })
  memberEmails: string[];
}
