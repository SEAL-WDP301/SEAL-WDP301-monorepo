import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
  forwardRef,
  Optional,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../../../database/prisma/prisma.service";
import {
  TeamMemberRole,
  TeamMemberStatus,
  TeamStatus,
  TeamInvitationStatus,
} from "@prisma/client";
import { MailService } from "../../../core/mail/mail.service";
import { RegisterIndividualDto } from "../dto/register-individual.dto";
import { RegisterTeamDto } from "../dto/register-team.dto";
import { TeamInvitationService } from "./team-invitation.service";

@Injectable()
export class TeamRegistrationService {
  private readonly logger = new Logger(TeamRegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly eventEmitter: EventEmitter2,
    private readonly teamInvitationService: TeamInvitationService,
    @Optional()
    @InjectQueue("team-registration")
    private readonly registrationQueue?: Queue,
  ) {}

  public normalizeInvitationEmails(emails: string[], leaderEmail: string) {
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

  public resolveAutoApprovalStatus(
    acceptedMemberCount: number,
    minMembersPerTeam: number,
  ): TeamStatus {
    return acceptedMemberCount >= minMembersPerTeam
      ? TeamStatus.approved
      : TeamStatus.pending;
  }

  public async resolveRegistrationTrackId(
    event: { id: number; deferredTrackAssignment: boolean },
    requestedTrackId?: number | null,
  ): Promise<number | null> {
    if (event.deferredTrackAssignment) {
      return null;
    }

    const trackCount = await this.prisma.track.count({
      where: { eventId: event.id },
    });
    if (trackCount === 0) {
      throw new BadRequestException(
        "This event has no tracks yet. Registration is unavailable until the organizer adds tracks.",
      );
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
      this.teamInvitationService.createInvitation(
        email,
        event.registrationDeadline,
      ),
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

      const initialStatus = this.resolveAutoApprovalStatus(
        1,
        event.minMembersPerTeam,
      );

      const team = await prisma.team.create({
        data: {
          name: dto.teamName,
          eventId,
          trackId,
          leaderId: userId,
          status: initialStatus,
        },
      });

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
            invitationUrl: this.teamInvitationService.getInvitationUrl(
              invitation.rawToken,
            ),
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

    if (!team) {
      throw new NotFoundException("Team not found or you are not the leader");
    }

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event || event.status !== "active") {
      throw new BadRequestException(
        "Team roster is locked because the event is no longer in the active registration phase.",
      );
    }

    const trackId = await this.resolveRegistrationTrackId(event, dto.trackId);
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
      this.teamInvitationService.createInvitation(
        email,
        event.registrationDeadline,
      ),
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

      const acceptedCount = await prisma.teamMember.count({
        where: {
          teamId: team.id,
          status: TeamMemberStatus.accepted,
        },
      });

      await prisma.team.update({
        where: { id: team.id },
        data: {
          status: this.resolveAutoApprovalStatus(
            acceptedCount,
            event.minMembersPerTeam,
          ),
        },
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
        newInvitations.map((invitation) => {
          this.teamInvitationService.recordInviteSent(
            userId,
            team.id,
            invitation.email,
          );
          return this.mailService.sendTeamInvitationEmail({
            to: invitation.email,
            teamName: dto.teamName,
            eventName: event.name,
            trackName: trackLabel,
            leaderName: team.leader.name,
            invitationUrl: this.teamInvitationService.getInvitationUrl(
              invitation.rawToken,
            ),
            expiresAt: invitation.expiresAt,
          });
        }),
      ).catch((err) => this.logger.error("Failed to send invitations", err));
    }

    return resultTeam;
  }

  async enqueueTeamRegistration(
    userId: number,
    eventId: number,
    dto: RegisterTeamDto,
  ) {
    if (!this.registrationQueue) {
      const team = await this.registerTeam(userId, eventId, dto);
      return {
        status: "COMPLETED",
        teamId: team.id,
        teamName: team.name,
        message: "Registration completed synchronously",
      };
    }

    const job = await this.registrationQueue.add(
      "process-team-registration",
      {
        userId,
        eventId,
        dto,
      },
      {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );

    return {
      status: "QUEUED",
      jobId: job.id,
      message: "Yêu cầu đăng ký đội đã được đưa vào hàng đợi xử lý tuần tự.",
    };
  }

  async getRegistrationJobStatus(jobId: string) {
    if (!this.registrationQueue) {
      return { status: "COMPLETED", message: "Queue not enabled" };
    }

    const job = await this.registrationQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Registration job ${jobId} not found`);
    }

    const state = await job.getState();
    return {
      jobId: job.id,
      state,
      progress: job.progress,
      result: job.returnvalue,
      failedReason: job.failedReason,
    };
  }
}
