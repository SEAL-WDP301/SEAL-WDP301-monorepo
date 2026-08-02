import { Module } from "@nestjs/common";
import { MailerModule } from "@nestjs-modules/mailer";
import { BullModule } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { MailService } from "./mail.service";
import { EmailQueueProcessor } from "./email-queue.processor";

@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>("SMTP_HOST"),
          port: configService.get<number>("SMTP_PORT"),
          secure: false, // TLS
          auth: {
            user: configService.get<string>("SMTP_USER"),
            pass: configService.get<string>("SMTP_PASS"),
          },
        },
        defaults: {
          from: configService.get<string>("MAIL_FROM"),
        },
      }),
    }),
    BullModule.registerQueue({
      name: "email-queue",
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    }),
  ],
  providers: [MailService, EmailQueueProcessor],
  exports: [MailService, BullModule],
})
export class MailModule {}
