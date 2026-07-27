import { IsEnum } from "class-validator";
import { FeedbackStatus } from "@prisma/client";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateFeedbackStatusDto {
  @ApiProperty({
    enum: FeedbackStatus,
    description: "The new status of the mentor feedback",
  })
  @IsEnum(FeedbackStatus)
  status: FeedbackStatus;
}
