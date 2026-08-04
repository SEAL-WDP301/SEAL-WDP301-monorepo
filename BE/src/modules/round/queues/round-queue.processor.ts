import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger, forwardRef } from "@nestjs/common";
import { Job } from "bullmq";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { GithubWebhookService } from "../../github/services/github.webhook.service";
import { SubmissionOrganizerService } from "../../submission/services/submission.organizer.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { RoundStatus, EventStatus } from "@prisma/client";
import { EventOrganizerService } from "../../event/services/event.organizer.service";

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
    @Inject(forwardRef(() => EventOrganizerService))
    private readonly eventOrganizerService: EventOrganizerService,
  ) {
    super();
  }

  async process(job: Job<RoundJobData>): Promise<any> {
    this.logger.log(
      `[BullMQ Worker] Processing Job ${job.id} of type: ${job.data.type} for Event ID ${job.data.eventId}`,
    );

    if (job.data.type === "registration-deadline-expired") {
      this.logger.log(
        `[BullMQ Worker] Registration deadline expired for Event ID ${job.data.eventId}. Opening Round 1, then Event -> ongoing.`,
      );

      const round1 = await this.prisma.round.findFirst({
        where: { eventId: job.data.eventId, roundNumber: 1 },
      });

      let roundOpened = false;

      if (round1 && round1.status === RoundStatus.not_started) {
        try {
          // Same validation as manual open (≥1 track + problem file(s); deferred assign).
          await this.eventOrganizerService.updateRoundStatus(
            job.data.eventId,
            round1.id,
            RoundStatus.open,
          );
          roundOpened = true;
          this.logger.log(
            `[BullMQ Worker] Round 1 (ID: ${round1.id}) status updated to OPEN for Event ${job.data.eventId}`,
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `[BullMQ Worker] Cannot auto-open Round 1 for Event ${job.data.eventId}: ${message}. Leaving event status unchanged so organizer can still add tracks/problem files, then open manually.`,
          );
        }
      } else if (round1 && round1.status !== RoundStatus.not_started) {
        roundOpened = true;
      }

      // Only mark ongoing after Round 1 is actually open (or already past not_started).
      // Avoid locking Flow B when tracks/files are missing.
      if (roundOpened) {
        await this.prisma.event.update({
          where: { id: job.data.eventId },
          data: { status: EventStatus.ongoing },
        });
      }

      this.eventEmitter.emit("event.registration_deadline_expired", {
        eventId: job.data.eventId,
        round1Id: round1?.id,
        timestamp: new Date(),
      });

      return {
        status: roundOpened ? "registration_closed" : "registration_closed_round_pending",
        eventId: job.data.eventId,
        roundOpened,
      };
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
        `[BullMQ Worker] Auto-freezing repos for Round "${round.name}" (ID: ${round.id}, status=${round.status})`,
      );
      await this.githubWebhookService.freezeEventRepos(round.eventId);

      // Only close when still open — never overwrite results_published / closed
      // (a late/retried job must not re-open the scoring window).
      if (round.status === RoundStatus.open) {
        await this.prisma.round.update({
          where: { id: round.id },
          data: {
            isRepoFrozen: true,
            status: RoundStatus.closed,
          },
        });
      } else if (!round.isRepoFrozen) {
        await this.prisma.round.update({
          where: { id: round.id },
          data: { isRepoFrozen: true },
        });
      }

      this.eventEmitter.emit("round.repos_frozen", {
        eventId: round.eventId,
        roundId: round.id,
        roundName: round.name,
        eventName: round.event?.name || `Event ${round.eventId}`,
        submissionDeadline: round.submissionDeadline,
      });

      return {
        status:
          round.status === RoundStatus.open
            ? "frozen"
            : "frozen_status_unchanged",
        roundId: round.id,
      };
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
