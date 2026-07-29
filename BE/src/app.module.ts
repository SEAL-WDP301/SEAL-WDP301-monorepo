import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { WinstonModule } from "nest-winston";

// Config namespaces
import appConfig from "./config/app.config";
import databaseConfig from "./config/database.config";
import jwtConfig from "./config/jwt.config";
import redisConfig from "./config/redis.config";
import githubConfig from "./config/github.config";

// Logger config
import { createWinstonConfig } from "./logger/winston.config";

// Middleware
import { RequestLoggerMiddleware } from "./common/middleware/request-logger.middleware";

// Core Database Module
import { PrismaModule } from "./database/prisma/prisma.module";

// Feature Modules
import { AuthModule } from "./modules/auth/auth.module";
import { UserModule } from "./modules/user/user.module";
import { HealthModule } from "./core/health/health.module";
import { RedisModule } from "./core/redis/redis.module";
import { MailModule } from "./core/mail/mail.module";
import { EventModule } from "./modules/event/event.module";
import { RubricModule } from "./modules/rubric/rubric.module";
import { TeamModule } from "./modules/team/team.module";
import { NotificationModule } from "./modules/notification/notification.module";
import { StorageModule } from "./core/storage/storage.module";
import { AssignmentModule } from "./modules/assignment/assignment.module";
import { SubmissionModule } from "./modules/submission/submission.module";
import { FeedbackModule } from "./modules/feedback/feedback.module";
import { ChatModule } from "./modules/chat/chat.module";

import { EventEmitterModule } from "@nestjs/event-emitter";
import { Inject } from "@nestjs/common";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { GithubModule } from "./modules/github/github.module";
import { IntegrationModule } from "./modules/integration/integration.module";

import { ScheduleModule } from "@nestjs/schedule";
import { BullModule } from "@nestjs/bullmq";
import { RoundModule } from "./modules/round/round.module";
import { DevE2eModule } from "./modules/dev-e2e/dev-e2e.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV || "development"}`, ".env"],
      load: [appConfig, databaseConfig, jwtConfig, redisConfig, githubConfig],
      cache: true,
    }),

    ScheduleModule.forRoot(),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>("redis.host") || "localhost",
          port: configService.get<number>("redis.port") || 6379,
          password: configService.get<string>("redis.password") || undefined,
        },
      }),
    }),

    WinstonModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createWinstonConfig(configService),
    }),

    PrismaModule,
    EventEmitterModule.forRoot({ wildcard: true }),
    RedisModule,
    MailModule,
    AuthModule,
    UserModule,
    HealthModule,
    EventModule,
    RoundModule,
    NotificationModule,
    RubricModule,
    TeamModule,
    StorageModule,
    AssignmentModule,
    SubmissionModule,
    FeedbackModule,
    AnalyticsModule,
    ChatModule,
    GithubModule,
    IntegrationModule,
    DevE2eModule,
  ],
})
export class AppModule implements NestModule {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: Logger,
  ) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes("*");
  }
}
