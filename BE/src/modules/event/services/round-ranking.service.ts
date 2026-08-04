import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  NotificationType,
  RoundResultStatus,
  RoundStatus,
  SubmissionStatus,
  TeamStatus,
} from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../../../database/prisma/prisma.service";
import {
  computeSubmissionFinalScore,
  computeJudgeWeightedScore,
} from "../../../common/utils/scoring.util";
import { PublishRoundResultsDto } from "../dto/publish-round-results.dto";
import { TeamGithubService } from "../../team/services/team-github.service";
import { MailService } from "../../../core/mail/mail.service";

export interface RankedTeamEntry {
  rank: number;
  teamId: number;
  teamName: string;
  trackId: number;
  trackName: string;
  submissionId: number | null;
  finalScore: number | null;
  judgesScored: number;
  status: RoundResultStatus;
  submittedAt: Date;
  award?: any;
  totalVotes?: number;
  votedBy?: any[];
}

@Injectable()
export class RoundRankingService {
  private readonly logger = new Logger(RoundRankingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly teamGithubService: TeamGithubService,
    private readonly mailService: MailService,
  ) {}

  async getRoundRankings(eventId: number, roundId: number, trackId?: number) {
    const round = await this.assertRoundInEvent(eventId, roundId);

    const tracks = await this.getRoundScopedTracks(eventId, round, trackId);

    const nextRound = await this.prisma.round.findFirst({
      where: { eventId, roundNumber: round.roundNumber + 1 },
    });
    const isFinalRound = !nextRound;

    const rankingsByTrack = await Promise.all(
      tracks.map(async (track) => ({
        track: { id: track.id, name: track.name },
        entries: await this.buildTrackRanking(roundId, track.id),
      })),
    );

    return {
      round: {
        id: round.id,
        name: round.name,
        roundNumber: round.roundNumber,
        status: round.status,
        isFinalRound,
        isTrackSpecific: round.isTrackSpecific,
      },
      tracks: rankingsByTrack,
    };
  }

  async getDetailedRoundRankings(
    eventId: number,
    roundId: number,
    trackId?: number,
  ) {
    const round = await this.assertRoundInEvent(eventId, roundId);

    const tracks = await this.getRoundScopedTracks(eventId, round, trackId);

    const nextRound = await this.prisma.round.findFirst({
      where: { eventId, roundNumber: round.roundNumber + 1 },
    });

    const rankingsByTrack = await Promise.all(
      tracks.map(async (track) => ({
        track: { id: track.id, name: track.name },
        entries: await this.buildDetailedTrackRanking(roundId, track.id),
      })),
    );

    return {
      round: {
        id: round.id,
        name: round.name,
        roundNumber: round.roundNumber,
        status: round.status,
        isFinalRound: !nextRound,
        isTrackSpecific: round.isTrackSpecific,
      },
      tracks: rankingsByTrack,
    };
  }

  async publishRoundResults(
    eventId: number,
    roundId: number,
    dto: PublishRoundResultsDto,
  ) {
    const round = await this.assertRoundInEvent(eventId, roundId);

    if (round.status !== RoundStatus.closed) {
      throw new BadRequestException(
        "Round must be closed before results can be published",
      );
    }

    const tracks = await this.getRoundScopedTracks(eventId, round);

    const nextRound = await this.prisma.round.findFirst({
      where: { eventId, roundNumber: round.roundNumber + 1 },
    });
    const isFinalRound = !nextRound;
    const isTrackSpecific = round.isTrackSpecific;

    const advanceCount =
      dto.advanceCount == null ? null : Number(dto.advanceCount);

    if (!isFinalRound) {
      if (
        advanceCount == null ||
        !Number.isInteger(advanceCount) ||
        advanceCount < 1
      ) {
        throw new BadRequestException(
          "advanceCount is required (number of top teams to advance).",
        );
      }
    }

    const rankingsByTrack = await Promise.all(
      tracks.map(async (track) => ({
        track,
        entries: await this.buildTrackRanking(roundId, track.id),
      })),
    );

    const advancingSet = isFinalRound
      ? new Set<number>()
      : this.resolveAdvancingTeamIds(
          rankingsByTrack,
          advanceCount!,
          isTrackSpecific,
        );

    const prizeSlots = isFinalRound
      ? await this.loadPrizeSlots(eventId)
      : [];

    const awardByTeamId = isFinalRound
      ? this.resolveAutoAwards(rankingsByTrack, prizeSlots, isTrackSpecific)
      : new Map<number, number>();

    const summary: Array<{
      trackId: number;
      trackName: string;
      advancedTeamIds: number[];
      eliminatedTeamIds: number[];
    }> = [];

    await this.prisma.$transaction(async (tx) => {
      for (const { track, entries } of rankingsByTrack) {
        const advancedIds = isFinalRound
          ? []
          : entries
              .filter((entry) => advancingSet.has(entry.teamId))
              .map((entry) => entry.teamId);
        const eliminatedIds = isFinalRound
          ? []
          : entries
              .filter((entry) => !advancingSet.has(entry.teamId))
              .map((entry) => entry.teamId);

        for (const entry of entries) {
          const isAdvanced = advancedIds.includes(entry.teamId);
          const isEliminated = eliminatedIds.includes(entry.teamId);
          const status = isFinalRound
            ? RoundResultStatus.competing
            : isAdvanced
              ? RoundResultStatus.advanced
              : isEliminated
                ? RoundResultStatus.eliminated
                : RoundResultStatus.competing;

          await tx.teamRound.upsert({
            where: {
              teamId_roundId: { teamId: entry.teamId, roundId },
            },
            create: {
              teamId: entry.teamId,
              roundId,
              status,
              score: entry.finalScore,
            },
            update: {
              status,
              score: entry.finalScore,
            },
          });

          if (isAdvanced && nextRound) {
            await tx.teamRound.upsert({
              where: {
                teamId_roundId: { teamId: entry.teamId, roundId: nextRound.id },
              },
              create: {
                teamId: entry.teamId,
                roundId: nextRound.id,
                status: RoundResultStatus.competing,
              },
              update: {},
            });
          } else if (isEliminated && nextRound) {
            await tx.teamRound.deleteMany({
              where: {
                teamId: entry.teamId,
                roundId: nextRound.id,
              },
            });
          }

          if (isFinalRound) {
            const awardId = awardByTeamId.get(entry.teamId) ?? null;
            await tx.team.update({
              where: { id: entry.teamId },
              data: { awardId },
            });
          }
        }

        summary.push({
          trackId: track.id,
          trackName: track.name,
          advancedTeamIds: advancedIds,
          eliminatedTeamIds: eliminatedIds,
        });
      }

      if (!isFinalRound) {
        await tx.teamRound.updateMany({
          where: {
            roundId,
            status: RoundResultStatus.competing,
          },
          data: {
            status: RoundResultStatus.eliminated,
          },
        });
      }

      await tx.round.update({
        where: { id: roundId },
        data: { status: RoundStatus.results_published },
      });
    });

    await this.notifyRoundResults(eventId, round.name, summary, isFinalRound);

    let repoSyncStarted = false;
    if (nextRound && nextRound.submissionType === "github_link") {
      repoSyncStarted = true;
      this.logger.log(
        `[GitHub Sync] Starting background repository provisioning for Round ${nextRound.id}`,
      );
      this.teamGithubService
        .syncRepositoriesForRound(nextRound.id)
        .then(() => {
          this.logger.log(
            `[GitHub Sync] Finished provisioning repositories for Round ${nextRound.id}`,
          );
        })
        .catch((err) => {
          this.logger.error(
            `[GitHub Sync] Failed to sync github repositories for next round ${nextRound.id}`,
            err,
          );
        });
    }

    return {
      roundId,
      status: RoundStatus.results_published,
      advanceCount: dto.advanceCount ?? null,
      advancingTeamIds: Array.from(advancingSet),
      awards: Array.from(awardByTeamId.entries()).map(([teamId, awardId]) => ({
        teamId,
        awardId,
      })),
      nextRoundId: nextRound?.id ?? null,
      repoSyncStarted,
      summary,
      rankings: await this.getRoundRankings(eventId, roundId),
    };
  }

  private compareRankedEntries(a: RankedTeamEntry, b: RankedTeamEntry): number {
    if (a.finalScore === null && b.finalScore === null) return 0;
    if (a.finalScore === null) return 1;
    if (b.finalScore === null) return -1;
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    const bVotes = b.totalVotes ?? 0;
    const aVotes = a.totalVotes ?? 0;
    if (bVotes !== aVotes) return bVotes - aVotes;
    return a.submittedAt.getTime() - b.submittedAt.getTime();
  }

  private resolveAdvancingTeamIds(
    rankingsByTrack: Array<{ entries: RankedTeamEntry[] }>,
    advanceCount: number,
    isTrackSpecific: boolean,
  ): Set<number> {
    const advancing = new Set<number>();

    if (isTrackSpecific) {
      for (const { entries } of rankingsByTrack) {
        const scored = entries.filter((e) => e.finalScore !== null);
        for (const entry of scored.slice(0, advanceCount)) {
          advancing.add(entry.teamId);
        }
      }
      return advancing;
    }

    const pooled = rankingsByTrack
      .flatMap((g) => g.entries)
      .filter((e) => e.finalScore !== null)
      .sort((a, b) => this.compareRankedEntries(a, b));

    for (const entry of pooled.slice(0, advanceCount)) {
      advancing.add(entry.teamId);
    }
    return advancing;
  }

  private async loadPrizeSlots(eventId: number): Promise<
    Array<{ awardId: number; name: string }>
  > {
    const prizes = await this.prisma.eventPrize.findMany({
      where: { eventId },
      orderBy: [{ placement: "asc" }, { id: "asc" }],
      select: { id: true, name: true, quantity: true, placement: true },
    });

    // NULL placement last (Postgres ASC puts nulls last by default; Prisma may not — sort manually)
    prizes.sort((a, b) => {
      if (a.placement == null && b.placement == null) return a.id - b.id;
      if (a.placement == null) return 1;
      if (b.placement == null) return -1;
      if (a.placement !== b.placement) return a.placement - b.placement;
      return a.id - b.id;
    });

    const slots: Array<{ awardId: number; name: string }> = [];
    for (const prize of prizes) {
      const qty = Math.max(0, prize.quantity ?? 1);
      for (let i = 0; i < qty; i++) {
        slots.push({ awardId: prize.id, name: prize.name });
      }
    }
    return slots;
  }

  private resolveAutoAwards(
    rankingsByTrack: Array<{ entries: RankedTeamEntry[] }>,
    prizeSlots: Array<{ awardId: number; name: string }>,
    isTrackSpecific: boolean,
  ): Map<number, number> {
    const awardByTeamId = new Map<number, number>();
    if (prizeSlots.length === 0) return awardByTeamId;

    const assignToList = (entries: RankedTeamEntry[]) => {
      const scored = entries
        .filter((e) => e.finalScore !== null)
        .sort((a, b) => this.compareRankedEntries(a, b));
      const limit = Math.min(prizeSlots.length, scored.length);
      for (let i = 0; i < limit; i++) {
        awardByTeamId.set(scored[i].teamId, prizeSlots[i].awardId);
      }
    };

    if (isTrackSpecific) {
      for (const { entries } of rankingsByTrack) {
        assignToList(entries);
      }
    } else {
      assignToList(rankingsByTrack.flatMap((g) => g.entries));
    }

    return awardByTeamId;
  }

  private async buildTrackRanking(
    roundId: number,
    trackId: number,
  ): Promise<RankedTeamEntry[]> {
    const rubrics = await this.getApplicableCriteria(roundId, trackId);

    const submissions = await this.prisma.submission.findMany({
      where: {
        roundId,
        status: { not: SubmissionStatus.disqualified },
        team: {
          trackId,
          status: TeamStatus.approved,
        },
      },
      include: {
        team: {
          include: {
            track: true,
            award: true,
            teamRounds: {
              where: { roundId },
            },
          },
        },
        scores: true,
        judgeVotes: {
          include: {
            judge: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    const entries = submissions.map((submission) => {
      const judgeScores = submission.scores.map((score) => ({
        judgeId: score.judgeId,
        criterionId: score.criterionId,
        scoreValue: score.scoreValue,
      }));

      const judgesScored = new Set(submission.scores.map((s) => s.judgeId))
        .size;
      const finalScore = computeSubmissionFinalScore(rubrics, judgeScores);

      return {
        teamId: submission.teamId,
        teamName: submission.team.name,
        trackId: submission.team.trackId,
        trackName: submission.team.track.name,
        submissionId: submission.id,
        finalScore,
        judgesScored,
        totalVotes: submission.judgeVotes?.length ?? 0,
        votedBy: submission.judgeVotes?.map(v => ({
          id: v.judge.id,
          name: v.judge.name,
          avatarUrl: v.judge.avatarUrl
        })) ?? [],
        status:
          submission.team.teamRounds?.[0]?.status ??
          RoundResultStatus.competing,
        award: submission.team.award,
        rank: 0,
        submittedAt: submission.submittedAt,
      };
    });

    entries.sort((a, b) => {
      if (a.finalScore === null && b.finalScore === null) return 0;
      if (a.finalScore === null) return 1;
      if (b.finalScore === null) return -1;
      if (b.finalScore === a.finalScore) {
        // Tie-breaker: votes
        const bVotes = b.totalVotes ?? 0;
        const aVotes = a.totalVotes ?? 0;
        if (bVotes !== aVotes) {
          return bVotes - aVotes;
        }
        // Tie-breaker: earlier submission ranks higher
        return a.submittedAt.getTime() - b.submittedAt.getTime();
      }
      return b.finalScore - a.finalScore;
    });

    return entries.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }

  private async buildDetailedTrackRanking(roundId: number, trackId: number) {
    const rubrics = await this.getApplicableCriteria(roundId, trackId);

    const submissions = await this.prisma.submission.findMany({
      where: {
        roundId,
        status: { not: SubmissionStatus.disqualified },
        team: {
          trackId,
          status: TeamStatus.approved,
        },
      },
      include: {
        team: {
          include: {
            track: true,
            award: true,
            teamRounds: {
              where: { roundId },
            },
          },
        },
        scores: { include: { judge: true } },
        judgeVotes: {
          include: {
            judge: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    const entries = submissions.map((submission) => {
      const judgeScoresMap = new Map<number, any>();

      for (const score of submission.scores) {
        if (!judgeScoresMap.has(score.judgeId)) {
          judgeScoresMap.set(score.judgeId, {
            judgeId: score.judgeId,
            judgeName: score.judge.name,
            criteriaScores: [],
            totalGivenScore: 0,
            deviationFromAverage: 0,
            comments: [],
          });
        }

        const j = judgeScoresMap.get(score.judgeId);
        j.criteriaScores.push({
          criterionId: score.criterionId,
          scoreValue: score.scoreValue,
        });
        if (score.comment && score.comment.trim() !== "") {
          const text = score.comment.trim();
          if (!j.comments.includes(text)) {
            j.comments.push(text);
          }
        }
      }

      const validJudges = [];
      const criteriaAveragesMap = new Map<
        number,
        { sum: number; count: number }
      >();

      for (const judgeData of judgeScoresMap.values()) {
        judgeData.comment =
          judgeData.comments.length > 0
            ? judgeData.comments.join(" | ")
            : undefined;
        delete judgeData.comments;
        const jScores = judgeData.criteriaScores;
        const total = computeJudgeWeightedScore(rubrics, jScores);
        if (total !== null) {
          judgeData.totalGivenScore = total;
          validJudges.push(judgeData);

          for (const s of jScores) {
            const cv = criteriaAveragesMap.get(s.criterionId) || {
              sum: 0,
              count: 0,
            };
            cv.sum += Number(s.scoreValue);
            cv.count += 1;
            criteriaAveragesMap.set(s.criterionId, cv);
          }
        }
      }

      const finalScore = computeSubmissionFinalScore(
        rubrics,
        submission.scores.map((s) => ({
          judgeId: s.judgeId,
          criterionId: s.criterionId,
          scoreValue: s.scoreValue,
        })),
      );

      if (finalScore !== null) {
        for (const vj of validJudges) {
          vj.deviationFromAverage = Number(
            (vj.totalGivenScore - finalScore).toFixed(2),
          );
        }
      }

      const criteriaAverages = rubrics.map((r) => {
        const ag = criteriaAveragesMap.get(r.id);
        return {
          criterionId: r.id,
          name: r.name,
          maxScore: Number(r.maxScore),
          weight: Number(r.weight),
          averageScore:
            ag && ag.count > 0 ? Number((ag.sum / ag.count).toFixed(2)) : 0,
        };
      });

      return {
        teamId: submission.teamId,
        teamName: submission.team.name,
        trackId: submission.team.trackId,
        trackName: submission.team.track.name,
        submissionId: submission.id,
        finalScore,
        totalVotes: submission.judgeVotes?.length ?? 0,
        votedBy: submission.judgeVotes?.map(v => ({
          id: v.judge.id,
          name: v.judge.name,
          avatarUrl: v.judge.avatarUrl
        })) ?? [],
        criteriaAverages,
        judges: validJudges,
        status:
          submission.team.teamRounds?.[0]?.status ??
          RoundResultStatus.competing,
        award: submission.team.award,
        rank: 0,
        submittedAt: submission.submittedAt,
      };
    });

    entries.sort((a, b) => {
      if (a.finalScore === null && b.finalScore === null) return 0;
      if (a.finalScore === null) return 1;
      if (b.finalScore === null) return -1;
      if (b.finalScore === a.finalScore) {
        const bVotes = b.totalVotes ?? 0;
        const aVotes = a.totalVotes ?? 0;
        if (bVotes !== aVotes) {
          return bVotes - aVotes;
        }
        return a.submittedAt.getTime() - b.submittedAt.getTime();
      }
      return b.finalScore - a.finalScore;
    });

    return entries.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }

  private async getApplicableCriteria(roundId: number, _trackId?: number) {
    return this.prisma.criterion.findMany({
      where: { roundId, trackId: null },
      orderBy: { id: "asc" },
    });
  }

  private async assertRoundInEvent(eventId: number, roundId: number) {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
    });

    if (!round || round.eventId !== eventId) {
      throw new NotFoundException("Round not found in this event");
    }

    return round;
  }

  /**
   * Tracks to rank/publish for a round.
   * - Shared rounds or regular track-specific rounds (Flow A, "Use tracks
   *   for this event" ticked — Track is the parent spanning every round):
   *   only tracks scoped into this round (RoundTrackProblem row).
   * - Shared rounds: all event catalog tracks.
   */
  private async getRoundScopedTracks(
    eventId: number,
    round: { id: number; isTrackSpecific: boolean },
    trackIdFilter?: number,
  ) {
    if (round.isTrackSpecific) {
      const problems = await this.prisma.roundTrackProblem.findMany({
        where: {
          roundId: round.id,
          ...(trackIdFilter !== undefined && { trackId: trackIdFilter }),
        },
        select: { track: true },
        orderBy: { trackId: "asc" },
      });
      return problems.map((p) => p.track);
    }

    return this.prisma.track.findMany({
      where: {
        eventId,
        ...(trackIdFilter !== undefined && { id: trackIdFilter }),
      },
      orderBy: { id: "asc" },
    });
  }

  private async notifyRoundResults(
    eventId: number,
    roundName: string,
    summary: Array<{
      trackId: number;
      trackName: string;
      advancedTeamIds: number[];
      eliminatedTeamIds: number[];
    }>,
    isFinalRound: boolean = false,
  ) {
    if (isFinalRound) {
      const finalTeams = await this.prisma.team.findMany({
        where: { eventId, status: "approved" },
        include: {
          award: true,
          track: true,
          leader: true,
          members: { include: { user: true } },
        },
      });

      for (const team of finalTeams) {
        const trackName = team.track?.name || "General Track";
        if (team.award) {
          await this.notifyTeam(
            team,
            eventId,
            NotificationType.round_result,
            `🏆 Award Announcement: ${roundName}`,
            `🎉 Congratulations! Team "${team.name}" has won the ${team.award.name} in ${roundName}!`,
            roundName,
            trackName
          );
        } else {
          await this.notifyTeam(
            team,
            eventId,
            NotificationType.round_result,
            `✨ ${roundName} Results Published`,
            `Team "${team.name}" has completed ${roundName}. Thank you for your participation! You can review your final scores and feedback in your workspace.`,
            roundName,
            trackName
          );
        }
      }
      return;
    }

    for (const trackSummary of summary) {
      const advancedTeams = await this.prisma.team.findMany({
        where: { id: { in: trackSummary.advancedTeamIds } },
        include: {
          leader: true,
          members: { include: { user: true } },
        },
      });

      const eliminatedTeams = await this.prisma.team.findMany({
        where: { id: { in: trackSummary.eliminatedTeamIds } },
        include: {
          leader: true,
          members: { include: { user: true } },
        },
      });

      for (const team of advancedTeams) {
        await this.notifyTeam(
          team,
          eventId,
          NotificationType.round_result,
          `Advanced from ${roundName}`,
          `Congratulations! Team "${team.name}" advanced from ${roundName} in ${trackSummary.trackName}.`,
          roundName,
          trackSummary.trackName
        );
      }

      for (const team of eliminatedTeams) {
        await this.notifyTeam(
          team,
          eventId,
          NotificationType.round_result,
          `Round result: ${roundName}`,
          `Team "${team.name}" did not advance from ${roundName} in ${trackSummary.trackName}.`,
          roundName,
          trackSummary.trackName
        );
      }
    }
  }

  private async notifyTeam(
    team: {
      id: number;
      eventId: number;
      name: string;
      leader: { id: number; email: string };
      members: Array<{ user: { id: number; email: string } }>;
    },
    eventId: number,
    type: NotificationType,
    title: string,
    content: string,
    roundName: string,
    trackName: string,
  ) {
    const userIds = new Set<number>([
      team.leader.id,
      ...team.members.map((member) => member.user.id),
    ]);

    const notifications = Array.from(userIds).map((userId) => ({
      userId,
      eventId,
      type,
      title,
      content,
      isEmailSent: true,
    }));

    if (notifications.length === 0) return;

    await this.prisma.notification.createMany({ data: notifications });

    for (const notification of notifications) {
      this.eventEmitter.emit(
        `notification.user.${notification.userId}`,
        notification,
      );
    }

    const contentLower = content.toLowerCase();
    const isAdvanced = contentLower.includes('advanced') && !contentLower.includes('did not advance');
    const isAwarded = /(winner|first prize|second prize|third prize|champion|finalist)/i.test(contentLower);

    const emailsToNotify = new Set([
      team.leader.email,
      ...team.members.map((m) => m.user.email).filter(Boolean),
    ]);

    for (const email of emailsToNotify) {
      if (email) {
        this.mailService.sendRoundResultEmail(
          email,
          team.name,
          roundName,
          trackName,
          isAdvanced,
          isAwarded,
          content
        ).catch((err) => {
          this.logger.error(`Failed to send email to ${email}`, err);
        });
      }
    }
  }
}
