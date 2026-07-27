import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";

export class CreateMentorFeedbackDto {
  @ApiProperty({
    description: "Feedback for the team's submission",
    example: "The solution is clear. Consider adding input validation.",
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: "Feedback content must not be blank" })
  @MaxLength(5000)
  content: string;
}
