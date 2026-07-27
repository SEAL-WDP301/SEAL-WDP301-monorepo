import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../../../database/prisma/prisma.service";
import {
  TeamMemberRole,
  TeamMemberStatus,
  TeamStatus,
  SubmissionType,
  RoundResultStatus,
  RoundStatus,
} from "@prisma/client";
import { MailService } from "../../../core/mail/mail.service";
import { StorageService } from "../../../core/storage/storage.service";
import { RegisterIndividualDto } from "../dto/register-individual.dto";
import { RegisterTeamDto } from "../dto/register-team.dto";

@Injectable()
export class TeamStudentService {
  private readonly logger = new Logger(TeamStudentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly storageService: StorageService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getMyEvents(userId: number) {
    const teams = await this.prisma.team.findMany({
      where: {
        OR: [
          { leaderId: userId },
          {
            members: {
              some: { userId, status: TeamMemberStatus.accepted },
            },
          },
        ],
        status: { in: [TeamStatus.approved, TeamStatus.pending] },
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            season: true,
            year: true,
            status: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return teams.map((team) => ({
      teamId: team.id,
      teamName: team.name,
      teamStatus: team.status,
      event: team.event,
    }));
  }

  async getRegistrationStatus(eventId: number, userId: number) {
    const registration = await this.prisma.studentRegistration.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
    });

    const teamMember = await this.prisma.teamMember.findFirst({
      where: {
        userId,
        status: TeamMemberStatus.accepted,
        team: {
          eventId,
        },
      },
      orderBy: {
        joinedAt: "desc",
      },
      include: {
        team: {
          include: {
            track: true,
            members: {
              include: {
                user: {
                  select: {
                    email: true,
                    name: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            mentorAssignments: {
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
            },
            award: true,
          },
        },
      },
    });

    return {
      individualRegistration: registration,
      teamInfo: teamMember
        ? {
            role: teamMember.role,
            status: teamMember.status,
            team: teamMember.team,
          }
        : null,
    };
  }

  async registerIndividual(
    userId: number,
    eventId: number,
    dto: RegisterIndividualDto,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event || event.status !== "active") {
      throw new BadRequestException("Event is not active for registration");
    }
    if (event.registrationDeadline && event.registrationDeadline < new Date()) {
      throw new BadRequestException("Registration deadline has passed");
    }

    return this.prisma.studentRegistration.upsert({
      where: { userId_eventId: { userId, eventId } },
      update: {
        trackId: dto.trackId,
        hasTeam: false,
        skills: dto.skills,
      },
      create: {
        userId,
        eventId,
        trackId: dto.trackId,
        hasTeam: false,
        skills: dto.skills,
      },
    });
  }

  async registerTeam(userId: number, eventId: number, dto: RegisterTeamDto) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event || event.status !== "active") {
      throw new BadRequestException("Event is not active for registration");
    }
    if (event.registrationDeadline && event.registrationDeadline < new Date()) {
      throw new BadRequestException("Registration deadline has passed");
    }

    const track = await this.prisma.track.findUnique({
      where: { id: dto.trackId },
    });
    if (!track || track.eventId !== eventId) {
      throw new NotFoundException("Track not found for this event");
    }

    const maxMembers = track.maxMembersPerTeam || 4;
    if (dto.memberEmails.length + 1 > maxMembers) {
      throw new BadRequestException(`Maximum members allowed is ${maxMembers}`);
    }

    const members = await this.prisma.user.findMany({
      where: {
        email: { in: dto.memberEmails },
      },
    });

    if (members.length !== dto.memberEmails.length) {
      const foundEmails = members.map((m) => m.email);
      const missingEmails = dto.memberEmails.filter(
        (e) => !foundEmails.includes(e),
      );
      throw new BadRequestException(
        `These emails are not registered in the system: ${missingEmails.join(", ")}`,
      );
    }

    if (members.some((m) => m.id === userId)) {
      throw new BadRequestException("You cannot invite yourself to the team.");
    }

    const memberIds = members.map((m) => m.id);
    const existingMemberships = await this.prisma.teamMember.findMany({
      where: {
        userId: { in: [...memberIds, userId] },
        status: { not: TeamMemberStatus.rejected },
        team: {
          eventId,
          status: {
            notIn: [TeamStatus.rejected, TeamStatus.disqualified],
          },
        },
      },
      include: { user: true },
    });

    if (existingMemberships.length > 0) {
      const conflictingUsers = existingMemberships.map((m) => m.user.email);
      throw new BadRequestException(
        `These users are already in a team for this event: ${conflictingUsers.join(", ")}`,
      );
    }

    const resultTeam = await this.prisma.$transaction(async (prisma) => {
      const team = await prisma.team.create({
        data: {
          name: dto.teamName,
          eventId,
          trackId: dto.trackId,
          leaderId: userId,
          status: TeamStatus.pending,
        },
      });

      // Auto-assign to Round 1 if it exists
      const round1 = await prisma.round.findFirst({
        where: {
          eventId,
          roundNumber: 1,
        },
      });

      if (round1) {
        await prisma.teamRound.create({
          data: {
            teamId: team.id,
            roundId: round1.id,
          },
        });
      }

      await prisma.teamMember.create({
        data: {
          teamId: team.id,
          userId,
          role: TeamMemberRole.leader,
          status: TeamMemberStatus.accepted,
        },
      });

      if (members.length > 0) {
        await prisma.teamMember.createMany({
          data: members.map((member) => ({
            teamId: team.id,
            userId: member.id,
            role: TeamMemberRole.member,
            status: TeamMemberStatus.pending,
          })),
        });
      }

      await prisma.studentRegistration.upsert({
        where: {
          userId_eventId: {
            userId,
            eventId,
          },
        },
        update: {
          trackId: dto.trackId,
          hasTeam: true,
        },
        create: {
          userId,
          eventId,
          trackId: dto.trackId,
          hasTeam: true,
        },
      });

      return team;
    });

    if (members.length > 0) {
      const leader = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
      });

      Promise.all(
        members.map((member) =>
          this.mailService.sendTeamInvitationEmail(
            member.email,
            dto.teamName,
            event?.name || "Sự kiện",
            track.name,
            leader?.name || "Một người bạn",
          ),
        ),
      ).catch((err) => this.logger.error("Failed to send invitations", err));
    }

    this.eventEmitter.emit("team.registered", {
      eventId,
      teamId: resultTeam.id,
      teamName: resultTeam.name,
      trackName: track.name,
      timestamp: new Date(),
    });

    return resultTeam;
  }

  async updateTeamRegistration(
    userId: number,
    eventId: number,
    dto: RegisterTeamDto,
  ) {
    const team = await this.prisma.team.findFirst({
      where: { eventId, leaderId: userId },
      include: { members: { include: { user: true } } },
    });

    if (!team)
      throw new NotFoundException("Team not found or you are not the leader");

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (event?.status !== "active") {
      throw new BadRequestException(
        "Team roster is locked because the event is no longer in the active registration phase.",
      );
    }

    const track = await this.prisma.track.findUnique({
      where: { id: dto.trackId },
    });
    if (!track || track.eventId !== eventId)
      throw new NotFoundException("Track not found");
    const maxMembers = track.maxMembersPerTeam || 4;
    if (dto.memberEmails.length + 1 > maxMembers)
      throw new BadRequestException(`Max members allowed is ${maxMembers}`);

    const members = await this.prisma.user.findMany({
      where: { email: { in: dto.memberEmails } },
    });
    if (members.length !== dto.memberEmails.length) {
      const foundEmails = members.map((m) => m.email);
      const missingEmails = dto.memberEmails.filter(
        (e) => !foundEmails.includes(e),
      );
      throw new BadRequestException(
        `These emails are not registered: ${missingEmails.join(", ")}`,
      );
    }

    if (members.some((m) => m.id === userId)) {
      throw new BadRequestException("You cannot invite yourself to the team.");
    }

    const currentMemberEmails = team.members
      .filter((m) => m.role === TeamMemberRole.member)
      .map((m) => m.user.email);
    const emailsToAdd = dto.memberEmails.filter(
      (e) => !currentMemberEmails.includes(e),
    );
    const emailsToRemove = currentMemberEmails.filter(
      (e) => !dto.memberEmails.includes(e),
    );

    const usersToAdd = members.filter((m) => emailsToAdd.includes(m.email));

    if (usersToAdd.length > 0) {
      const memberIds = usersToAdd.map((m) => m.id);
      const existingMemberships = await this.prisma.teamMember.findMany({
        where: { 
          userId: { in: memberIds }, 
          status: { not: TeamMemberStatus.rejected },
          team: { 
            eventId,
            status: { notIn: [TeamStatus.rejected, TeamStatus.disqualified] }
          } 
        },
        include: { user: true },
      });
      if (existingMemberships.length > 0) {
        const conflictingUsers = existingMemberships.map((m) => m.user.email);
        throw new BadRequestException(
          `These users are already in a team: ${conflictingUsers.join(", ")}`,
        );
      }
    }

    const resultTeam = await this.prisma.$transaction(async (prisma) => {
      await prisma.team.update({
        where: { id: team.id },
        data: { name: dto.teamName, trackId: dto.trackId },
      });

      await prisma.studentRegistration.update({
        where: { userId_eventId: { userId, eventId } },
        data: { trackId: dto.trackId },
      });

      if (emailsToRemove.length > 0) {
        const usersToRemove = team.members.filter((m) =>
          emailsToRemove.includes(m.user.email),
        );
        await prisma.teamMember.deleteMany({
          where: { id: { in: usersToRemove.map((m) => m.id) } },
        });
      }

      if (usersToAdd.length > 0) {
        await prisma.teamMember.createMany({
          data: usersToAdd.map((member) => ({
            teamId: team.id,
            userId: member.id,
            role: TeamMemberRole.member,
            status: TeamMemberStatus.pending,
          })),
        });
      }

      return prisma.team.findUnique({ where: { id: team.id } });
    });

    if (usersToAdd.length > 0) {
      const leader = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
      });

      Promise.all(
        usersToAdd.map((member) =>
          this.mailService.sendTeamInvitationEmail(
            member.email,
            dto.teamName,
            event?.name || "Sự kiện",
            track.name,
            leader?.name || "Một người bạn",
          ),
        ),
      ).catch((err) => this.logger.error("Failed to send invitations", err));
    }

    return resultTeam;
  }

  async getInvitations(userId: number) {
    return this.prisma.teamMember.findMany({
      where: {
        userId,
        status: TeamMemberStatus.pending,
      },
      include: {
        team: {
          include: {
            event: true,
            track: true,
            leader: { select: { name: true, email: true } },
          },
        },
      },
    });
  }

  async respondToInvitation(userId: number, teamId: number, accept: boolean) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      include: {
        team: { include: { members: { include: { user: true } } } },
        user: true,
      },
    });

    if (!membership || membership.status !== TeamMemberStatus.pending) {
      throw new BadRequestException(
        "Invitation not found or already processed",
      );
    }

    if (accept) {
      const existingAccepted = await this.prisma.teamMember.findFirst({
        where: {
          userId,
          status: TeamMemberStatus.accepted,
          team: {
            eventId: membership.team.eventId,
            status: { notIn: [TeamStatus.rejected, TeamStatus.disqualified] },
          },
        },
      });

      if (existingAccepted) {
        throw new BadRequestException(
          "You are already a member of another team in this event.",
        );
      }
    }

    return this.prisma.$transaction(async (prisma) => {
      if (!accept) {
        const rejected = await prisma.teamMember.update({
          where: { id: membership.id },
          data: { status: TeamMemberStatus.rejected },
        });

        // Notify team leader or entire team
        await prisma.notification.create({
          data: {
            userId:
              membership.team.members.find(
                (m) => m.role === TeamMemberRole.leader,
              )?.userId || membership.team.members[0].userId,
            eventId: membership.team.eventId,
            type: "team_invite_rejected" as any,
            title: "Invitation Rejected",
            content: `${membership.user.name} has rejected the invitation to join ${membership.team.name}.`,
          },
        });

        return rejected;
      }

      // If accepted
      const updated = await prisma.teamMember.update({
        where: { id: membership.id },
        data: { status: TeamMemberStatus.accepted },
      });

      await prisma.teamMember.updateMany({
        where: {
          userId,
          status: TeamMemberStatus.pending,
          id: { not: membership.id },
          team: { eventId: membership.team.eventId },
        },
        data: { status: TeamMemberStatus.rejected },
      });

      await prisma.studentRegistration.upsert({
        where: { userId_eventId: { userId, eventId: membership.team.eventId } },
        create: {
          userId,
          eventId: membership.team.eventId,
          trackId: membership.team.trackId,
          hasTeam: true,
        },
        update: {
          hasTeam: true,
        },
      });

      // Send Notification to existing members
      const notifyMembers = membership.team.members
        .filter((m) => m.status === TeamMemberStatus.accepted)
        .map((m) => ({
          userId: m.userId,
          eventId: membership.team.eventId,
          type: "team_invite_accepted" as any,
          title: "New Team Member",
          content: `${membership.user.name} has joined the team!`,
        }));

      // Send Welcome Notification to the user who accepted
      notifyMembers.push({
        userId,
        eventId: membership.team.eventId,
        type: "team_invite_accepted" as any,
        title: "Welcome to the Team",
        content: `You have successfully joined ${membership.team.name}.`,
      });

      if (notifyMembers.length > 0) {
        await prisma.notification.createMany({
          data: notifyMembers,
        });
      }

      return updated;
    });
  }

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
            event: { select: { id: true, name: true } },
            track: true,
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
          problemFileUrl:
            round.status === RoundStatus.not_started
              ? null
              : round.problemFileUrl,
        },
        teamRound: teamRound
          ? { status: teamRound.status, score: teamRound.score }
          : null,
        submission,
        canSubmit: access.canSubmit,
        canView: access.canView,
        lockReason: access.lockReason,
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
      canSubmit: teamApproved,
      rounds,
      roundSubmissions,
      currentActiveRound,
      latestSubmission,
      mentorFeedbacks,
      isEliminated,
    };
  }

  private resolveRoundSubmissionAccess(
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

  private findTeamMentorFeedback(teamId: number) {
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

  async transferLeadership(
    userId: number,
    teamId: number,
    newLeaderUserId: number,
  ) {
    const currentMembership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      include: {
        team: { include: { members: { include: { user: true } } } },
        user: true,
      },
    });

    if (
      !currentMembership ||
      currentMembership.role !== TeamMemberRole.leader
    ) {
      throw new ForbiddenException(
        "Only the team leader can transfer leadership.",
      );
    }

    const newLeaderMembership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: newLeaderUserId } },
      include: { user: true },
    });

    if (
      !newLeaderMembership ||
      newLeaderMembership.status !== TeamMemberStatus.accepted
    ) {
      throw new BadRequestException(
        "The designated new leader must be an accepted team member.",
      );
    }

    return this.prisma.$transaction(async (prisma) => {
      // 1. Demote current leader
      await prisma.teamMember.update({
        where: { id: currentMembership.id },
        data: { role: TeamMemberRole.member },
      });

      // 2. Promote new leader
      const updatedNewLeader = await prisma.teamMember.update({
        where: { id: newLeaderMembership.id },
        data: { role: TeamMemberRole.leader },
      });

      // 3. Update team.leaderId
      await prisma.team.update({
        where: { id: teamId },
        data: { leaderId: newLeaderUserId },
      });

      // 4. Create notifications for all team members
      const notifications = currentMembership.team.members.map((member) => ({
        userId: member.userId,
        eventId: currentMembership.team.eventId,
        type: "team_leadership_transfer" as any, // Using the new enum
        title: "Team Leadership Transferred",
        content: `${currentMembership.user.name} has transferred team leadership to ${newLeaderMembership.user.name}.`,
      }));

      await prisma.notification.createMany({
        data: notifications,
      });

      return updatedNewLeader;
    });
  }
}
