import {
  Controller,
  Post,
  Param,
  ParseIntPipe,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { Role } from "../../../common/enums/role.enum";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { SubmissionOrganizerService } from "../services/submission.organizer.service";

@ApiTags("Organizer/Submissions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER, Role.ADMIN)
@Controller("organizer/submissions")
export class SubmissionOrganizerController {
  constructor(
    private readonly submissionOrganizerService: SubmissionOrganizerService,
  ) {}

  @Post("events/:eventId/rounds/:roundId/bulk-remind")
  @ApiOperation({ summary: "Send bulk reminder notifications for submissions" })
  async bulkRemindSubmissions(
    @Param("eventId", ParseIntPipe) eventId: number,
    @Param("roundId", ParseIntPipe) roundId: number,
  ) {
    const result = await this.submissionOrganizerService.bulkRemindSubmissions(
      eventId,
      roundId,
    );
    return { message: "Bulk reminders sent successfully", data: result };
  }
}
