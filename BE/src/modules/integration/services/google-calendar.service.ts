import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  EventStatus,
  NotificationType,
  Role,
  TeamMemberStatus,
  TeamStatus,
} from "@prisma/client";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "crypto";
import { google } from "googleapis";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { NotificationService } from "../../notification/services/notification.service";
import { SyncGoogleCalendarMeetingDto } from "../dto/sync-google-calendar-meeting.dto";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class GoogleCalendarService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async createAuthorizationUrl(userId: number) {
    this.assertConfigured();
    const state = randomBytes(32).toString("hex");
    await this.prisma.googleOAuthState.deleteMany({
      where: { OR: [{ userId }, { expiresAt: { lt: new Date() } }] },
    });
    await this.prisma.googleOAuthState.create({
      data: {
        id: state,
        userId,
        expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS),
      },
    });

    return {
      url: this.createOAuthClient().generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: true,
        scope: [CALENDAR_SCOPE],
        state,
      }),
    };
  }

  async handleCallback(code: string, state: string) {
    this.assertConfigured();
    const oauthState = await this.prisma.googleOAuthState.findUnique({
      where: { id: state },
    });
    if (!oauthState || oauthState.expiresAt <= new Date()) {
      throw new UnauthorizedException(
        "Google OAuth state is invalid or expired",
      );
    }

    await this.prisma.googleOAuthState.delete({ where: { id: state } });
    const oauth2 = this.createOAuthClient();
    const { tokens } = await oauth2.getToken(code);
    const existing = await this.prisma.googleCalendarConnection.findUnique({
      where: { userId: oauthState.userId },
    });
    const encryptedRefreshToken = tokens.refresh_token
      ? this.encrypt(tokens.refresh_token)
      : existing?.refreshTokenEncrypted;
    if (!encryptedRefreshToken) {
      throw new BadRequestException(
        "Google did not return a refresh token. Revoke the previous grant and connect again.",
      );
    }

    await this.prisma.googleCalendarConnection.upsert({
      where: { userId: oauthState.userId },
      create: {
        userId: oauthState.userId,
        refreshTokenEncrypted: encryptedRefreshToken,
        scope: tokens.scope ?? CALENDAR_SCOPE,
      },
      update: {
        refreshTokenEncrypted: encryptedRefreshToken,
        scope: tokens.scope ?? existing?.scope ?? CALENDAR_SCOPE,
      },
    });
  }

  async getStatus(userId: number) {
    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { userId },
      select: { updatedAt: true },
    });
    return {
      connected: Boolean(connection),
      connectedAt: connection?.updatedAt,
    };
  }

  async disconnect(userId: number) {
    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { userId },
    });
    if (!connection) return;

    try {
      await this.createOAuthClient().revokeToken(
        this.decrypt(connection.refreshTokenEncrypted),
      );
    } catch {
      // The grant may already be revoked; local disconnect must still complete.
    }
    await this.prisma.googleCalendarConnection.delete({ where: { userId } });
  }

  async syncMeeting(
    userId: number,
    eventId: number,
    dto: SyncGoogleCalendarMeetingDto,
  ) {
    const event = await this.getOwnedEvent(userId, eventId);
    if (!event.startDate || !event.endDate) {
      throw new BadRequestException(
        "Event start and end dates are required to create a calendar meeting",
      );
    }

    const calendar = await this.createCalendarClient(userId);
    const existing = event.calendarMeeting;
    const meetingStartDate = dto.meetingStartDate
      ? new Date(dto.meetingStartDate)
      : (existing?.startDate ?? event.startDate);
    const meetingEndDate = dto.meetingEndDate
      ? new Date(dto.meetingEndDate)
      : (existing?.endDate ?? event.endDate);
    if (meetingEndDate <= meetingStartDate) {
      throw new BadRequestException(
        "Meeting end time must be after meeting start time",
      );
    }
    const timeZone = dto.timeZone ?? existing?.timeZone ?? "Asia/Ho_Chi_Minh";
    const registeredStudentEmails =
      await this.getRegisteredStudentEmails(eventId);
    const attendeeEmails = [
      ...new Set(
        [...registeredStudentEmails, ...(dto.attendeeEmails ?? [])].map(
          (email) => email.trim().toLowerCase(),
        ),
      ),
    ].filter(Boolean);
    const requestBody = {
      summary: event.name,
      description: event.description ?? undefined,
      location: this.getPhysicalLocation(event.location),
      start: {
        dateTime: meetingStartDate.toISOString(),
        timeZone,
      },
      end: {
        dateTime: meetingEndDate.toISOString(),
        timeZone,
      },
      attendees: attendeeEmails.map((email) => ({ email })),
      ...(!existing && {
        conferenceData: {
          createRequest: {
            requestId: randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" as const },
          },
        },
      }),
    };
    const sendUpdates =
      dto.sendInvitations !== false && attendeeEmails.length ? "all" : "none";
    const response = existing
      ? await calendar.events.patch({
          calendarId: existing.calendarId,
          eventId: existing.googleEventId,
          conferenceDataVersion: 1,
          sendUpdates,
          requestBody,
        })
      : await calendar.events.insert({
          calendarId: "primary",
          conferenceDataVersion: 1,
          sendUpdates,
          requestBody,
        });

    if (!response.data.id) {
      throw new ServiceUnavailableException(
        "Google Calendar did not return an event ID",
      );
    }
    const meetUrl =
      response.data.hangoutLink ??
      response.data.conferenceData?.entryPoints?.find(
        (entry) => entry.entryPointType === "video",
      )?.uri ??
      existing?.meetUrl ??
      null;
    const meeting = await this.prisma.eventCalendarMeeting.upsert({
      where: { eventId },
      create: {
        eventId,
        googleEventId: response.data.id,
        calendarId: "primary",
        meetUrl,
        htmlLink: response.data.htmlLink ?? null,
        startDate: meetingStartDate,
        endDate: meetingEndDate,
        timeZone,
      },
      update: {
        googleEventId: response.data.id,
        meetUrl,
        htmlLink: response.data.htmlLink ?? null,
        startDate: meetingStartDate,
        endDate: meetingEndDate,
        timeZone,
      },
    });
    await this.updateMeetingLocation(eventId, event.location, meetUrl);

    if (
      !existing &&
      dto.notifyParticipants !== false &&
      event.status !== "draft"
    ) {
      await this.notifyStudents(eventId, event.name, event.startDate, meetUrl);
    }
    return {
      ...meeting,
      attendeeCount: attendeeEmails.length,
      registeredAttendeeCount: registeredStudentEmails.length,
    };
  }

  async deleteMeeting(userId: number, eventId: number) {
    const event = await this.getOwnedEvent(userId, eventId);
    if (!event.calendarMeeting) return;
    const calendar = await this.createCalendarClient(userId);
    await calendar.events.delete({
      calendarId: event.calendarMeeting.calendarId,
      eventId: event.calendarMeeting.googleEventId,
      sendUpdates: "all",
    });
    await this.prisma.eventCalendarMeeting.delete({ where: { eventId } });
    await this.updateMeetingLocation(eventId, event.location, null);
  }

  async getParticipantMeeting(userId: number, eventId: number) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        location: true,
        calendarMeeting: {
          select: { meetUrl: true, startDate: true, endDate: true },
        },
      },
    });
    if (!event) throw new NotFoundException("Event not found");

    const [registration, membership] = await Promise.all([
      this.prisma.studentRegistration.findUnique({
        where: { userId_eventId: { userId, eventId } },
        select: { id: true },
      }),
      this.prisma.teamMember.findFirst({
        where: {
          userId,
          status: TeamMemberStatus.accepted,
          team: {
            eventId,
            status: { in: [TeamStatus.pending, TeamStatus.approved] },
          },
        },
        select: { id: true },
      }),
    ]);

    if (!registration && !membership) {
      throw new ForbiddenException("You are not a participant in this event");
    }
    if (
      event.status !== EventStatus.active &&
      event.status !== EventStatus.ongoing
    ) {
      throw new ForbiddenException(
        "Online access is only available for active or ongoing events",
      );
    }
    const locationMeeting = this.getOnlineMeetingLocation(event.location);
    const meetUrl = event.calendarMeeting?.meetUrl ?? locationMeeting.meetUrl;
    if (!meetUrl) {
      throw new NotFoundException("Online meeting is not available");
    }

    return {
      eventId: event.id,
      platform: event.calendarMeeting?.meetUrl
        ? "Google Meet"
        : locationMeeting.platform,
      meetUrl,
      startDate: event.calendarMeeting.startDate ?? event.startDate,
      endDate: event.calendarMeeting.endDate ?? event.endDate,
    };
  }

  private async getOwnedEvent(userId: number, eventId: number) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { calendarMeeting: true },
    });
    if (!event) throw new BadRequestException("Event not found");
    if (event.createdById !== userId) {
      throw new ForbiddenException("You do not manage this event");
    }
    return event;
  }

  private async getRegisteredStudentEmails(eventId: number) {
    const registrations = await this.prisma.studentRegistration.findMany({
      where: {
        eventId,
        user: { is: { isActive: true } },
      },
      select: {
        user: { select: { email: true } },
      },
    });
    return [
      ...new Set(
        registrations.map(({ user }) => user.email.trim().toLowerCase()),
      ),
    ];
  }

  private async createCalendarClient(userId: number) {
    this.assertConfigured();
    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { userId },
    });
    if (!connection) {
      throw new BadRequestException("Connect Google Calendar first");
    }
    const auth = this.createOAuthClient();
    auth.setCredentials({
      refresh_token: this.decrypt(connection.refreshTokenEncrypted),
    });
    return google.calendar({ version: "v3", auth });
  }

  private createOAuthClient() {
    return new google.auth.OAuth2(
      this.config.get<string>("GOOGLE_CALENDAR_CLIENT_ID"),
      this.config.get<string>("GOOGLE_CALENDAR_CLIENT_SECRET"),
      this.config.get<string>("GOOGLE_CALENDAR_REDIRECT_URI"),
    );
  }

  private assertConfigured() {
    const keys = [
      "GOOGLE_CALENDAR_CLIENT_ID",
      "GOOGLE_CALENDAR_CLIENT_SECRET",
      "GOOGLE_CALENDAR_REDIRECT_URI",
      "GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY",
    ];
    if (keys.some((key) => !this.config.get<string>(key))) {
      throw new ServiceUnavailableException(
        "Google Calendar integration is not configured",
      );
    }
  }

  private encryptionKey() {
    const secret = this.config.get<string>(
      "GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY",
    );
    if (!secret || secret.length < 32) {
      throw new ServiceUnavailableException(
        "GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY must contain at least 32 characters",
      );
    }
    return createHash("sha256").update(secret).digest();
  }

  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    return [iv, cipher.getAuthTag(), encrypted]
      .map((part) => part.toString("base64"))
      .join(".");
  }

  private decrypt(value: string) {
    const [iv, tag, encrypted] = value
      .split(".")
      .map((part) => Buffer.from(part, "base64"));
    if (!iv || !tag || !encrypted) {
      throw new ServiceUnavailableException("Stored Google token is invalid");
    }
    const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  }

  private getPhysicalLocation(location: string | null) {
    if (!location) return undefined;
    try {
      const parsed = JSON.parse(location) as {
        venueName?: string;
        room?: string;
        address?: string;
      };
      return [parsed.venueName, parsed.room, parsed.address]
        .filter(Boolean)
        .join(", ");
    } catch {
      return location;
    }
  }

  private getOnlineMeetingLocation(location: string | null) {
    if (!location) return { platform: "Online Meeting", meetUrl: null };
    try {
      const parsed = JSON.parse(location) as {
        meetingPlatform?: unknown;
        meetingUrl?: unknown;
      };
      if (typeof parsed.meetingUrl !== "string") {
        return { platform: "Online Meeting", meetUrl: null };
      }
      const meetingUrl = new URL(parsed.meetingUrl);
      if (meetingUrl.protocol !== "https:" && meetingUrl.protocol !== "http:") {
        return { platform: "Online Meeting", meetUrl: null };
      }
      return {
        platform:
          typeof parsed.meetingPlatform === "string" &&
          parsed.meetingPlatform.trim()
            ? parsed.meetingPlatform.trim()
            : "Online Meeting",
        meetUrl: meetingUrl.toString(),
      };
    } catch {
      return { platform: "Online Meeting", meetUrl: null };
    }
  }

  private async updateMeetingLocation(
    eventId: number,
    location: string | null,
    meetUrl: string | null,
  ) {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = location ? JSON.parse(location) : {};
    } catch {
      parsed = { address: location };
    }
    await this.prisma.event.update({
      where: { id: eventId },
      data: {
        location: JSON.stringify({
          ...parsed,
          meetingPlatform: meetUrl ? "Google Meet" : undefined,
          meetingUrl: meetUrl ?? undefined,
        }),
      },
    });
  }

  private async notifyStudents(
    eventId: number,
    eventName: string,
    startDate: Date,
    meetUrl: string | null,
  ) {
    const students = await this.prisma.user.findMany({
      where: { role: Role.student, isActive: true },
      select: { id: true },
    });
    const when = new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(startDate);
    await this.notifications.createManyNotifications({
      userIds: students.map(({ id }) => id),
      eventId,
      type: NotificationType.event_published,
      title: `New event: ${eventName}`,
      content: `${eventName} starts ${when}.${meetUrl ? " A Google Meet link is available on the event page." : ""}`,
      actionUrl: `/home/events/${eventId}`,
    });
  }
}
