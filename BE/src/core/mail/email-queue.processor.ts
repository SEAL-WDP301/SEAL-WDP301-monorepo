import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { MailerService } from "@nestjs-modules/mailer";

export interface TeamInvitationJobData {
  mailOptions: any;
}

@Processor("email-queue")
export class EmailQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailQueueProcessor.name);

  constructor(private readonly mailerService: MailerService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing email job ${job.id} (name: ${job.name})`);
    switch (job.name) {
      case "send-team-invitation": {
        const { mailOptions } = job.data as TeamInvitationJobData;
        const response = await this.mailerService.sendMail(mailOptions);
        this.logger.log(
          `Team invitation email sent via BullMQ queue to ${mailOptions.to}, MessageID: ${response?.messageId}`,
        );
        return response;
      }
      default:
        this.logger.warn(`Unknown email queue job type: ${job.name}`);
    }
  }
}
