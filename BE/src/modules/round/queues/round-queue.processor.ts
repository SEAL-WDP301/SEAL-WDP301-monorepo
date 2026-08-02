import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { GithubWebhookService } from "../../github/services/github.webhook.service";
import { SubmissionOrganizerService } from "../../submission/services/submission.organizer.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { RoundStatus, EventStatus } from "@prisma/client";

export interface RoundJobData {
  roundId?: number;
  eventId: number;
  type: "auto-freeze" | "bulk-reminder-15m" | "registration-deadline-expired";
}

@Processor("round-automation")
export class RoundQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(RoundQueueProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubWebhookService: GithubWebhookService,
    private readonly submissionOrganizerService: SubmissionOrganizerService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<RoundJobData>): Promise<any> {
    this.logger.log(
      `[BullMQ Worker] Processing Job ${job.id} of type: ${job.data.type} for Event ID ${job.data.eventId}`,
    );

    if (job.data.type === "registration-deadline-expired") {
      this.logger.log(
        `[BullMQ Worker] Registration deadline expired for Event ID ${job.data.eventId}. Transitioning Event -> ongoing, Round 1 -> open.`,
      );

      // 1. Update Event status to ongoing
      await this.prisma.event.update({
        where: { id: job.data.eventId },
        data: { status: EventStatus.ongoing },
      });

      // 2. Find Round 1 and update status to open
      const round1 = await this.prisma.round.findFirst({
        where: { eventId: job.data.eventId, roundNumber: 1 },
      });

      if (round1 && round1.status === RoundStatus.not_started) {
        await this.prisma.round.update({
          where: { id: round1.id },
          data: { status: RoundStatus.open },
        });
        this.logger.log(
          `[BullMQ Worker] Round 1 (ID: ${round1.id}) status updated to OPEN for Event ${job.data.eventId}`,
        );
      }

      this.eventEmitter.emit("event.registration_deadline_expired", {
        eventId: job.data.eventId,
        round1Id: round1?.id,
        timestamp: new Date(),
      });

      return { status: "registration_closed", eventId: job.data.eventId };
    }

    if (!job.data.roundId) {
      this.logger.warn(`Round ID missing for job ${job.id}. Skipping.`);
      return { skipped: true };
    }

    const round = await this.prisma.round.findUnique({
      where: { id: job.data.roundId },
      include: { event: true },
    });

    if (!round) {
      this.logger.warn(`Round ${job.data.roundId} not found. Skipping job.`);
      return { skipped: true };
    }

    if (job.data.type === "auto-freeze") {
      this.logger.log(
        `[BullMQ Worker] Auto-freezing repos for Round "${round.name}" (ID: ${round.id})`,
      );
      await this.githubWebhookService.freezeEventRepos(round.eventId);
      await this.prisma.round.update({
        where: { id: round.id },
        data: {
          isRepoFrozen: true,
          status: RoundStatus.closed,
        },
      });

      this.eventEmitter.emit("round.repos_frozen", {
        eventId: round.eventId,
        roundId: round.id,
        roundName: round.name,
        eventName: round.event?.name || `Event ${round.eventId}`,
        submissionDeadline: round.submissionDeadline,
      });

      return { status: "frozen", roundId: round.id };
    }

    if (job.data.type === "bulk-reminder-15m") {
      this.logger.log(
        `[BullMQ Worker] Executing 15m reminder for Round "${round.name}" (ID: ${round.id})`,
      );
      await this.submissionOrganizerService.bulkRemindSubmissions(
        round.eventId,
        round.id,
      );
      await this.prisma.round.update({
        where: { id: round.id },
        data: { isReminderSent: true },
      });

      this.eventEmitter.emit("round.reminder_15m_triggered", {
        eventId: round.eventId,
        roundId: round.id,
        roundName: round.name,
        eventName: round.event?.name || `Event ${round.eventId}`,
        submissionDeadline: round.submissionDeadline,
      });

      return { status: "reminded", roundId: round.id };
    }
  }
}
