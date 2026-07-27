import { Injectable, NestMiddleware, Inject } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import { v4 as uuidv4 } from "uuid";

/**
 * RequestLoggerMiddleware — logs every incoming HTTP request with metadata.
 *
 * NestJS Lifecycle position: FIRST in pipeline (Middleware layer).
 * Flow: [RequestLoggerMiddleware] → Guard → Interceptor → Pipe → Handler
 *
 * Logs:
 * - HTTP method and URL
 * - Request ID (UUID, attached to request for tracing)
 * - Response status code
 * - Response time in ms
 * - User agent
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: Logger,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl } = req;
    const startTime = Date.now();

    // Generate a unique request ID for distributed tracing
    const requestId = uuidv4();
    req["requestId"] = requestId;
    res.setHeader("X-Request-Id", requestId);

    // Log response after it finishes (to capture status code and duration)
    res.on("finish", () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;

      const logLevel =
        statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "log";

      const errMessage = req["errMessage"] ? ` → ${req["errMessage"]}` : "";

      this.logger[logLevel](
        `${method} ${originalUrl} ${statusCode} ${duration}ms${errMessage}`,
        "HTTP",
      );
    });

    next();
  }
}
