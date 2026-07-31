import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import * as helmet from "helmet";
import * as cookieParser from "cookie-parser";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { RedisIoAdapter } from "./core/redis/redis-io.adapter";

/**
 * bootstrap — NestJS application setup function.
 *
 * Applies global configurations in this order:
 * 1. Logger (Winston replaces default NestJS logger)
 * 2. Security middleware (helmet, cors, cookie-parser)
 * 3. Global Pipes (ValidationPipe)
 * 4. Global Filters (AllExceptionsFilter)
 * 5. Global Interceptors (TransformInterceptor)
 * 6. Swagger documentation
 * 7. Start listening
 *
 * Global NestJS Lifecycle for each request:
 * Middleware → Guard → Interceptor (enter) → Pipe → Handler → Interceptor (exit) → Filter (on error)
 */
export async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Bật log error/warn để tránh bị "nuốt" lỗi nghiêm trọng lúc khởi động, nhưng tắt các log thường để nhường cho Winston
    logger: ["error", "warn"],
    // Buffer logs until Winston is ready
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);

  // Enable Redis Pub/Sub Adapter for multi-pod Socket.IO scaling
  const redisIoAdapter = new RedisIoAdapter(app, configService);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  app.use((helmet as any).default());

  const frontendUrl = configService.get<string>("app.frontendUrl");
  const corsOrigins = [
    frontendUrl,
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
  ].filter((url, index, arr) => url && arr.indexOf(url) === index);

  app.enableCors({
    origin: corsOrigins,
    credentials: true, // Allow cookies (for refresh token)
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  });

  app.use(cookieParser(configService.get<string>("app.cookieSecret")));

  const prefix = configService.get<string>("app.prefix") || "api";
  app.setGlobalPrefix(prefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Throw error if non-whitelisted properties are sent
      forbidNonWhitelisted: true,

      // Transform plain objects to DTO class instances
      transform: true,

      // Transform query params to their declared types (e.g., string → number)
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(
    new AllExceptionsFilter(app.get(WINSTON_MODULE_NEST_PROVIDER)),
  );

  app.useGlobalInterceptors(new TransformInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle("SEAL – Hackathon Management API")
    .setDescription(
      `## SEAL – Software Engineering Hackathon Management System\n\n` +
        `Enterprise-ready REST API built with NestJS.\n\n` +
        `### Authentication\n` +
        `- Use JWT Bearer token for protected endpoints\n` +
        `- Refresh token is stored in HttpOnly cookie (not visible in Swagger)\n` +
        `- Google and GitHub OAuth2 endpoints trigger browser redirects (not testable via Swagger)\n\n` +
        `### Response Format\n` +
        `All responses follow a unified envelope:\n` +
        `\`{ success, message, data, timestamp }\``,
    )
    .setVersion("1.0.0")
    .setContact("SEAL Team", "", "seal@fpt.edu.vn")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        name: "Authorization",
        description: "Enter your JWT access token",
        in: "header",
      },
      "bearer", // Reference key matching default @ApiBearerAuth()
    )
    .addCookieAuth("refresh_token", {
      type: "apiKey",
      in: "cookie",
      name: "refresh_token",
    })
    .addTag("Authentication", "User signup, login, token refresh, and OAuth2")
    .addTag("Users", "User profile management")
    .addTag("Health", "System health monitoring")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${prefix}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Keep auth token between page reloads
      tagsSorter: "alpha",
      operationsSorter: "alpha",
    },
    customSiteTitle: "SEAL API Docs",
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. START SERVER
  // ─────────────────────────────────────────────────────────────────────────────
  // Enable shutdown hooks for Prisma $disconnect
  app.enableShutdownHooks();

  const port = configService.get<number>("app.port") || 3000;
  await app.listen(port);

  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  logger.log(
    "info",
    `🚀 SEAL API running on http://localhost:${port}/${prefix}`,
    {
      context: "Bootstrap",
    },
  );
  logger.log(
    "info",
    `📖 Swagger docs: http://localhost:${port}/${prefix}/docs`,
    {
      context: "Bootstrap",
    },
  );
  logger.log(
    "info",
    `🌍 Environment: ${configService.get<string>("app.nodeEnv")}`,
    {
      context: "Bootstrap",
    },
  );
}
