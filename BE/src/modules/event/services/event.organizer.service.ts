import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { CreateEventDto } from "../dto/create-event.dto";
import { UpdateEventDto } from "../dto/update-event.dto";
import { EventStatus, Prisma, RoundStatus } from "@prisma/client";
import { TeamGithubService } from "../../team/services/team-github.service";

import { RoundAutomationSchedulerService } from "../../round/services/round-automation-scheduler.service";

@Injectable()
export class EventOrganizerService {
  private readonly logger = new Logger(EventOrganizerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly teamGithubService: TeamGithubService,
    private readonly roundAutomationSchedulerService: RoundAutomationSchedulerService,
  ) {}

  async createEvent(userId: number, dto: CreateEventDto) {
    const { tracks, rounds, prizes, ...eventData } = dto;
    const { faq, ...restEventData } = eventData;

    const data: Prisma.EventCreateInput = {
      ...restEventData,
      ...(faq !== undefined && {
        faq: faq as unknown as Prisma.InputJsonValue,
      }),
      createdBy: {
        connect: { id: userId },
      },
      tracks: {
        create: tracks,
      },
      rounds: {
        create: rounds,
      },
      prizes: prizes
        ? {
            create: prizes,
          }
        : undefined,
    };

    return this.prisma.event.create({
      data,
      include: {
        tracks: true,
        rounds: true,
        prizes: true,
      },
    });
  }

  async getAllEvents(userId: number, includeAll = false) {
    return this.prisma.event.findMany({
      where: includeAll ? undefined : { createdById: userId },
      include: {
        tracks: true,
        prizes: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getEventById(id: number) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        tracks: {
          include: { _count: { select: { teams: true } } },
        },
        rounds: {
          include: { _count: { select: { submissions: true } } },
        },
        prizes: true,
        calendarMeeting: true,
        _count: {
          select: {
            teams: true,
          },
        },
      },
    });
    if (!event) throw new NotFoundException("Event not found");

    const submissionCount = await this.prisma.submission.count({
      where: {
        round: {
          eventId: id,
        },
      },
    });

    return {
      ...event,
      _count: {
        teams: event._count?.teams ?? 0,
        submissions: submissionCount,
      },
    };
  }

  async getManagedEventById(id: number, userId: number, includeAll = false) {
    const event = await this.getEventById(id);
    if (!includeAll && event.createdById !== userId) {
      throw new ForbiddenException("You do not manage this event");
    }
    return event;
  }

  async updateEvent(id: number, dto: UpdateEventDto) {
    const event = await this.getEventById(id); // Check existence

    if (event.status !== EventStatus.draft) {
      throw new BadRequestException(
        "Only draft events can be edited. Please change the status to draft first.",
      );
    }

    const { tracks, rounds, prizes, ...eventData } = dto;
    const { faq, ...restEventData } = eventData;

    const tracksUpdate = tracks
      ? {
          deleteMany: {
            id: { notIn: tracks.filter((t) => t.id).map((t) => t.id!) },
          },
          create: tracks
            .filter((t) => !t.id)
            .map((t) => ({
              name: t.name,
              description: t.description,
              maxTeams: t.maxTeams,
              maxMembersPerTeam: t.maxMembersPerTeam,
            })),
          update: tracks
            .filter((t) => t.id)
            .map((t) => ({
              where: { id: t.id },
              data: {
                name: t.name,
                description: t.description,
                maxTeams: t.maxTeams,
                maxMembersPerTeam: t.maxMembersPerTeam,
              },
            })),
        }
      : undefined;

    const roundsUpdate = rounds
      ? {
          deleteMany: {
            id: { notIn: rounds.filter((r) => r.id).map((r) => r.id!) },
          },
          create: rounds
            .filter((r) => !r.id)
            .map((r) => ({
              roundNumber: r.roundNumber,
              name: r.name,
              submissionType: r.submissionType,
              submissionDeadline: r.submissionDeadline,
              maxFileSizeMb: r.maxFileSizeMb,
              isTrackSpecific: r.isTrackSpecific,
            })),
          update: rounds
            .filter((r) => r.id)
            .map((r) => ({
              where: { id: r.id },
              data: {
                roundNumber: r.roundNumber,
                name: r.name,
                submissionType: r.submissionType,
                submissionDeadline: r.submissionDeadline,
                maxFileSizeMb: r.maxFileSizeMb,
                isTrackSpecific: r.isTrackSpecific,
              },
            })),
        }
      : undefined;

    const prizesUpdate = prizes
      ? {
          deleteMany: {
            id: { notIn: prizes.filter((p) => p.id).map((p) => p.id!) },
          },
          create: prizes
            .filter((p) => !p.id)
            .map((p) => ({
              name: p.name,
              description: p.description,
              quantity: p.quantity,
            })),
          update: prizes
            .filter((p) => p.id)
            .map((p) => ({
              where: { id: p.id },
              data: {
                name: p.name,
                description: p.description,
                quantity: p.quantity,
              },
            })),
        }
      : undefined;

    const data: Prisma.EventUpdateInput = {
      ...restEventData,
      ...(faq !== undefined && {
        faq: faq as unknown as Prisma.InputJsonValue,
      }),
      tracks: tracksUpdate,
      rounds: roundsUpdate,
      prizes: prizesUpdate,
    };

    const updatedEvent = await this.prisma.event.update({
      where: { id },
      data,
      include: {
        tracks: true,
        rounds: true,
        prizes: true,
      },
    });

    // Auto-assign teams to Round 1 if it exists
    const round1 = updatedEvent.rounds.find((r) => r.roundNumber === 1);
    if (round1) {
      // Find all teams for this event that are not yet in round1
      const teams = await this.prisma.team.findMany({
        where: {
          eventId: id,
          teamRounds: {
            none: { roundId: round1.id },
          },
        },
      });
      if (teams.length > 0) {
        await this.prisma.teamRound.createMany({
          data: teams.map((t) => ({
            teamId: t.id,
            roundId: round1.id,
          })),
          skipDuplicates: true,
        });
      }
    }

    return updatedEvent;
  }

  async updateEventStatus(id: number, status: EventStatus) {
    await this.getEventById(id);
    return this.prisma.event.update({
      where: { id },
      data: { status },
    });
  }

  async updateRoundStatus(
    eventId: number,
    roundId: number,
    status: RoundStatus,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { rounds: { orderBy: { roundNumber: "asc" } } },
    });
    if (!event) throw new NotFoundException("Event not found");

    const targetRound = event.rounds.find((r) => r.id === roundId);
    if (!targetRound)
      throw new NotFoundException("Round not found in this event");

    if (status === RoundStatus.open) {
      // Check if any other round is open
      const otherOpenRound = event.rounds.find(
        (r) => r.id !== roundId && r.status === RoundStatus.open,
      );
      if (otherOpenRound) {
        throw new BadRequestException(
          `Cannot open this round because Round ${otherOpenRound.roundNumber} is currently open.`,
        );
      }

      // Check previous round status
      const prevRound = event.rounds.find(
        (r) => r.roundNumber === targetRound.roundNumber - 1,
      );
      if (prevRound && prevRound.status !== RoundStatus.results_published) {
        throw new BadRequestException(
          `Cannot open this round because previous Round ${prevRound.roundNumber} has not published results.`,
        );
      }
    }

    const updatedRound = await this.prisma.round.update({
      where: { id: roundId },
      data: { status },
    });

    if (
      status === RoundStatus.open &&
      targetRound.submissionType === "github_link"
    ) {
      this.teamGithubService.syncRepositoriesForRound(roundId).catch((err) => {
        this.logger.error(
          `Failed to sync github repositories for round ${roundId}`,
          err,
        );
      });
    }

    return updatedRound;
  }

  async updateRoundDeadline(
    eventId: number,
    roundId: number,
    submissionDeadline: string,
  ) {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
    });

    if (!round || round.eventId !== eventId) {
      throw new NotFoundException("Round not found in this event");
    }

    if (round.status !== RoundStatus.open) {
      throw new BadRequestException(
        "Chỉ có thể chỉnh sửa deadline khi vòng thi đang Mở (Open).",
      );
    }

    const newDeadline = new Date(submissionDeadline);
    if (isNaN(newDeadline.getTime())) {
      throw new BadRequestException("Thời gian deadline không hợp lệ.");
    }

    const now = new Date();
    const isFuture = newDeadline.getTime() > now.getTime();

    const updatedRound = await this.prisma.round.update({
      where: { id: roundId },
      data: {
        submissionDeadline: newDeadline,
        ...(isFuture ? { isRepoFrozen: false, isReminderSent: false } : {}),
      },
    });

    if (isFuture) {
      this.roundAutomationSchedulerService
        .scheduleRoundDelayedJobs(roundId, eventId, newDeadline)
        .catch((err) =>
          this.logger.error(
            `Failed to schedule BullMQ delayed jobs for round ${roundId}`,
            err,
          ),
        );
    }

    return updatedRound;
  }

  async updateRoundProblemFile(
    eventId: number,
    roundId: number,
    problemFileUrl: string | null,
  ) {
    const round = await this.prisma.round.findFirst({
      where: { id: roundId, eventId },
    });
    if (!round) {
      throw new NotFoundException("Round not found in this event");
    }

    if (round.status !== RoundStatus.not_started) {
      throw new BadRequestException(
        "Problem statement file can only be modified when the round status is Not Started",
      );
    }

    return this.prisma.round.update({
      where: { id: roundId },
      data: { problemFileUrl: problemFileUrl || null },
    });
  }

  async getSubmissionsByEvent(
    eventId: number,
    trackId?: number,
    roundId?: number,
  ) {
    const teamRounds = await this.prisma.teamRound.findMany({
      where: {
        round: { eventId },
        team: {
          status: "approved",
          ...(trackId && { trackId }),
        },
        ...(roundId && { roundId }),
      },
      include: {
        team: { include: { track: true } },
        round: true,
      },
      orderBy: { teamId: "asc" },
    });

    const submissions = await this.prisma.submission.findMany({
      where: {
        round: { eventId },
        team: {
          status: "approved",
          ...(trackId && { trackId }),
        },
        ...(roundId && { roundId }),
      },
      include: {
        submittedBy: { select: { id: true, name: true, email: true } },
      },
    });

    const submissionMap = new Map();
    for (const sub of submissions) {
      submissionMap.set(`${sub.teamId}_${sub.roundId}`, sub);
    }

    const merged = teamRounds.map((tr) => {
      const sub = submissionMap.get(`${tr.teamId}_${tr.roundId}`);
      if (sub) {
        return {
          ...sub,
          team: tr.team,
          round: tr.round,
          isSubmittedStatus: true,
        };
      }
      return {
        id: `unsub_${tr.teamId}_${tr.roundId}`,
        teamId: tr.teamId,
        roundId: tr.roundId,
        status: "not_submitted",
        team: tr.team,
        round: tr.round,
        isSubmittedStatus: false,
      };
    });

    // Sort: Submitted ones first, then by time
    merged.sort((a, b) => {
      if (a.isSubmittedStatus && !b.isSubmittedStatus) return -1;
      if (!a.isSubmittedStatus && b.isSubmittedStatus) return 1;
      if (a.isSubmittedStatus && b.isSubmittedStatus) {
        return (
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        );
      }
      return 0;
    });

    return merged;
  }

  async deleteEvent(id: number) {
    await this.getEventById(id);
    return this.prisma.event.delete({ where: { id } });
  }
}
