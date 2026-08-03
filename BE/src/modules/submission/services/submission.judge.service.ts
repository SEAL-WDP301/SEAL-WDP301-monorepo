import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { RoundStatus, SubmissionStatus, TeamStatus } from "@prisma/client";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { resolveProblemFileUrl } from "../../event/utils/problem-file.utils";
import { SubmitScoresDto } from "../dto/submit-scores.dto";
import {
  computeJudgeWeightedScore,
  isRubricWeightTotalValid,
  JUDGE_SCORE_SCALE,
  RUBRIC_WEIGHT_TOTAL,
  sumRubricWeights,
} from "../../../common/utils/scoring.util";

type ScoringStatus = "pending" | "in_review" | "completed";

@Injectable()
export class SubmissionJudgeService {
  constructor(private readonly prisma: PrismaService) {}

  async getRoundSubmissions(judgeId: number, roundId: number) {
    const assignments = await this.prisma.judgeAssignment.findMany({
      where: { judgeId, roundId },
    });

    if (assignments.length === 0) {
      throw new ForbiddenException("You are not assigned to judge this round");
    }

    const hasGlobalAssignment = assignments.some((a) => a.trackId == null);
    const assignedTrackIds = [
      ...new Set(
        assignments
          .map((a) => a.trackId)
          .filter((id): id is number => id != null),
      ),
    ];

    // Avoid per-submission DB calls — they explode DO Postgres connection slots.
    const [submissions, rubrics] = await Promise.all([
      this.prisma.submission.findMany({
        where: {
          roundId,
          status: { not: SubmissionStatus.disqualified },
          team: {
            status: TeamStatus.approved,
            ...(!hasGlobalAssignment &&
              assignedTrackIds.length > 0 && {
                trackId: { in: assignedTrackIds },
              }),
          },
        },
        include: {
          team: {
            include: {
              track: { select: { id: true, name: true } },
            },
          },
          scores: {
            where: { judgeId },
            select: { criterionId: true, scoreValue: true },
          },
          judgeVotes: {
            where: { judgeId },
            select: { id: true },
          },
        },
        orderBy: { id: "asc" },
      }),
      this.getApplicableCriteria(roundId),
    ]);

    const criteriaCount = rubrics.length;
    const anonymousLabels = this.buildAnonymousLabelMap(submissions);

    const mentoredTeamIds = await this.getMentoredTeamIds(
      judgeId,
      submissions.map((s) => s.teamId),
    );

    return submissions.map((submission) => {
      const scoredCount = submission.scores.length;
      const weightedScore = computeJudgeWeightedScore(
        rubrics,
        submission.scores,
      );
      const anonymous = anonymousLabels.get(submission.id)!;
      const mentoredByMe = mentoredTeamIds.has(submission.teamId);

      return {
        submissionId: submission.id,
        id: submission.id,
        teamName: submission.team.name,
        anonymousIndex: anonymous.index,
        track: submission.team.track,
        status: submission.status,
        submittedAt: submission.submittedAt,
        githubUrl: submission.githubUrl ?? submission.team.githubRepoUrl,
        scoringStatus: this.resolveScoringStatus(scoredCount, criteriaCount),
        scoredCriteria: scoredCount,
        totalCriteria: criteriaCount,
        weightedScore,
        isVotedByMe: submission.judgeVotes.length > 0,
        mentoredByMe,
      };
    });
  }

  async getSubmissionDetail(judgeId: number, submissionId: number) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        team: {
          include: {
            track: true,
          },
        },
        round: {
          include: {
            event: {
              select: { id: true, name: true, season: true, year: true },
            },
            trackProblems: true,
          },
        },
        judgeVotes: {
          where: { judgeId },
          select: { id: true },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException("Submission not found");
    }

    await this.assertJudgeRoundAccess(
      judgeId,
      submission.roundId,
      submission.team.trackId,
    );

    const mentoredByMe = await this.isMentoringTeam(
      judgeId,
      submission.teamId,
    );

    const rubrics = await this.getApplicableCriteria(
      submission.roundId,
      submission.team.trackId,
    );

    const myScores = await this.prisma.score.findMany({
      where: { submissionId, judgeId },
      include: { criterion: true },
      orderBy: { criterionId: "asc" },
    });

    const weightedScore = await this.computeWeightedScoreForSubmission(
      submissionId,
      judgeId,
      submission.roundId,
      submission.team.trackId,
    );

    const visibleSubmissions = await this.fetchJudgeVisibleSubmissions(
      judgeId,
      submission.roundId,
    );
    const anonymous = this.buildAnonymousLabelMap(visibleSubmissions).get(
      submissionId,
    ) ?? { label: "Team ?", index: 0 };

    return {
      id: submission.id,
      status: submission.status,
      submissionType: submission.round.submissionType,
      fileUrl: submission.fileUrl,
      githubUrl: submission.githubUrl ?? submission.team.githubRepoUrl,
      description: submission.description,
      submittedAt: submission.submittedAt,
      teamId: submission.teamId,
      team: {
        id: submission.team.id,
        name: submission.team.name,
        anonymousIndex: anonymous.index,
        track: submission.team.track,
      },
      round: {
        id: submission.round.id,
        name: submission.round.name,
        roundNumber: submission.round.roundNumber,
        status: submission.round.status,
        submissionType: submission.round.submissionType,
        submissionDeadline: submission.round.submissionDeadline,
        problemFileUrl: resolveProblemFileUrl(
          submission.round,
          submission.team.trackId,
        ),
      },
      event: submission.round.event,
      rubrics,
      myScores,
      scoringStatus: this.resolveScoringStatus(myScores.length, rubrics.length),
      weightedScore,
      isVotedByMe: submission.judgeVotes.length > 0,
      mentoredByMe,
    };
  }

  async toggleVote(judgeId: number, submissionId: number) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        team: { select: { id: true, trackId: true } },
      },
    });

    if (!submission) {
      throw new NotFoundException("Submission not found");
    }

    await this.assertJudgeRoundAccess(judgeId, submission.roundId, submission.team.trackId);
    await this.assertNotMentoringTeam(judgeId, submission.team.id);

    const rubrics = await this.getApplicableCriteria(submission.roundId, submission.team.trackId);
    const scoredCount = await this.prisma.score.count({
      where: { submissionId, judgeId },
    });

    if (scoredCount < rubrics.length || rubrics.length === 0) {
      throw new BadRequestException("You must complete scoring before voting");
    }

    const existingVote = await this.prisma.judgeVote.findUnique({
      where: {
        submissionId_judgeId: {
          submissionId,
          judgeId,
        },
      },
    });

    if (existingVote) {
      await this.prisma.judgeVote.delete({
        where: { id: existingVote.id },
      });
      return { isVotedByMe: false };
    } else {
      await this.prisma.judgeVote.create({
        data: {
          submissionId,
          judgeId,
        },
      });
      return { isVotedByMe: true };
    }
  }

  async submitScores(
    judgeId: number,
    submissionId: number,
    dto: SubmitScoresDto,
  ) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        team: { select: { id: true, trackId: true, status: true } },
        round: {
          select: { id: true, status: true, submissionDeadline: true },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException("Submission not found");
    }

    if (submission.status === SubmissionStatus.disqualified) {
      throw new BadRequestException("Cannot score a disqualified submission");
    }

    if (submission.team.status !== TeamStatus.approved) {
      throw new BadRequestException("Cannot score a team that is not approved");
    }

    await this.assertJudgeRoundAccess(
      judgeId,
      submission.roundId,
      submission.team.trackId,
    );
    await this.assertNotMentoringTeam(judgeId, submission.team.id);
    this.assertRoundAllowsScoring(submission.round);

    const rubrics = await this.getApplicableCriteria(
      submission.roundId,
      submission.team.trackId,
    );
    if (rubrics.length === 0) {
      throw new BadRequestException(
        "No scoring criteria are configured for this round",
      );
    }
    if (!isRubricWeightTotalValid(rubrics)) {
      throw new BadRequestException(
        `Criterion weights must total ${RUBRIC_WEIGHT_TOTAL}% (currently ${sumRubricWeights(rubrics).toFixed(2)}%). Ask the organizer to finish the rubric setup.`,
      );
    }
    const rubricMap = new Map(rubrics.map((r) => [r.id, r]));

    const criterionIds = new Set<number>();
    for (const item of dto.scores) {
      if (criterionIds.has(item.criterionId)) {
        throw new BadRequestException(
          `Duplicate score for criterion ${item.criterionId}`,
        );
      }
      criterionIds.add(item.criterionId);

      const rubric = rubricMap.get(item.criterionId);
      if (!rubric) {
        throw new BadRequestException(
          `Criterion ${item.criterionId} does not apply to this submission`,
        );
      }

      if (item.scoreValue > JUDGE_SCORE_SCALE) {
        throw new BadRequestException(
          `Score for "${rubric.name}" cannot exceed ${JUDGE_SCORE_SCALE}`,
        );
      }
    }

    const savedScores = await this.prisma.$transaction(
      dto.scores.map((item) =>
        this.prisma.score.upsert({
          where: {
            submissionId_judgeId_criterionId: {
              submissionId,
              judgeId,
              criterionId: item.criterionId,
            },
          },
          create: {
            submissionId,
            judgeId,
            criterionId: item.criterionId,
            scoreValue: item.scoreValue,
            comment: item.comment,
          },
          update: {
            scoreValue: item.scoreValue,
            comment: item.comment,
          },
          include: { criterion: true },
        }),
      ),
    );

    const weightedScore = await this.computeWeightedScoreForSubmission(
      submissionId,
      judgeId,
      submission.roundId,
      submission.team.trackId,
    );

    const scoredCount = await this.prisma.score.count({
      where: { submissionId, judgeId },
    });

    return {
      scores: savedScores,
      scoringStatus: this.resolveScoringStatus(scoredCount, rubrics.length),
      weightedScore,
    };
  }

  /**
   * Public guard used by AI suggest + score submit paths.
   */
  assertRoundAllowsScoring(round: {
    status: RoundStatus;
    submissionDeadline: Date | null;
  }) {
    if (round.status === RoundStatus.not_started) {
      throw new BadRequestException("This round has not started yet");
    }

    if (round.status === RoundStatus.results_published) {
      throw new BadRequestException(
        "Results have been published; scoring is locked",
      );
    }

    if (round.status === RoundStatus.closed) {
      return;
    }

    if (round.submissionDeadline && round.submissionDeadline <= new Date()) {
      return;
    }

    throw new BadRequestException(
      "Scores can be submitted after the round is closed or the submission deadline has passed",
    );
  }

  private buildAnonymousLabelMap(
    submissions: Array<{ id: number }>,
  ): Map<number, { label: string; index: number }> {
    const sorted = [...submissions].sort((a, b) => a.id - b.id);
    const map = new Map<number, { label: string; index: number }>();

    sorted.forEach((submission, index) => {
      map.set(submission.id, {
        label: `Team ${index + 1}`,
        index: index + 1,
      });
    });

    return map;
  }

  private async fetchJudgeVisibleSubmissions(judgeId: number, roundId: number) {
    const assignments = await this.prisma.judgeAssignment.findMany({
      where: { judgeId, roundId },
    });

    if (assignments.length === 0) {
      return [];
    }

    const hasGlobalAssignment = assignments.some((a) => a.trackId == null);
    const assignedTrackIds = [
      ...new Set(
        assignments
          .map((a) => a.trackId)
          .filter((id): id is number => id != null),
      ),
    ];

    return this.prisma.submission.findMany({
      where: {
        roundId,
        status: { not: SubmissionStatus.disqualified },
        team: {
          status: TeamStatus.approved,
          ...(!hasGlobalAssignment &&
            assignedTrackIds.length > 0 && {
              trackId: { in: assignedTrackIds },
            }),
        },
      },
      select: { id: true },
      orderBy: { id: "asc" },
    });
  }

  private async isMentoringTeam(
    mentorId: number,
    teamId: number,
  ): Promise<boolean> {
    const row = await this.prisma.mentorAssignment.findUnique({
      where: { mentorId_teamId: { mentorId, teamId } },
      select: { id: true },
    });
    return Boolean(row);
  }

  private async getMentoredTeamIds(
    mentorId: number,
    teamIds: number[],
  ): Promise<Set<number>> {
    if (teamIds.length === 0) return new Set();
    const rows = await this.prisma.mentorAssignment.findMany({
      where: { mentorId, teamId: { in: teamIds } },
      select: { teamId: true },
    });
    return new Set(rows.map((r) => r.teamId));
  }

  /** Judges may also be mentors, but cannot score / vote on teams they mentor. */
  async assertNotMentoringTeam(judgeId: number, teamId: number) {
    if (await this.isMentoringTeam(judgeId, teamId)) {
      throw new ForbiddenException(
        "Conflict of interest: you mentor this team and cannot score or vote on it.",
      );
    }
  }

  private async assertJudgeRoundAccess(
    judgeId: number,
    roundId: number,
    teamTrackId?: number,
  ) {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      select: { id: true, status: true },
    });

    if (!round) {
      throw new NotFoundException("Round not found");
    }

    const assignments = await this.prisma.judgeAssignment.findMany({
      where: { judgeId, roundId },
    });

    if (assignments.length === 0) {
      throw new ForbiddenException("You are not assigned to judge this round");
    }

    const hasAccess =
      teamTrackId === undefined
        ? true
        : assignments.some(
            (a) => a.trackId == null || a.trackId === teamTrackId,
          );

    if (!hasAccess) {
      throw new ForbiddenException(
        "You are not assigned to judge submissions for this track",
      );
    }

    if (teamTrackId === undefined) {
      return assignments[0];
    }

    const assignment = assignments.find(
      (a) => a.trackId == null || a.trackId === teamTrackId,
    );

    if (!assignment) {
      throw new ForbiddenException(
        "You are not assigned to judge submissions for this track",
      );
    }

    return assignment;
  }

  private async getApplicableCriteria(roundId: number, _trackId?: number) {
    // One rubric per round, shared by every track in that round.
    return this.prisma.criterion.findMany({
      where: { roundId, trackId: null },
      orderBy: { id: "asc" },
    });
  }

  private resolveScoringStatus(
    scoredCount: number,
    criteriaCount: number,
  ): ScoringStatus {
    if (criteriaCount === 0 || scoredCount === 0) return "pending";
    if (scoredCount >= criteriaCount) return "completed";
    return "in_review";
  }

  private async computeWeightedScoreForSubmission(
    submissionId: number,
    judgeId: number,
    roundId: number,
    trackId: number,
  ) {
    const rubrics = await this.getApplicableCriteria(roundId, trackId);
    const scores = await this.prisma.score.findMany({
      where: { submissionId, judgeId },
    });

    return computeJudgeWeightedScore(rubrics, scores);
  }
}
