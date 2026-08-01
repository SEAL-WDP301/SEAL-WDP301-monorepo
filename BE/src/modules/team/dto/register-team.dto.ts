import { IsInt, IsString, IsArray, IsEmail } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";

export class RegisterTeamDto {
  @ApiProperty()
  @IsInt()
  trackId: number;

  @ApiProperty()
  @IsString()
  teamName: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((email) =>
          typeof email === "string" ? email.trim().toLowerCase() : email,
        )
      : value,
  )
  @IsEmail({}, { each: true })
  memberEmails: string[];
}
