import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { MailService } from "../../../core/mail/mail.service";
import { EventEmitter2 } from "@nestjs/event-emitter";

export interface MailJobData {
  to: string;
  subject: string;
  content: string;
  userId?: number;
  totalJobs?: number;
  currentIndex?: number;
}

@Processor("mail-notification", { concurrency: 3 })
export class NotificationQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationQueueProcessor.name);

  constructor(
    private readonly mailService: MailService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<MailJobData>): Promise<any> {
    const { to, subject, content, totalJobs, currentIndex } = job.data;
    this.logger.log(
      `[BullMQ Worker] Sending email to ${to} (${currentIndex || 1}/${
        totalJobs || 1
      }) - Subject: ${subject}`,
    );

    try {
      if (job.name === "send-otp") {
        const otp = (job.data as any).otp;
        await this.mailService.sendOtpEmail(to, otp);
      } else if (job.name === "send-reset-password") {
        const resetLink = (job.data as any).resetLink;
        await this.mailService.sendResetPasswordEmail(to, resetLink);
      } else {
        await this.mailService.sendNotificationEmail(
          to,
          "Participant",
          subject,
          content,
        );
      }

      if (totalJobs && currentIndex) {
        const progress = Math.round((currentIndex / totalJobs) * 100);
        await job.updateProgress(progress);
        this.eventEmitter.emit("job.progress", {
          queueName: "mail-notification",
          progress,
          currentIndex,
          totalJobs,
        });
      }

      return { success: true, to };
    } catch (error: any) {
      this.logger.error(
        `[BullMQ Worker] Failed to send email to ${to}: ${
          error?.message || error
        }`,
      );
      if (job.attemptsMade + 1 >= (job.opts.attempts || 3)) {
        this.eventEmitter.emit("job.failed", {
          jobId: job.id,
          queueName: "mail-notification",
          to,
          subject,
          error: error?.message || "Email delivery failed after retries",
        });
      }
      throw error;
    }
  }
}
