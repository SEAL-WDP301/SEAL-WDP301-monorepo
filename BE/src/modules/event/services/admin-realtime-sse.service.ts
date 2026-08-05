import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { RedisService } from "../../../core/redis/redis.service";

export interface SseMessageEvent {
  data: any;
  id?: string;
  type?: string;
  retry?: number;
}

@Injectable()
export class AdminRealtimeSseService {
  private readonly logger = new Logger(AdminRealtimeSseService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Listen to internal NestJS event for Team Registration and publish to Redis Pub/Sub
   */
  @OnEvent("team.registered")
  async handleTeamRegistered(data: any) {
    if (!data?.eventId) return;
    const channel = `admin:events:event:${data.eventId}`;
    const payload = JSON.stringify({
      type: "team.registered",
      timestamp: new Date().toISOString(),
      data,
    });

    try {
      await this.redisService.publish(channel, payload);
      this.logger.log(
        `Published team.registered event to Redis channel [${channel}] for team "${data.teamName || data.name}"`,
      );
    } catch (err: any) {
      this.logger.error(`Failed to publish team.registered to Redis: ${err?.message}`);
    }
  }

  /**
   * Listen to internal NestJS event for Submission Creation and publish to Redis Pub/Sub
   */
  @OnEvent("submission.created")
  async handleSubmissionCreated(data: any) {
    if (!data?.roundId) return;
    const channel = `admin:events:round:${data.roundId}`;
    const payload = JSON.stringify({
      type: "submission.created",
      timestamp: new Date().toISOString(),
      data,
    });

    try {
      await this.redisService.publish(channel, payload);
      this.logger.log(
        `Published submission.created event to Redis channel [${channel}] for round ${data.roundId}`,
      );
    } catch (err: any) {
      this.logger.error(`Failed to publish submission.created to Redis: ${err?.message}`);
    }
  }

  /**
   * Stream real-time Event-level updates for Organizer/Admin via SSE (backed by Redis Pub/Sub)
   */
  streamEventUpdates(eventId: number): Observable<SseMessageEvent> {
    const channel = `admin:events:event:${eventId}`;
    this.logger.log(`Organizer subscribed to SSE stream for event [${eventId}] on channel [${channel}]`);

    return this.redisService.subscribeChannel(channel).pipe(
      map((rawMessage: string) => {
        try {
          const parsed = JSON.parse(rawMessage);
          return {
            type: parsed.type || "message",
            data: JSON.stringify(parsed.data ?? parsed),
          };
        } catch {
          return {
            type: "message",
            data: JSON.stringify({ raw: rawMessage }),
          };
        }
      }),
    );
  }

  /**
   * Stream real-time Round-level updates (submissions, freeze status) for Organizer/Admin via SSE
   */
  streamRoundUpdates(roundId: number): Observable<SseMessageEvent> {
    const channel = `admin:events:round:${roundId}`;
    this.logger.log(`Organizer subscribed to SSE stream for round [${roundId}] on channel [${channel}]`);

    return this.redisService.subscribeChannel(channel).pipe(
      map((rawMessage: string) => {
        try {
          const parsed = JSON.parse(rawMessage);
          return {
            type: parsed.type || "message",
            data: JSON.stringify(parsed.data ?? parsed),
          };
        } catch {
          return {
            type: "message",
            data: JSON.stringify({ raw: rawMessage }),
          };
        }
      }),
    );
  }
}
