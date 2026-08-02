import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../../../database/prisma/prisma.service";
import {
  TeamMemberRole,
  TeamMemberStatus,
  TeamStatus,
  RoundResultStatus,
  RoundStatus,
  TeamInvitationStatus,
  NotificationType,
  Role,
} from "@prisma/client";
import { MailService } from "../../../core/mail/mail.service";
import { StorageService } from "../../../core/storage/storage.service";
import { RegisterIndividualDto } from "../dto/register-individual.dto";
import { RegisterTeamDto } from "../dto/register-team.dto";
import { resolveProblemFileUrl } from "../../event/utils/problem-file.utils";

@Injectable()
export class TeamStudentService {
  private readonly logger = new Logger(TeamStudentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly storageService: StorageService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  private normalizeInvitationEmails(emails: string[], leaderEmail: string) {
    const normalized = emails.map((email) => email.trim().toLowerCase());
    if (new Set(normalized).size !== normalized.length) {
      throw new BadRequestException({
        errorCode: "DUPLICATE_TEAM_MEMBER_EMAIL",
        message: "Each invited member email must be unique.",
      });
    }
    if (normalized.includes(leaderEmail.trim().toLowerCase())) {
      throw new BadRequestException({
        errorCode: "LEADER_EMAIL_CANNOT_BE_INVITED",
        message: "You cannot invite yourself to the team.",
      });
    }
    return normalized;
  }

  private createInvitation(email: string, registrationDeadline: Date | null) {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const defaultExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const expiresAt =
      registrationDeadline && registrationDeadline < defaultExpiry
        ? registrationDeadline
        : defaultExpiry;
    return { email, rawToken, tokenHash, expiresAt };
  }

  private async resolveRegistrationTrackId(
    event: { id: number; deferredTrackAssignment: boolean },
    requestedTrackId?: number | null,
  ): Promise<number | null> {
    if (event.deferredTrackAssignment) {
      // Ignore client-provided track — reveal happens when a round opens.
      return null;
    }
    if (requestedTrackId == null) {
      throw new BadRequestException(
        "Track is required for this event. Choose a track to register.",
      );
    }
    const track = await this.prisma.track.findUnique({
      where: { id: requestedTrackId },
    });
    if (!track || track.eventId !== event.id) {
      throw new NotFoundException("Track not found for this event");
    }
    return track.id;
  }

  private getInvitationUrl(rawToken: string) {
    const frontendUrl =
      this.configService.get<string>("app.frontendUrl") ||
      "http://localhost:3001";
    return `${frontendUrl}/team-invitations/${rawToken}`;
  }

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

    const trackId = await this.resolveRegistrationTrackId(event, dto.trackId);

    return this.prisma.studentRegistration.upsert({
      where: { userId_eventId: { userId, eventId } },
      update: {
        trackId,
        hasTeam: false,
        skills: dto.skills,
        reviewedById: null,
        reviewedAt: null,
        note: null,
        createdAt: new Date(),
      },
      create: {
        userId,
        eventId,
        trackId,
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

    const trackId = await this.resolveRegistrationTrackId(event, dto.trackId);
    const track = trackId
      ? await this.prisma.track.findUnique({ where: { id: trackId } })
      : null;

    const leader = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!leader) throw new NotFoundException("Team leader not found");

    const memberEmails = this.normalizeInvitationEmails(
      dto.memberEmails,
      leader.email,
    );
    const requestedTeamSize = memberEmails.length + 1;
    if (
      requestedTeamSize < event.minMembersPerTeam ||
      requestedTeamSize > event.maxMembersPerTeam
    ) {
      throw new BadRequestException({
        errorCode: "TEAM_MEMBER_LIMIT_VIOLATION",
        message: `A team must have between ${event.minMembersPerTeam} and ${event.maxMembersPerTeam} members`,
        minMembersPerTeam: event.minMembersPerTeam,
        maxMembersPerTeam: event.maxMembersPerTeam,
      });
    }

    const members = await this.prisma.user.findMany({
      where: {
        email: { in: memberEmails },
      },
    });

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

    const existingInvitations = await this.prisma.teamInvitation.findMany({
      where: {
        email: { in: memberEmails },
        status: TeamInvitationStatus.pending,
        team: {
          eventId,
          status: { notIn: [TeamStatus.rejected, TeamStatus.disqualified] },
        },
      },
    });
    if (existingInvitations.length > 0) {
      throw new ConflictException({
        errorCode: "EMAIL_ALREADY_INVITED_TO_EVENT_TEAM",
        message: `These emails already have a pending team invitation for this event: ${existingInvitations.map((invitation) => invitation.email).join(", ")}`,
      });
    }

    const invitations = memberEmails.map((email) =>
      this.createInvitation(email, event.registrationDeadline),
    );

    const resultTeam = await this.prisma.$transaction(async (prisma) => {
      await prisma.$queryRaw`
        SELECT "id"
        FROM "events"
        WHERE "id" = ${eventId}
        FOR UPDATE
      `;

      const lockedEvent = await prisma.event.findUnique({
        where: { id: eventId },
        select: {
          status: true,
          registrationDeadline: true,
          maxTeams: true,
        },
      });

      if (!lockedEvent || lockedEvent.status !== "active") {
        throw new BadRequestException("Event is not active for registration");
      }
      if (
        lockedEvent.registrationDeadline &&
        lockedEvent.registrationDeadline < new Date()
      ) {
        throw new BadRequestException("Registration deadline has passed");
      }

      const invitationConflict = await prisma.teamInvitation.findFirst({
        where: {
          email: { in: memberEmails },
          status: TeamInvitationStatus.pending,
          team: {
            eventId,
            status: { notIn: [TeamStatus.rejected, TeamStatus.disqualified] },
          },
        },
      });
      if (invitationConflict) {
        throw new ConflictException({
          errorCode: "EMAIL_ALREADY_INVITED_TO_EVENT_TEAM",
          message: `${invitationConflict.email} already has a pending team invitation for this event.`,
        });
      }

      if (lockedEvent.maxTeams !== null) {
        const occupiedTeams = await prisma.team.count({
          where: {
            eventId,
            status: {
              in: [TeamStatus.pending, TeamStatus.approved],
            },
          },
        });

        if (occupiedTeams >= lockedEvent.maxTeams) {
          throw new ConflictException({
            errorCode: "EVENT_TEAM_CAPACITY_REACHED",
            message: "Event has reached its team capacity",
            maxTeams: lockedEvent.maxTeams,
            registeredTeams: occupiedTeams,
          });
        }
      }

      const team = await prisma.team.create({
        data: {
          name: dto.teamName,
          eventId,
          trackId,
          leaderId: userId,
          status: TeamStatus.approved,
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

      if (invitations.length > 0) {
        await prisma.teamInvitation.createMany({
          data: invitations.map((invitation) => ({
            teamId: team.id,
            email: invitation.email,
            tokenHash: invitation.tokenHash,
            status: TeamInvitationStatus.pending,
            invitedById: userId,
            expiresAt: invitation.expiresAt,
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
          trackId,
          hasTeam: true,
          reviewedById: null,
          reviewedAt: null,
          note: null,
          createdAt: new Date(),
        },
        create: {
          userId,
          eventId,
          trackId,
          hasTeam: true,
        },
      });

      return team;
    });

    const trackLabel =
      track?.name ??
      (event.deferredTrackAssignment
        ? "Sẽ công bố khi mở vòng thi"
        : "TBA");

    if (invitations.length > 0) {
      Promise.all(
        invitations.map((invitation) =>
          this.mailService.sendTeamInvitationEmail({
            to: invitation.email,
            teamName: dto.teamName,
            eventName: event.name,
            trackName: trackLabel,
            leaderName: leader.name,
            invitationUrl: this.getInvitationUrl(invitation.rawToken),
            expiresAt: invitation.expiresAt,
          }),
        ),
      ).catch((err) => this.logger.error("Failed to send invitations", err));
    }

    this.eventEmitter.emit("team.registered", {
      eventId,
      teamId: resultTeam.id,
      teamName: resultTeam.name,
      trackName: trackLabel,
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
      include: {
        leader: true,
        members: { include: { user: true } },
        invitations: true,
      },
    });

    if (!team)
      throw new NotFoundException("Team not found or you are not the leader");

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event || event.status !== "active") {
      throw new BadRequestException(
        "Team roster is locked because the event is no longer in the active registration phase.",
      );
    }

    const trackId = await this.resolveRegistrationTrackId(event, dto.trackId);
    // When deferred, keep an already-revealed track (do not clear on roster edit).
    const nextTrackId =
      event.deferredTrackAssignment && team.trackId != null
        ? team.trackId
        : trackId;
    const memberEmails = this.normalizeInvitationEmails(
      dto.memberEmails,
      team.leader.email,
    );
    const requestedTeamSize = memberEmails.length + 1;
    if (
      requestedTeamSize < event.minMembersPerTeam ||
      requestedTeamSize > event.maxMembersPerTeam
    ) {
      throw new BadRequestException({
        errorCode: "TEAM_MEMBER_LIMIT_VIOLATION",
        message: `A team must have between ${event.minMembersPerTeam} and ${event.maxMembersPerTeam} members`,
        minMembersPerTeam: event.minMembersPerTeam,
        maxMembersPerTeam: event.maxMembersPerTeam,
      });
    }

    const members = await this.prisma.user.findMany({
      where: { email: { in: memberEmails } },
    });

    const currentMemberEmails = team.members
      .filter((m) => m.role === TeamMemberRole.member)
      .map((m) => m.user.email.toLowerCase());
    const currentInvitationEmails = team.invitations
      .filter(
        (invitation) => invitation.status === TeamInvitationStatus.pending,
      )
      .map((invitation) => invitation.email);
    const currentEmails = new Set([
      ...currentMemberEmails,
      ...currentInvitationEmails,
    ]);
    const emailsToAdd = memberEmails.filter(
      (email) => !currentEmails.has(email),
    );
    const emailsToRemove = [...currentEmails].filter(
      (email) => !memberEmails.includes(email),
    );

    const usersToAdd = members.filter((member) =>
      emailsToAdd.includes(member.email.toLowerCase()),
    );

    if (usersToAdd.length > 0) {
      const memberIds = usersToAdd.map((m) => m.id);
      const existingMemberships = await this.prisma.teamMember.findMany({
        where: {
          userId: { in: memberIds },
          status: { not: TeamMemberStatus.rejected },
          team: {
            eventId,
            status: { notIn: [TeamStatus.rejected, TeamStatus.disqualified] },
          },
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

    const conflictingInvitations = await this.prisma.teamInvitation.findMany({
      where: {
        email: { in: emailsToAdd },
        status: TeamInvitationStatus.pending,
        team: {
          eventId,
          id: { not: team.id },
          status: { notIn: [TeamStatus.rejected, TeamStatus.disqualified] },
        },
      },
    });
    if (conflictingInvitations.length > 0) {
      throw new ConflictException({
        errorCode: "EMAIL_ALREADY_INVITED_TO_EVENT_TEAM",
        message: `These emails already have a pending team invitation for this event: ${conflictingInvitations.map((invitation) => invitation.email).join(", ")}`,
      });
    }

    const newInvitations = emailsToAdd.map((email) =>
      this.createInvitation(email, event.registrationDeadline),
    );

    const resultTeam = await this.prisma.$transaction(async (prisma) => {
      await prisma.team.update({
        where: { id: team.id },
        data: { name: dto.teamName, trackId: nextTrackId },
      });

      await prisma.studentRegistration.update({
        where: { userId_eventId: { userId, eventId } },
        data: { trackId: nextTrackId },
      });

      if (emailsToRemove.length > 0) {
        await prisma.teamMember.deleteMany({
          where: {
            teamId: team.id,
            role: TeamMemberRole.member,
            user: { email: { in: emailsToRemove, mode: "insensitive" } },
          },
        });
        await prisma.teamInvitation.updateMany({
          where: {
            teamId: team.id,
            email: { in: emailsToRemove },
            status: TeamInvitationStatus.pending,
          },
          data: { status: TeamInvitationStatus.cancelled },
        });
      }

      for (const invitation of newInvitations) {
        await prisma.teamInvitation.upsert({
          where: {
            teamId_email: { teamId: team.id, email: invitation.email },
          },
          update: {
            tokenHash: invitation.tokenHash,
            status: TeamInvitationStatus.pending,
            invitedById: userId,
            acceptedById: null,
            expiresAt: invitation.expiresAt,
          },
          create: {
            teamId: team.id,
            email: invitation.email,
            tokenHash: invitation.tokenHash,
            status: TeamInvitationStatus.pending,
            invitedById: userId,
            expiresAt: invitation.expiresAt,
          },
        });
      }

      await prisma.team.update({
        where: { id: team.id },
        data: { status: TeamStatus.approved },
      });

      return prisma.team.findUnique({ where: { id: team.id } });
    });

    if (newInvitations.length > 0) {
      const trackForMail = nextTrackId
        ? await this.prisma.track.findUnique({ where: { id: nextTrackId } })
        : null;
      const trackLabel =
        trackForMail?.name ??
        (event.deferredTrackAssignment
          ? "Sẽ công bố khi mở vòng thi"
          : "TBA");
      Promise.all(
        newInvitations.map((invitation) =>
          this.mailService.sendTeamInvitationEmail({
            to: invitation.email,
            teamName: dto.teamName,
            eventName: event.name,
            trackName: trackLabel,
            leaderName: team.leader.name,
            invitationUrl: this.getInvitationUrl(invitation.rawToken),
            expiresAt: invitation.expiresAt,
          }),
        ),
      ).catch((err) => this.logger.error("Failed to send invitations", err));
    }

    return resultTeam;
  }

  async getInvitations(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    const [invitations, legacyInvitations] = await Promise.all([
      this.prisma.teamInvitation.findMany({
        where: {
          email: user.email.toLowerCase(),
          status: TeamInvitationStatus.pending,
          expiresAt: { gt: new Date() },
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
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.teamMember.findMany({
        where: { userId, status: TeamMemberStatus.pending },
        include: {
          team: {
            include: {
              event: true,
              track: true,
              leader: { select: { name: true, email: true } },
            },
          },
        },
      }),
    ]);
    return [...invitations, ...legacyInvitations];
  }

  async respondToInvitation(userId: number, teamId: number, accept: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    const invitation = await this.prisma.teamInvitation.findFirst({
      where: {
        teamId,
        email: user.email.toLowerCase(),
        status: TeamInvitationStatus.pending,
      },
    });
    if (!invitation)
      return this.respondToLegacyInvitation(userId, teamId, accept);
    return this.respondToStoredInvitation(userId, invitation.id, accept);
  }

  private async respondToLegacyInvitation(
    userId: number,
    teamId: number,
    accept: boolean,
  ) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      include: { team: true },
    });
    if (!membership || membership.status !== TeamMemberStatus.pending) {
      throw new BadRequestException(
        "Invitation not found or already processed",
      );
    }
    if (!accept) {
      return this.prisma.teamMember.update({
        where: { id: membership.id },
        data: { status: TeamMemberStatus.rejected },
      });
    }

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
      throw new ConflictException(
        "You are already a member of another team in this event.",
      );
    }

    return this.prisma.$transaction(async (prisma) => {
      const updated = await prisma.teamMember.update({
        where: { id: membership.id },
        data: { status: TeamMemberStatus.accepted },
      });
      await prisma.studentRegistration.upsert({
        where: {
          userId_eventId: { userId, eventId: membership.team.eventId },
        },
        create: {
          userId,
          eventId: membership.team.eventId,
          trackId: membership.team.trackId,
          hasTeam: true,
        },
        update: {
          trackId: membership.team.trackId,
          hasTeam: true,
          reviewedById: null,
          reviewedAt: null,
          note: null,
          createdAt: new Date(),
        },
      });
      return updated;
    });
  }

  async getInvitationByToken(rawToken: string) {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const invitation = await this.prisma.teamInvitation.findUnique({
      where: { tokenHash },
      include: {
        team: {
          include: {
            event: {
              select: { id: true, name: true, registrationDeadline: true },
            },
            track: { select: { id: true, name: true } },
            leader: { select: { name: true } },
          },
        },
      },
    });
    if (!invitation) throw new NotFoundException("Invitation not found");

    const status =
      invitation.status === TeamInvitationStatus.pending &&
      invitation.expiresAt <= new Date()
        ? TeamInvitationStatus.expired
        : invitation.status;
    return {
      id: invitation.id,
      email: invitation.email,
      status,
      expiresAt: invitation.expiresAt,
      team: {
        id: invitation.team.id,
        name: invitation.team.name,
        event: invitation.team.event,
        track: invitation.team.track,
        leader: invitation.team.leader,
      },
    };
  }

  async respondToInvitationToken(
    userId: number,
    rawToken: string,
    accept: boolean,
  ) {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const invitation = await this.prisma.teamInvitation.findUnique({
      where: { tokenHash },
    });
    if (!invitation) throw new NotFoundException("Invitation not found");
    return this.respondToStoredInvitation(userId, invitation.id, accept);
  }

  async resendInvitation(userId: number, teamId: number, invitationId: number) {
    const invitation = await this.prisma.teamInvitation.findFirst({
      where: {
        id: invitationId,
        teamId,
        status: TeamInvitationStatus.pending,
        team: { leaderId: userId },
      },
      include: {
        team: { include: { event: true, track: true, leader: true } },
      },
    });
    if (!invitation)
      throw new NotFoundException("Pending invitation not found");
    if (
      invitation.team.event.registrationDeadline &&
      invitation.team.event.registrationDeadline < new Date()
    ) {
      throw new BadRequestException("Team roster is locked");
    }
    if (Date.now() - invitation.updatedAt.getTime() < 60_000) {
      throw new HttpException(
        "Wait 60 seconds before resending this invitation.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const replacement = this.createInvitation(
      invitation.email,
      invitation.team.event.registrationDeadline,
    );
    const updated = await this.prisma.teamInvitation.update({
      where: { id: invitation.id },
      data: {
        tokenHash: replacement.tokenHash,
        expiresAt: replacement.expiresAt,
      },
    });
    await this.mailService.sendTeamInvitationEmail({
      to: invitation.email,
      teamName: invitation.team.name,
      eventName: invitation.team.event.name,
      trackName: invitation.team.track.name,
      leaderName: invitation.team.leader.name,
      invitationUrl: this.getInvitationUrl(replacement.rawToken),
      expiresAt: replacement.expiresAt,
    });
    return updated;
  }

  async cancelInvitation(userId: number, teamId: number, invitationId: number) {
    const invitation = await this.prisma.teamInvitation.findFirst({
      where: {
        id: invitationId,
        teamId,
        status: TeamInvitationStatus.pending,
        team: { leaderId: userId },
      },
      include: { team: { include: { event: true } } },
    });
    if (!invitation)
      throw new NotFoundException("Pending invitation not found");
    if (
      invitation.team.event.registrationDeadline &&
      invitation.team.event.registrationDeadline < new Date()
    ) {
      throw new BadRequestException("Team roster is locked");
    }
    return this.prisma.teamInvitation.update({
      where: { id: invitation.id },
      data: { status: TeamInvitationStatus.cancelled },
    });
  }

  private async respondToStoredInvitation(
    userId: number,
    invitationId: number,
    accept: boolean,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });
    if (!user) throw new NotFoundException("User not found");
    if (accept && user.role !== Role.student) {
      throw new ForbiddenException("Only student accounts can join a team.");
    }
    if (accept && !user.isActive) {
      throw new ForbiddenException(
        "Verify your email before accepting the invitation.",
      );
    }
    if (accept && !user.studentProfile) {
      throw new BadRequestException({
        errorCode: "STUDENT_PROFILE_REQUIRED",
        message:
          "Complete your student profile before accepting the invitation.",
      });
    }

    return this.prisma.$transaction(async (prisma) => {
      const invitation = await prisma.teamInvitation.findUnique({
        where: { id: invitationId },
        include: {
          team: {
            include: {
              event: true,
              members: true,
            },
          },
        },
      });
      if (!invitation || invitation.status !== TeamInvitationStatus.pending) {
        throw new BadRequestException(
          "Invitation not found or already processed",
        );
      }
      if (invitation.expiresAt <= new Date()) {
        await prisma.teamInvitation.update({
          where: { id: invitation.id },
          data: { status: TeamInvitationStatus.expired },
        });
        throw new BadRequestException("Invitation has expired");
      }
      if (invitation.email !== user.email.trim().toLowerCase()) {
        throw new ForbiddenException(
          "Sign in with the same email address that received this invitation.",
        );
      }
      if (
        invitation.team.event.registrationDeadline &&
        invitation.team.event.registrationDeadline < new Date()
      ) {
        throw new BadRequestException("Team roster is locked");
      }

      if (!accept) {
        const rejected = await prisma.teamInvitation.update({
          where: { id: invitation.id },
          data: { status: TeamInvitationStatus.rejected },
        });
        await prisma.notification.create({
          data: {
            userId: invitation.team.leaderId,
            eventId: invitation.team.eventId,
            type: NotificationType.team_invite_rejected,
            title: "Invitation Rejected",
            content: `${user.name} has rejected the invitation to join ${invitation.team.name}.`,
          },
        });
        return rejected;
      }

      await prisma.$queryRaw`
        SELECT "id" FROM "teams" WHERE "id" = ${invitation.teamId} FOR UPDATE
      `;
      const acceptedCount = await prisma.teamMember.count({
        where: {
          teamId: invitation.teamId,
          status: TeamMemberStatus.accepted,
        },
      });
      if (acceptedCount >= invitation.team.event.maxMembersPerTeam) {
        throw new ConflictException("Team has reached its member limit");
      }
      const existingAccepted = await prisma.teamMember.findFirst({
        where: {
          userId,
          status: TeamMemberStatus.accepted,
          team: {
            eventId: invitation.team.eventId,
            status: { notIn: [TeamStatus.rejected, TeamStatus.disqualified] },
          },
        },
      });
      if (existingAccepted && existingAccepted.teamId !== invitation.teamId) {
        throw new ConflictException(
          "You are already a member of another team in this event.",
        );
      }

      const membership = await prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: invitation.teamId, userId } },
        update: {
          role: TeamMemberRole.member,
          status: TeamMemberStatus.accepted,
        },
        create: {
          teamId: invitation.teamId,
          userId,
          role: TeamMemberRole.member,
          status: TeamMemberStatus.accepted,
        },
      });
      await prisma.teamInvitation.update({
        where: { id: invitation.id },
        data: {
          status: TeamInvitationStatus.accepted,
          acceptedById: userId,
        },
      });
      await prisma.teamInvitation.updateMany({
        where: {
          id: { not: invitation.id },
          email: invitation.email,
          status: TeamInvitationStatus.pending,
          team: { eventId: invitation.team.eventId },
        },
        data: { status: TeamInvitationStatus.cancelled },
      });

      await prisma.studentRegistration.upsert({
        where: {
          userId_eventId: { userId, eventId: invitation.team.eventId },
        },
        create: {
          userId,
          eventId: invitation.team.eventId,
          trackId: invitation.team.trackId,
          hasTeam: true,
        },
        update: {
          trackId: invitation.team.trackId,
          hasTeam: true,
          reviewedById: null,
          reviewedAt: null,
          note: null,
          createdAt: new Date(),
        },
      });

      const notifyMembers = invitation.team.members
        .filter((member) => member.status === TeamMemberStatus.accepted)
        .map((m) => ({
          userId: m.userId,
          eventId: invitation.team.eventId,
          type: NotificationType.team_invite_accepted,
          title: "New Team Member",
          content: `${user.name} has joined the team!`,
        }));
      notifyMembers.push({
        userId,
        eventId: invitation.team.eventId,
        type: NotificationType.team_invite_accepted,
        title: "Welcome to the Team",
        content: `You have successfully joined ${invitation.team.name}.`,
      });
      await prisma.notification.createMany({ data: notifyMembers });

      if (acceptedCount + 1 >= invitation.team.event.minMembersPerTeam) {
        await prisma.team.updateMany({
          where: {
            id: invitation.teamId,
            status: TeamStatus.pending,
          },
          data: { status: TeamStatus.approved },
        });
      }
      return membership;
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
            event: { select: { id: true, name: true, status: true } },
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
          ),
          trackPending: teamMember.team.trackId == null,
        },
        teamRound: teamRound
          ? { status: teamRound.status, score: teamRound.score }
          : null,
        submission,
        canSubmit:
          access.canSubmit && teamMember.team.trackId != null,
        canView: access.canView,
        lockReason:
          access.canSubmit && teamMember.team.trackId == null
            ? "Track chưa được công bố. Chờ admin mở vòng thi để nhận track/đề."
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
