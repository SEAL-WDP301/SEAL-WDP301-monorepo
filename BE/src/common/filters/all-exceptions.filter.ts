import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import { Request, Response } from "express";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { Logger } from "winston";

/**
 * AllExceptionsFilter — global exception filter, catches ALL unhandled errors.
 *
 * NestJS Lifecycle position: Filter layer (wraps the entire request pipeline).
 * Flow: Middleware → Guard → Interceptor → Pipe → Handler → [AllExceptionsFilter on error]
 *
 * Behaviors:
 * - HttpException → return formatted error with status code and message
 * - Unknown errors → return 500, log full stack, DO NOT expose to client
 * - Never expose stack trace to client (security best practice)
 *
 * Output format:
 * {
 *   "success": false,
 *   "statusCode": 400,
 *   "message": "Validation failed",
 *   "errors": [...],
 *   "timestamp": "ISO_DATE"
 * }
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: Logger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = "Internal server error";
    let errors: unknown[] = [];

    if (exception instanceof HttpException) {
      // ─── Handled HTTP Exceptions ─────────────────────────────────
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "string") {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === "object") {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = (responseObj.message as string) || message;
        // class-validator returns array of validation errors
        if (Array.isArray(responseObj.message)) {
          errors = responseObj.message as unknown[];
          message = "Validation failed";
        }
      }

      // Đính kèm tin nhắn lỗi cụ thể vào request để Middleware mạng hiển thị
      request["errMessage"] = message;

      // Chỉ log lỗi nếu là lỗi nghiêm trọng của hệ thống (5xx)
      if (statusCode >= 500) {
        this.logger.error(
          `[${request.method}] ${request.url} → ${statusCode}: ${message}`,
          exception instanceof Error ? exception.stack : undefined,
          "AllExceptionsFilter",
        );
      }
    } else {
      // ─── Unknown / Unexpected Errors ─────────────────────────────
      // Log full details server-side (500)
      this.logger.error(
        `Unhandled exception: ${exception instanceof Error ? exception.message : "Unknown error"}`,
        exception instanceof Error ? exception.stack : undefined,
        "AllExceptionsFilter",
      );

      message = "Internal server error";
      request["errMessage"] = message;
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      message,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
