import { Injectable, Logger } from "@nestjs/common";
import { Event, Team, Track } from "@prisma/client";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { GithubService } from "../../../core/github/github.service";

export interface TeamGithubProvisionResult {
  provisioned: boolean;
  skipped: boolean;
  reason?: string;
  repoUrl?: string;
  repoName?: string;
}

@Injectable()
export class TeamGithubService {
  private readonly logger = new Logger(TeamGithubService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GithubService,
  ) { }

  async provisionRepositoryForTeam(
    teamId: number,
    roundId?: number,
  ): Promise<TeamGithubProvisionResult> {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        event: true,
        track: true,
        leader: { include: { studentProfile: true } },
        members: { include: { user: { include: { studentProfile: true } } } },
      },
    });

    if (!team) {
      return { provisioned: false, skipped: true, reason: "Team not found" };
    }

    if (team.githubRepoUrl) {
      if (roundId) {
        await this.autoCreateSubmission(
          teamId,
          roundId,
          team.githubRepoUrl,
          team.leaderId,
        );
      }
      return {
        provisioned: false,
        skipped: true,
        reason: "Repository already assigned",
        repoUrl: team.githubRepoUrl,
        repoName: team.githubRepoName ?? undefined,
      };
    }

    if (!this.githubService.isConfigured()) {
      this.logger.warn(
        `Skipping GitHub repo for team ${teamId}: GITHUB_TOKEN not configured`,
      );
      return {
        provisioned: false,
        skipped: true,
        reason: "GitHub integration not configured",
      };
    }

    const org = this.githubService.resolveOrgName(team.event.githubOrgUrl);
    if (!org) {
      this.logger.warn(
        `Skipping GitHub repo for team ${teamId}: no org URL on event and no GITHUB_ORG fallback`,
      );
      return {
        provisioned: false,
        skipped: true,
        reason: "Event has no GitHub organization configured",
      };
    }

    const repoName = this.githubService.buildRepoName(team.event, team);
    const description = this.buildRepoDescription(team.event, team, team.track);

    try {
      const created = await this.githubService.createTeamRepository({
        org,
        repoName,
        description,
      });

      const updated = await this.prisma.team.update({
        where: { id: teamId },
        data: {
          githubRepoUrl: created.htmlUrl,
          githubRepoName: created.name,
        },
      });

      // Add collaborators
      const githubUsernames = new Set<string>();
      if (team.leader?.studentProfile?.githubUsername) {
        githubUsernames.add(team.leader.studentProfile.githubUsername);
      }
      for (const member of team.members) {
        if (member.user?.studentProfile?.githubUsername) {
          githubUsernames.add(member.user.studentProfile.githubUsername);
        }
      }

      for (const username of Array.from(githubUsernames)) {
        await this.githubService
          .addCollaborator(org, repoName, username, "push")
          .catch((err) => {
            this.logger.error(
              `Failed to add collaborator ${username} to ${repoName}`,
              err,
            );
          });
      }

      this.logger.log(
        `GitHub repo created for team ${teamId}: ${created.htmlUrl}`,
      );

      if (roundId) {
        await this.autoCreateSubmission(
          teamId,
          roundId,
          created.htmlUrl,
          team.leaderId,
        );
      }

      return {
        provisioned: true,
        skipped: false,
        repoUrl: updated.githubRepoUrl ?? undefined,
        repoName: updated.githubRepoName ?? undefined,
      };
    } catch (error) {
      this.logger.error(
        `Failed to provision GitHub repo for team ${teamId}`,
        error instanceof Error ? error.stack : String(error),
      );
      return {
        provisioned: false,
        skipped: false,
        reason:
          error instanceof Error
            ? error.message
            : "GitHub repo creation failed",
      };
    }
  }

  async syncRepositoriesForRound(roundId: number): Promise<void> {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
    });
    if (!round || round.submissionType !== "github_link") {
      return;
    }

    const teamRounds = await this.prisma.teamRound.findMany({
      where: {
        roundId,
        status: { in: ["competing", "advanced"] },
      },
      include: { team: true },
    });

    const teamsWithoutRepo = teamRounds.filter((tr) => !tr.team.githubRepoUrl);
    this.logger.log(
      `Found ${teamsWithoutRepo.length} teams needing GitHub repo provision for round ${roundId}`,
    );

    for (const tr of teamsWithoutRepo) {
      await this.provisionRepositoryForTeam(tr.teamId, roundId);
    }
  }

  private async autoCreateSubmission(
    teamId: number,
    roundId: number,
    githubUrl: string,
    submittedById: number,
  ) {
    try {
      await this.prisma.submission.upsert({
        where: { teamId_roundId: { teamId, roundId } },
        create: {
          teamId,
          roundId,
          githubUrl,
          status: "submitted",
          submittedById,
        },
        update: {
          githubUrl,
        },
      });
      this.logger.log(
        `Auto-created submission for team ${teamId} in round ${roundId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to auto-create submission for team ${teamId} round ${roundId}`,
        error,
      );
    }
  }

  private buildRepoDescription(event: Event, team: Team, track: Track): string {
    return `SEAL ${event.season} ${event.year} — ${team.name} (${track.name})`;
  }
}
