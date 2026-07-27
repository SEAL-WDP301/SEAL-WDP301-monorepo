import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

/**
 * Unified success response format.
 */
export interface SuccessResponse<T> {
  success: true;
  message: string;
  data: T;
  meta?: any;
  timestamp: string;
}

/**
 * TransformInterceptor — wraps all successful responses in a unified format.
 *
 * NestJS Lifecycle position: Interceptor layer (wraps the Handler execution).
 * Flow: Middleware → Guard → [TransformInterceptor (before)] → Pipe → Handler → [TransformInterceptor (after)]
 *
 * If a controller returns { message, data } shape, it is preserved.
 * Otherwise, the raw return value is placed in data field.
 *
 * Output format:
 * {
 *   "success": true,
 *   "message": "Operation successful",
 *   "data": { ... },
 *   "timestamp": "2024-01-01T00:00:00.000Z"
 * }
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  SuccessResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessResponse<T>> | Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Skip transformation for Server-Sent Events (SSE)
    if (request.headers.accept?.includes("text/event-stream")) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        // If the handler already returns the full envelope shape, pass through
        if (data && typeof data === "object" && "success" in data) {
          return data;
        }

        const message = data?.message ?? "Success";
        const payload = data?.data !== undefined ? data.data : data;
        const meta = data?.meta;

        return {
          success: true as const,
          message,
          data: payload,
          ...(meta !== undefined && { meta }),
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
