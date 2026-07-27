import {
  Controller,
  Patch,
  Param,
  Body,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { Role } from "../../../common/enums/role.enum";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { FeedbackStudentService } from "../services/feedback.student.service";
import { UpdateFeedbackStatusDto } from "../dto/update-feedback-status.dto";

@ApiTags("Student/Teams")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STUDENT)
@Controller("student/teams")
export class FeedbackStudentController {
  constructor(
    private readonly feedbackStudentService: FeedbackStudentService,
  ) {}

  @Patch("my-team/feedbacks/:feedbackId/status")
  @ApiOperation({ summary: "Update mentor feedback status by student" })
  async updateFeedbackStatus(
    @CurrentUser("id") userId: string,
    @Param("feedbackId") feedbackId: string,
    @Body() dto: UpdateFeedbackStatusDto,
  ) {
    const feedback = await this.feedbackStudentService.updateFeedbackStatus(
      Number(userId),
      Number(feedbackId),
      dto.status,
    );
    return { message: "Feedback status updated", data: feedback };
  }
}
