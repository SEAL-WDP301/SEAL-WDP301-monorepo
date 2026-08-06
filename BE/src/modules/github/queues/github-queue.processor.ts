import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { GithubService } from "../../../core/github/github.service";
import { EventEmitter2 } from "@nestjs/event-emitter";

export type GithubJobData =
  | {
      type?: "set-permission";
      org: string;
      repoName: string;
      username: string;
      permission: "pull" | "push";
      teamId?: number;
      eventId?: number;
    }
  | {
      type: "set-visibility";
      org: string;
      repoName: string;
      isPrivate: boolean;
      teamId?: number;
      eventId?: number;
      username?: string;
      permission?: "pull" | "push";
    };

@Processor("github-repo", { concurrency: 5 })
export class GithubQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(GithubQueueProcessor.name);

  constructor(
    private readonly githubService: GithubService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<GithubJobData>): Promise<any> {
    const data = job.data;
    const jobType =
      data.type ||
      (job.name === "set-visibility" ? "set-visibility" : "set-permission");

    if (jobType === "set-visibility") {
      const { org, repoName, isPrivate, eventId } = data as Extract<
        GithubJobData,
        { type: "set-visibility" }
      >;
      this.logger.log(
        `[BullMQ Worker] Setting visibility private=${isPrivate} for ${org}/${repoName} (Attempt ${job.attemptsMade + 1})`,
      );
      try {
        await this.githubService.updateRepoVisibility(
          org,
          repoName,
          isPrivate,
        );
        return { success: true, repoName, isPrivate };
      } catch (error: any) {
        this.logger.error(
          `[BullMQ Worker] Failed visibility update for ${org}/${repoName}: ${
            error?.message || error
          }`,
        );
        if (job.attemptsMade + 1 >= (job.opts.attempts || 5)) {
          this.eventEmitter.emit("job.failed", {
            jobId: job.id,
            queueName: "github-repo",
            repoName,
            error: error?.message || "Max retries reached",
            eventId,
          });
        }
        throw error;
      }
    }

    const { org, repoName, username, permission, eventId } = data as Extract<
      GithubJobData,
      { permission: "pull" | "push" }
    >;
    this.logger.log(
      `[BullMQ Worker] Setting permission "${permission}" for GitHub user "${username}" on repo ${org}/${repoName} (Attempt ${job.attemptsMade + 1})`,
    );

    try {
      await this.githubService.addCollaborator(
        org,
        repoName,
        username,
        permission,
      );
      this.logger.log(
        `[BullMQ Worker] Successfully updated permission for ${username}`,
      );
      return { success: true, username, repoName, permission };
    } catch (error: any) {
      this.logger.error(
        `[BullMQ Worker] Failed to update permission for ${username}: ${
          error?.message || error
        }`,
      );

      if (job.attemptsMade + 1 >= (job.opts.attempts || 5)) {
        this.eventEmitter.emit("job.failed", {
          jobId: job.id,
          queueName: "github-repo",
          username,
          repoName,
          error: error?.message || "Max retries reached",
          eventId,
        });
      }
      throw error;
    }
  }
}
