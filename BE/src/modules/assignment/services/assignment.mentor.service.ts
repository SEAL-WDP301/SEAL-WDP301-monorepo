import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { TeamMemberStatus, RoundStatus } from "@prisma/client";

@Injectable()
export class AssignmentMentorService {
  constructor(private readonly prisma: PrismaService) {}

  async getTeams(mentorId: number, eventId?: number) {
    const teams = await this.prisma.team.findMany({
      where: {
        mentorAssignments: { some: { mentorId } },
        ...(eventId && { eventId }),
      },
      include: this.teamInclude(),
      orderBy: { createdAt: "desc" },
    });

    return teams.map((team) => this.sanitizeTeamRounds(team));
  }

  async getTeamById(mentorId: number, teamId: number) {
    const team = await this.prisma.team.findFirst({
      where: {
        id: teamId,
        mentorAssignments: { some: { mentorId } },
      },
      include: this.teamInclude(),
    });

    if (!team) {
      throw new NotFoundException("Assigned team not found");
    }

    return this.sanitizeTeamRounds(team);
  }

  private sanitizeTeamRounds<T extends { teamRounds?: Array<{ round?: { status?: string; problemFileUrl?: string | null } | null }> }>(team: T): T {
    if (!team.teamRounds) return team;
    return {
      ...team,
      teamRounds: team.teamRounds.map((tr) => ({
        ...tr,
        round: tr?.round
          ? {
              ...tr.round,
              problemFileUrl:
                tr.round.status === RoundStatus.not_started
                  ? null
                  : tr.round.problemFileUrl,
            }
          : tr?.round,
      })),
    };
  }

  async getTeamSubmissions(mentorId: number, teamId: number) {
    await this.ensureAssignedTeam(mentorId, teamId);

    return this.prisma.submission.findMany({
      where: { teamId },
      include: this.submissionInclude(mentorId),
      orderBy: { submittedAt: "desc" },
    });
  }

  async getSubmissions(mentorId: number, eventId?: number) {
    return this.prisma.submission.findMany({
      where: {
        team: {
          mentorAssignments: { some: { mentorId } },
          ...(eventId && { eventId }),
        },
      },
      include: this.submissionInclude(mentorId),
      orderBy: { submittedAt: "desc" },
    });
  }

  async getSubmissionById(mentorId: number, submissionId: number) {
    const submission = await this.prisma.submission.findFirst({
      where: {
        id: submissionId,
        team: {
          mentorAssignments: { some: { mentorId } },
        },
      },
      include: this.submissionInclude(mentorId),
    });

    if (!submission) {
      throw new NotFoundException("Assigned team submission not found");
    }

    return submission;
  }

  private async ensureAssignedTeam(mentorId: number, teamId: number) {
    const assignment = await this.prisma.mentorAssignment.findUnique({
      where: {
        mentorId_teamId: { mentorId, teamId },
      },
      select: { id: true },
    });

    if (!assignment) {
      throw new NotFoundException("Assigned team not found");
    }
  }

  private teamInclude() {
    return {
      event: true,
      track: true,
      leader: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          studentProfile: true,
        },
      },
      members: {
        where: { status: TeamMemberStatus.accepted },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              studentProfile: true,
            },
          },
        },
      },
      teamRounds: {
        include: { round: true },
      },
      _count: {
        select: { submissions: true },
      },
    };
  }

  private submissionInclude(mentorId: number) {
    return {
      team: {
        include: {
          event: true,
          track: true,
        },
      },
      round: true,
      submittedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
      mentorFeedbacks: {
        where: { mentorId },
        orderBy: { createdAt: "desc" as const },
      },
    };
  }
}
