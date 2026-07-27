import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { GithubService } from "../../../core/github/github.service";
import { EventEmitter2 } from "@nestjs/event-emitter";

export interface GithubJobData {
  org: string;
  repoName: string;
  username: string;
  permission: "pull" | "push";
  teamId?: number;
  eventId?: number;
}

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
    const { org, repoName, username, permission, eventId } = job.data;
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

      // If max attempts reached, emit DLQ / failure alert
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
