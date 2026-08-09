import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import {
  TeamMemberRole,
  TeamMemberStatus,
  TeamStatus,
  TeamInvitationStatus,
} from "@prisma/client";
import { RegisterIndividualDto } from "../dto/register-individual.dto";
import { RegisterTeamDto } from "../dto/register-team.dto";
import { TeamRegistrationService } from "./team-registration.service";
import { TeamInvitationService } from "./team-invitation.service";
import { TeamWorkspaceService } from "./team-workspace.service";

@Injectable()
export class TeamStudentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamRegistrationService: TeamRegistrationService,
    private readonly teamInvitationService: TeamInvitationService,
    private readonly teamWorkspaceService: TeamWorkspaceService,
  ) {}

  // ==========================================
  // 1. REGISTRATION DOMAIN (Delegated)
  // ==========================================

  async registerIndividual(
    userId: number,
    eventId: number,
    dto: RegisterIndividualDto,
  ) {
    return this.teamRegistrationService.registerIndividual(
      userId,
      eventId,
      dto,
    );
  }

  async registerTeam(userId: number, eventId: number, dto: RegisterTeamDto) {
    return this.teamRegistrationService.registerTeam(userId, eventId, dto);
  }

  async updateTeamRegistration(
    userId: number,
    eventId: number,
    dto: RegisterTeamDto,
  ) {
    return this.teamRegistrationService.updateTeamRegistration(
      userId,
      eventId,
      dto,
    );
  }

  async enqueueTeamRegistration(
    userId: number,
    eventId: number,
    dto: RegisterTeamDto,
  ) {
    return this.teamRegistrationService.enqueueTeamRegistration(
      userId,
      eventId,
      dto,
    );
  }

  async getRegistrationJobStatus(jobId: string) {
    return this.teamRegistrationService.getRegistrationJobStatus(jobId);
  }

  // ==========================================
  // 2. INVITATIONS DOMAIN (Delegated)
  // ==========================================

  async getInvitations(userId: number) {
    return this.teamInvitationService.getInvitations(userId);
  }

  async getInvitationByToken(rawToken: string) {
    return this.teamInvitationService.getInvitationByToken(rawToken);
  }

  async respondToInvitation(userId: number, teamId: number, accept: boolean) {
    return this.teamInvitationService.respondToInvitation(
      userId,
      teamId,
      accept,
    );
  }

  async respondToInvitationToken(
    userId: number,
    rawToken: string,
    accept: boolean,
  ) {
    return this.teamInvitationService.respondToInvitationToken(
      userId,
      rawToken,
      accept,
    );
  }

  async resendInvitation(
    userId: number,
    teamId: number,
    invitationId: number,
  ) {
    return this.teamInvitationService.resendInvitation(
      userId,
      teamId,
      invitationId,
    );
  }

  async cancelInvitation(userId: number, teamId: number, invitationId: number) {
    return this.teamInvitationService.cancelInvitation(
      userId,
      teamId,
      invitationId,
    );
  }

  // ==========================================
  // 3. WORKSPACE DOMAIN (Delegated)
  // ==========================================

  async getWorkspaceOverview(userId: number, eventId: number) {
    return this.teamWorkspaceService.getWorkspaceOverview(userId, eventId);
  }

  async drawMyTeamTrack(userId: number, eventId: number) {
    return this.teamWorkspaceService.drawMyTeamTrack(userId, eventId);
  }

  async getMentorFeedback(userId: number, eventId: number) {
    return this.teamWorkspaceService.getMentorFeedback(userId, eventId);
  }

  // ==========================================
  // 4. MEMBERSHIP & LIFECYCLE DOMAIN
  // ==========================================

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
            invitations: {
              where: { status: TeamInvitationStatus.pending },
              orderBy: { createdAt: "desc" },
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
      individualRegistration:
        registration && !registration.hasTeam ? registration : null,
      teamInfo: teamMember
        ? {
            role: teamMember.role,
            status: teamMember.status,
            team: teamMember.team,
          }
        : null,
    };
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
        type: "team_leadership_transfer" as any,
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
