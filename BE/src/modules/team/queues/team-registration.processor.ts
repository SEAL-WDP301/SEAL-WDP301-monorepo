import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger, forwardRef, Inject } from "@nestjs/common";
import { Job } from "bullmq";
import { RegisterTeamDto } from "../dto/register-team.dto";
import { TeamStudentService } from "../services/team.student.service";
import { NotificationService } from "../../notification/services/notification.service";
import { NotificationType } from "@prisma/client";

export interface TeamRegistrationJobData {
  userId: number;
  eventId: number;
  dto: RegisterTeamDto;
  correlationId?: string;
}

@Injectable()
@Processor("team-registration", { concurrency: 1 })
export class TeamRegistrationProcessor extends WorkerHost {
  private readonly logger = new Logger(TeamRegistrationProcessor.name);

  constructor(
    @Inject(forwardRef(() => TeamStudentService))
    private readonly teamStudentService: TeamStudentService,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  async process(job: Job<TeamRegistrationJobData>): Promise<any> {
    const { userId, eventId, dto } = job.data;
    this.logger.log(
      `[TeamRegistrationProcessor] Processing registration for User ID: ${userId}, Event ID: ${eventId}, Team: ${dto.teamName}`,
    );

    try {
      const createdTeam = await this.teamStudentService.registerTeam(
        userId,
        eventId,
        dto,
      );

      // Notify the leader via Notification / SSE
      await this.notificationService.createNotification({
        userId,
        eventId,
        type: NotificationType.registration_approved,
        title: "Đăng ký sự kiện thành công",
        content: `Đội "${createdTeam.name}" của bạn đã được đăng ký thành công cho sự kiện!`,
      });

      this.logger.log(
        `[TeamRegistrationProcessor] Team ${createdTeam.name} registered successfully (ID: ${createdTeam.id})`,
      );

      return {
        success: true,
        teamId: createdTeam.id,
        teamName: createdTeam.name,
        message: "Registration completed successfully",
      };
    } catch (error: any) {
      this.logger.error(
        `[TeamRegistrationProcessor] Registration failed for User ID: ${userId}, Event ID: ${eventId}: ${error.message}`,
      );

      await this.notificationService.createNotification({
        userId,
        eventId,
        type: NotificationType.registration_rejected,
        title: "Đăng ký sự kiện không thành công",
        content: error.message || "Đã xảy ra lỗi trong quá trình xử lý đăng ký đội.",
      });

      throw error;
    }
  }
}
