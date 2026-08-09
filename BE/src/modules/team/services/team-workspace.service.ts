import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import {
  TeamMemberStatus,
  TeamStatus,
  RoundResultStatus,
  RoundStatus,
} from "@prisma/client";
import {
  buildFlowBSharedProblemsByTrackId,
  resolveProblemFileUrl,
} from "../../event/utils/problem-file.utils";
import { TrackAssignmentService } from "../../event/services/track-assignment.service";

@Injectable()
export class TeamWorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => TrackAssignmentService))
    private readonly trackAssignmentService: TrackAssignmentService,
  ) {}

  async getWorkspaceOverview(userId: number, eventId: number) {
    const teamMember = await this.prisma.teamMember.findFirst({
      where: {
        userId,
        status: TeamMemberStatus.accepted,
        team: {
          eventId,
          status: { notIn: [TeamStatus.rejected, TeamStatus.disqualified] },
        },
      },
      include: {
        team: {
          include: {
            event: {
              select: {
                id: true,
                name: true,
                status: true,
                deferredTrackAssignment: true,
                studentSelfTrackDraw: true,
                studentTrackDrawOpen: true,
              },
            },
            track: true,
            award: true,
          },
        },
      },
    });

    if (!teamMember) {
      throw new NotFoundException(
        "You don't have an active team for this event",
      );
    }

    const teamId = teamMember.team.id;

    // Lấy rounds của event này
    const rounds = await this.prisma.round.findMany({
      where: { eventId },
      orderBy: { roundNumber: "asc" },
      include: {
        teamRounds: {
          where: { teamId },
        },
        trackProblems: true,
      },
    });

    const now = new Date();
    const teamStatus = teamMember.team.status;

    const teamApproved = teamStatus === TeamStatus.approved;
    const isEliminated = rounds.some(
      (r) => r.teamRounds[0]?.status === "eliminated",
    );

    const submissions = await this.prisma.submission.findMany({
      where: { teamId, round: { eventId } },
      orderBy: { round: { roundNumber: "asc" } },
      include: {
        scores: {
          include: {
            criterion: {
              select: { id: true, name: true, maxScore: true, weight: true },
            },
            judge: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
      },
    });
    const submissionByRoundId = new Map(
      submissions.map((submission) => [submission.roundId, submission]),
    );

    const flowBSharedProblems = teamMember.team.event.deferredTrackAssignment
      ? buildFlowBSharedProblemsByTrackId(rounds)
      : null;

    const roundSubmissions = rounds.map((round) => {
      const teamRound = round.teamRounds[0] ?? null;
      const submission = submissionByRoundId.get(round.id) ?? null;
      const access = this.resolveRoundSubmissionAccess(
        round,
        teamRound,
        teamApproved,
        now,
      );

      return {
        round: {
          id: round.id,
          roundNumber: round.roundNumber,
          name: round.name,
          status: round.status,
          submissionType: round.submissionType,
          submissionDeadline: round.submissionDeadline,
          maxFileSizeMb: round.maxFileSizeMb,
          isTrackSpecific: round.isTrackSpecific,
          problemFileUrl: resolveProblemFileUrl(
            round,
            teamMember.team.trackId,
            flowBSharedProblems,
          ),
          trackPending:
            teamMember.team.trackId == null &&
            round.status !== RoundStatus.not_started,
        },
        teamRound: teamRound
          ? { status: teamRound.status, score: teamRound.score }
          : null,
        // Hide judge scores until results are published (competition confidentiality).
        submission: submission
          ? {
              ...submission,
              scores:
                round.status === RoundStatus.results_published
                  ? submission.scores
                  : [],
            }
          : null,
        canSubmit:
          access.canSubmit && teamMember.team.trackId != null,
        canView: access.canView,
        lockReason:
          access.canSubmit && teamMember.team.trackId == null
            ? "Đề thi chưa được công bố. Chờ BTC mở vòng để nhận đề và bắt đầu làm bài."
            : access.lockReason,
      };
    });

    const currentActiveRound =
      roundSubmissions.find((entry) => entry.canSubmit)?.round ?? null;

    let latestSubmission = null;
    if (currentActiveRound) {
      latestSubmission = await this.prisma.submission.findUnique({
        where: {
          teamId_roundId: {
            teamId,
            roundId: currentActiveRound.id,
          },
        },
        include: {
          mentorFeedbacks: {
            include: {
              mentor: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                  stakeholderProfile: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });
    }

    const mentorFeedbacks = await this.findTeamMentorFeedback(teamId);

    return {
      team: teamMember.team,
      role: teamMember.role,
      isLeader: teamMember.team.leaderId === userId,
      trackDraw: {
        studentSelfTrackDraw: Boolean(
          teamMember.team.event.studentSelfTrackDraw,
        ),
        studentTrackDrawOpen: Boolean(
          teamMember.team.event.studentTrackDrawOpen,
        ),
        canDrawTrack:
          Boolean(teamMember.team.event.studentSelfTrackDraw) &&
          Boolean(teamMember.team.event.studentTrackDrawOpen) &&
          teamMember.team.leaderId === userId &&
          teamMember.team.trackId == null &&
          teamApproved,
      },
      canSubmit: teamApproved,
      rounds,
      roundSubmissions,
      currentActiveRound,
      latestSubmission,
      mentorFeedbacks,
      isEliminated,
    };
  }

  async drawMyTeamTrack(userId: number, eventId: number) {
    const teamMember = await this.prisma.teamMember.findFirst({
      where: {
        userId,
        status: TeamMemberStatus.accepted,
        team: {
          eventId,
          status: TeamStatus.approved,
        },
      },
      select: { teamId: true },
    });
    if (!teamMember) {
      throw new NotFoundException(
        "You don't have an approved team for this event",
      );
    }

    const ceremonyRound = await this.prisma.round.findFirst({
      where: {
        eventId,
        status: RoundStatus.not_started,
        trackProblems: { some: {} },
      },
      orderBy: { roundNumber: "asc" },
      select: { id: true },
    });

    return this.trackAssignmentService.drawTrackForTeam(
      eventId,
      teamMember.teamId,
      userId,
      ceremonyRound?.id,
    );
  }

  public resolveRoundSubmissionAccess(
    round: {
      roundNumber: number;
      status: RoundStatus;
      submissionDeadline: Date | null;
    },
    teamRound: { status: RoundResultStatus } | null,
    teamApproved: boolean,
    now: Date,
  ) {
    if (!teamApproved) {
      return {
        canView: true,
        canSubmit: false,
        lockReason: "Your team must be approved before submitting",
      };
    }

    if (teamRound?.status === RoundResultStatus.eliminated) {
      return {
        canView: true,
        canSubmit: false,
        lockReason: "Your team has been eliminated from this round",
      };
    }

    if (round.roundNumber > 1 && !teamRound) {
      return {
        canView: true,
        canSubmit: false,
        lockReason: "Waiting for previous round results",
      };
    }

    if (round.status === RoundStatus.not_started) {
      return {
        canView: true,
        canSubmit: false,
        lockReason: "This round has not started yet",
      };
    }

    if (
      round.status === RoundStatus.closed ||
      round.status === RoundStatus.results_published
    ) {
      return {
        canView: true,
        canSubmit: false,
        lockReason: "Submission for this round is closed",
      };
    }

    if (round.submissionDeadline && round.submissionDeadline <= now) {
      return {
        canView: true,
        canSubmit: false,
        lockReason: "Submission deadline has passed",
      };
    }

    if (round.status !== RoundStatus.open) {
      return {
        canView: true,
        canSubmit: false,
        lockReason: "Submission for this round is not open",
      };
    }

    return {
      canView: true,
      canSubmit: true,
      lockReason: null,
    };
  }

  async getMentorFeedback(userId: number, eventId: number) {
    const teamMember = await this.prisma.teamMember.findFirst({
      where: {
        userId,
        status: TeamMemberStatus.accepted,
        team: {
          eventId,
          status: {
            notIn: [TeamStatus.rejected, TeamStatus.disqualified],
          },
        },
      },
      select: { teamId: true },
    });

    if (!teamMember) {
      throw new NotFoundException(
        "You don't have an active team for this event",
      );
    }

    return this.findTeamMentorFeedback(teamMember.teamId);
  }

  public findTeamMentorFeedback(teamId: number) {
    return this.prisma.mentorFeedback.findMany({
      where: { teamId },
      include: {
        mentor: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            stakeholderProfile: true,
          },
        },
        submission: {
          include: {
            round: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
