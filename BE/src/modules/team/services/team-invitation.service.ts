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
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../../../database/prisma/prisma.service";
import {
  TeamMemberRole,
  TeamMemberStatus,
  TeamStatus,
  TeamInvitationStatus,
  NotificationType,
  Role,
} from "@prisma/client";
import { MailService } from "../../../core/mail/mail.service";
import { RedisService } from "../../../core/redis/redis.service";

@Injectable()
export class TeamInvitationService {
  private readonly logger = new Logger(TeamInvitationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  public createInvitation(email: string, registrationDeadline: Date | null) {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const defaultExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const expiresAt =
      registrationDeadline && registrationDeadline < defaultExpiry
        ? registrationDeadline
        : defaultExpiry;
    return { email, rawToken, tokenHash, expiresAt };
  }

  public getInvitationUrl(rawToken: string): string {
    const frontendUrl =
      this.configService.get<string>("app.frontendUrl") ||
      "http://localhost:3001";
    return `${frontendUrl}/team-invitations/${rawToken}`;
  }

  public async checkInviteRateLimits(
    userId: number,
    teamId: number,
    email: string,
  ): Promise<void> {
    try {
      // 1. Cooldown 60s check per team/email
      const cooldownKey = `cooldown:invite:${teamId}:${email.toLowerCase()}`;
      const isCoolingDown = await this.redisService.exists(cooldownKey);
      if (isCoolingDown) {
        throw new HttpException(
          "Please wait 60 seconds before requesting another invitation email.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // 2. Daily limit check: max 10 invitation emails per day per user
      const dailyKey = `rate_limit:daily_invites:${userId}`;
      const currentDailyCount = await this.redisService.get(dailyKey);
      if (currentDailyCount && parseInt(currentDailyCount, 10) >= 10) {
        throw new HttpException(
          "Daily invitation limit reached (10 emails/day). Please try again tomorrow.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.warn(
        `Redis rate limit check failed, bypassing: ${error.message}`,
      );
    }
  }

  public async recordInviteSent(
    userId: number,
    teamId: number,
    email: string,
  ): Promise<void> {
    try {
      const cooldownKey = `cooldown:invite:${teamId}:${email.toLowerCase()}`;
      await this.redisService.set(cooldownKey, "1", 60);

      const dailyKey = `rate_limit:daily_invites:${userId}`;
      const count = await this.redisService.incr(dailyKey);
      if (count === 1) {
        await this.redisService.set(dailyKey, "1", 86400);
      }
    } catch (error) {
      this.logger.warn(`Redis recordInviteSent failed: ${error.message}`);
    }
  }

  public async cacheInvitationToken(
    tokenHash: string,
    data: any,
  ): Promise<void> {
    try {
      const key = `invitation:token:${tokenHash}`;
      await this.redisService.set(key, JSON.stringify(data), 900); // TTL 15 minutes
    } catch (error) {
      this.logger.warn(`Redis cacheInvitationToken failed: ${error.message}`);
    }
  }

  public async invalidateInvitationToken(tokenHash?: string): Promise<void> {
    if (!tokenHash) return;
    try {
      const key = `invitation:token:${tokenHash}`;
      await this.redisService.del(key);
    } catch (error) {
      this.logger.warn(
        `Redis invalidateInvitationToken failed: ${error.message}`,
      );
    }
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

  async getInvitationByToken(rawToken: string) {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    try {
      const cached = await this.redisService.get(
        `invitation:token:${tokenHash}`,
      );
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err: any) {
      this.logger.warn(`Redis token cache lookup failed: ${err.message}`);
    }

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

    const result = {
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

    await this.cacheInvitationToken(tokenHash, result);
    return result;
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

    if (!invitation) {
      return this.respondToLegacyInvitation(userId, teamId, accept);
    }
    return this.respondToStoredInvitation(userId, invitation.id, accept);
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

  async resendInvitation(
    userId: number,
    teamId: number,
    invitationId: number,
  ) {
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
    if (!invitation) {
      throw new NotFoundException("Pending invitation not found");
    }
    if (
      invitation.team.event.registrationDeadline &&
      invitation.team.event.registrationDeadline < new Date()
    ) {
      throw new BadRequestException("Team roster is locked");
    }

    await this.checkInviteRateLimits(userId, teamId, invitation.email);
    await this.invalidateInvitationToken(invitation.tokenHash);

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

    await this.recordInviteSent(userId, teamId, invitation.email);

    const trackLabel =
      invitation.team.track?.name ??
      (invitation.team.event.deferredTrackAssignment
        ? "Sẽ công bố khi mở vòng thi"
        : "TBA");

    await this.mailService.sendTeamInvitationEmail({
      to: invitation.email,
      teamName: invitation.team.name,
      eventName: invitation.team.event.name,
      trackName: trackLabel,
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
    if (!invitation) {
      throw new NotFoundException("Pending invitation not found");
    }
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

  public async respondToStoredInvitation(
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

    const event = await this.prisma.event.findUnique({
      where: { id: membership.team.eventId },
      select: { minMembersPerTeam: true },
    });
    if (!event) throw new NotFoundException("Event not found");

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

      const acceptedCount = await prisma.teamMember.count({
        where: {
          teamId,
          status: TeamMemberStatus.accepted,
        },
      });
      if (acceptedCount >= event.minMembersPerTeam) {
        await prisma.team.updateMany({
          where: {
            id: teamId,
            status: TeamStatus.pending,
          },
          data: { status: TeamStatus.approved },
        });
      }

      return updated;
    });
  }
}
