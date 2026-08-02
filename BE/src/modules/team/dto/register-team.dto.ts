import {
  IsInt,
  IsString,
  IsArray,
  IsEmail,
  IsOptional,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";

export class RegisterTeamDto {
  @ApiPropertyOptional({
    description:
      "Required when event.deferredTrackAssignment is false. Omitted/null when tracks are revealed later.",
  })
  @IsOptional()
  @IsInt()
  trackId?: number | null;

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
