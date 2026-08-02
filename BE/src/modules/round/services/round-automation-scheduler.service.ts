import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { SubmissionOrganizerService } from "../../submission/services/submission.organizer.service";
import { GithubWebhookService } from "../../github/services/github.webhook.service";

import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@Injectable()
export class RoundAutomationSchedulerService {
  private readonly logger = new Logger(RoundAutomationSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly submissionOrganizerService: SubmissionOrganizerService,
    private readonly githubWebhookService: GithubWebhookService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue("round-automation") private readonly roundQueue: Queue,
  ) {}

  async scheduleRegistrationDeadlineJob(eventId: number, deadline: Date) {
    const jobId = `registration-deadline-event-${eventId}`;

    try {
      const existingJob = await this.roundQueue.getJob(jobId);
      if (existingJob) await existingJob.remove();
    } catch (err) {
      this.logger.warn(
        `Could not remove old registration deadline job for event ${eventId}: ${err}`,
      );
    }

    const now = Date.now();
    const delay = deadline.getTime() - now;

    if (delay > 0) {
      await this.roundQueue.add(
        "round-automation-job",
        { eventId, type: "registration-deadline-expired" },
        { jobId, delay },
      );
      this.logger.log(
        `[BullMQ Scheduled] Registration deadline job set for Event ${eventId} in ${Math.round(delay / 1000)}s`,
      );
    } else {
      this.logger.log(
        `[BullMQ Notice] Registration deadline for Event ${eventId} is already in the past. Executing immediate trigger.`,
      );
      await this.roundQueue.add(
        "round-automation-job",
        { eventId, type: "registration-deadline-expired" },
        { jobId: `${jobId}-immediate-${now}`, delay: 0 },
      );
    }
  }

  async scheduleRoundDelayedJobs(roundId: number, eventId: number, deadline: Date) {
    const reminderJobId = `bulk-reminder-15m-round-${roundId}`;
    const freezeJobId = `auto-freeze-round-${roundId}`;

    // Remove existing delayed jobs if present for clean rescheduling
    try {
      const existingReminder = await this.roundQueue.getJob(reminderJobId);
      if (existingReminder) await existingReminder.remove();
      const existingFreeze = await this.roundQueue.getJob(freezeJobId);
      if (existingFreeze) await existingFreeze.remove();
    } catch (err) {
      this.logger.warn(`Could not remove old delayed jobs for round ${roundId}: ${err}`);
    }

    const now = Date.now();
    const deadlineMs = deadline.getTime();
    const freezeDelay = deadlineMs - now;
    const reminderDelay = deadlineMs - 15 * 60 * 1000 - now;

    if (reminderDelay > 0) {
      await this.roundQueue.add(
        "round-automation-job",
        { roundId, eventId, type: "bulk-reminder-15m" },
        { jobId: reminderJobId, delay: reminderDelay },
      );
      this.logger.log(
        `[BullMQ Scheduled] 15m reminder delayed job set for Round ${roundId} in ${Math.round(reminderDelay / 1000)}s`,
      );
    }

    if (freezeDelay > 0) {
      await this.roundQueue.add(
        "round-automation-job",
        { roundId, eventId, type: "auto-freeze" },
        { jobId: freezeJobId, delay: freezeDelay },
      );
      this.logger.log(
        `[BullMQ Scheduled] Auto-freeze delayed job set for Round ${roundId} in ${Math.round(freezeDelay / 1000)}s`,
      );
    }
  }
}
