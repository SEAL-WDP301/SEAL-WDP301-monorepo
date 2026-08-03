import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { CreateEventDto, CreatePrizeDto } from "../dto/create-event.dto";
import { UpdateEventDto } from "../dto/update-event.dto";
import { EventStatus, Prisma, RoundStatus, TeamStatus } from "@prisma/client";
import { TeamGithubService } from "../../team/services/team-github.service";

import { RoundAutomationSchedulerService } from "../../round/services/round-automation-scheduler.service";
import { calculatePrizePoolTotals } from "../utils/prize-value.utils";
import { TrackAssignmentService } from "./track-assignment.service";

@Injectable()
export class EventOrganizerService {
  private readonly logger = new Logger(EventOrganizerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly teamGithubService: TeamGithubService,
    private readonly roundAutomationSchedulerService: RoundAutomationSchedulerService,
    private readonly trackAssignmentService: TrackAssignmentService,
  ) {}

  private validateTeamMemberLimits(
    minMembersPerTeam: number,
    maxMembersPerTeam: number,
  ) {
    if (minMembersPerTeam > maxMembersPerTeam) {
      throw new BadRequestException({
        errorCode: "INVALID_TEAM_MEMBER_LIMITS",
        message:
          "Maximum members per team must be greater than or equal to the minimum",
      });
    }
  }

  private validatePrizeStructure(prizes: readonly CreatePrizeDto[] = []) {
    const primaryPrizes = new Map<number, CreatePrizeDto>();

    for (const prize of prizes) {
      const amount = prize.amount ?? 0;
      const quantity = prize.quantity ?? 1;
      const currency = prize.currency ?? "VND";

      if (!Number.isInteger(amount) || amount < 0) {
        throw new BadRequestException({
          errorCode: "INVALID_PRIZE_AMOUNT",
          message: "Prize amount must be a non-negative integer",
        });
      }
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new BadRequestException({
          errorCode: "INVALID_PRIZE_QUANTITY",
          message: "Prize quantity must be at least 1",
        });
      }
      if (!/^[A-Z]{3}$/.test(currency)) {
        throw new BadRequestException({
          errorCode: "INVALID_PRIZE_CURRENCY",
          message: "Prize currency must be a three-letter uppercase code",
        });
      }
      if (prize.placement == null) continue;
      if (![1, 2, 3].includes(prize.placement)) {
        throw new BadRequestException({
          errorCode: "INVALID_PRIZE_PLACEMENT",
          message: "Prize placement must be 1, 2, 3, or null",
        });
      }
      if (primaryPrizes.has(prize.placement)) {
        throw new BadRequestException({
          errorCode: "DUPLICATE_PRIZE_PLACEMENT",
          message: `Only one prize can use placement ${prize.placement}`,
        });
      }
      primaryPrizes.set(prize.placement, prize);
    }

    const rankedPrizes = [1, 2, 3]
      .map((placement) => primaryPrizes.get(placement))
      .filter((prize): prize is CreatePrizeDto => Boolean(prize));
    const currencies = new Set(
      rankedPrizes.map((prize) => prize.currency ?? "VND"),
    );
    if (currencies.size > 1) {
      throw new BadRequestException({
        errorCode: "MIXED_PRIMARY_PRIZE_CURRENCIES",
        message: "First, second, and third prizes must use the same currency",
      });
    }

    const comparisons: Array<[number, number]> = [
      [1, 2],
      [2, 3],
    ];
    for (const [higherPlacement, lowerPlacement] of comparisons) {
      const higher = primaryPrizes.get(higherPlacement);
      const lower = primaryPrizes.get(lowerPlacement);
      if (higher && lower && (higher.amount ?? 0) <= (lower.amount ?? 0)) {
        throw new BadRequestException({
          errorCode: "INVALID_PRIZE_ORDER",
          message:
            "Prize amounts must follow: first prize > second prize > third prize",
        });
      }
    }
  }

  private withPrizePoolTotals<
    T extends {
      prizes?: Array<{
        amount?: number | null;
        quantity?: number | null;
        currency?: string | null;
      }>;
    },
  >(event: T) {
    return {
      ...event,
      prizePoolTotals: calculatePrizePoolTotals(event.prizes),
    };
  }

  async createEvent(userId: number, dto: CreateEventDto) {
    this.validateTeamMemberLimits(dto.minMembersPerTeam, dto.maxMembersPerTeam);
    const { tracks, rounds, prizes, ...eventData } = dto;
    this.validatePrizeStructure(prizes);
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

    const createdEvent = await this.prisma.event.create({
      data,
      include: {
        tracks: true,
        rounds: true,
        prizes: true,
      },
    });
    return this.withPrizePoolTotals(createdEvent);
  }

  async getAllEvents(userId: number, includeAll = false) {
    const events = await this.prisma.event.findMany({
      where: includeAll ? undefined : { createdById: userId },
      include: {
        tracks: true,
        prizes: true,
        _count: {
          select: {
            teams: {
              where: {
                status: {
                  in: [TeamStatus.pending, TeamStatus.approved],
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return events.map((event) => ({
      ...this.withPrizePoolTotals(event),
      registeredTeams: event._count.teams,
    }));
  }

  async getEventById(id: number) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        tracks: {
          include: { _count: { select: { teams: true } } },
        },
        rounds: {
          include: {
            _count: { select: { submissions: true } },
            trackProblems: true,
          },
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

    return this.withPrizePoolTotals({
      ...event,
      _count: {
        teams: event._count?.teams ?? 0,
        submissions: submissionCount,
      },
    });
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

    this.validateTeamMemberLimits(
      dto.minMembersPerTeam ?? event.minMembersPerTeam,
      dto.maxMembersPerTeam ?? event.maxMembersPerTeam,
    );

    const { tracks, rounds, prizes, ...eventData } = dto;
    this.validatePrizeStructure(prizes);
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
            })),
          update: tracks
            .filter((t) => t.id)
            .map((t) => ({
              where: { id: t.id },
              data: {
                name: t.name,
                description: t.description,
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
              advanceTeamLimit: r.advanceTeamLimit,
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
                advanceTeamLimit: r.advanceTeamLimit,
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
              amount: p.amount,
              placement: p.placement,
              currency: p.currency,
            })),
          update: prizes
            .filter((p) => p.id)
            .map((p) => ({
              where: { id: p.id },
              data: {
                name: p.name,
                description: p.description,
                quantity: p.quantity,
                amount: p.amount,
                placement: p.placement,
                currency: p.currency,
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

    return this.withPrizePoolTotals(updatedEvent);
  }

  async updateRegistrationDeadline(
    eventId: number,
    registrationDeadlineStr: string,
  ) {
    const deadline = new Date(registrationDeadlineStr);
    if (isNaN(deadline.getTime())) {
      throw new BadRequestException(
        "Invalid registration deadline date format.",
      );
    }

    const event = await this.prisma.event.update({
      where: { id: eventId },
      data: { registrationDeadline: deadline },
      include: { rounds: true, tracks: true, prizes: true },
    });

    // Schedule BullMQ delayed job for auto-closing registration & opening Round 1
    await this.roundAutomationSchedulerService.scheduleRegistrationDeadlineJob(
      eventId,
      deadline,
    );

    return this.withPrizePoolTotals(event);
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

      await this.assertRoundProblemsReady(eventId, targetRound);
    }

    const updatedRound = await this.prisma.round.update({
      where: { id: roundId },
      data: { status },
    });

    let trackAssignment: Awaited<
      ReturnType<TrackAssignmentService["assignDeferredTracks"]>
    > | null = null;

    if (status === RoundStatus.open && event.deferredTrackAssignment) {
      try {
        trackAssignment =
          await this.trackAssignmentService.assignDeferredTracks(eventId);
        this.logger.log(
          `Deferred track reveal for event ${eventId}: assigned ${trackAssignment.assignedCount} team(s)`,
        );
      } catch (err) {
        this.logger.error(
          `Failed deferred track assignment for event ${eventId}`,
          err,
        );
        throw err;
      }
    }

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

    return { ...updatedRound, trackAssignment };
  }

  /** Block opening a round until topic file(s) are uploaded. */
  private async assertRoundProblemsReady(
    eventId: number,
    round: {
      id: number;
      name: string;
      isTrackSpecific: boolean;
      problemFileUrl: string | null;
    },
  ) {
    if (!round.isTrackSpecific) {
      if (!round.problemFileUrl?.trim()) {
        throw new BadRequestException(
          `Cannot open "${round.name}" — upload the round topic/problem file first.`,
        );
      }
      return;
    }

    const tracks = await this.prisma.track.findMany({
      where: { eventId },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });
    if (!tracks.length) {
      throw new BadRequestException(
        `Cannot open "${round.name}" — create at least one track and upload its problem file.`,
      );
    }

    const problems = await this.prisma.roundTrackProblem.findMany({
      where: { roundId: round.id },
      select: { trackId: true, problemFileUrl: true },
    });
    const byTrack = new Map(
      problems.map((p) => [p.trackId, p.problemFileUrl?.trim() || ""]),
    );
    const missing = tracks.filter((t) => !byTrack.get(t.id));
    if (missing.length) {
      throw new BadRequestException(
        `Cannot open "${round.name}" — missing problem file for track(s): ${missing
          .map((t) => t.name)
          .join(", ")}. Upload one đề per track first.`,
      );
    }
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
    trackId?: number | null,
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

    // Per-track đề when round is track-specific and trackId provided
    if (trackId != null) {
      if (!round.isTrackSpecific) {
        throw new BadRequestException(
          "This round is not track-specific; upload a single round problem file instead.",
        );
      }
      const track = await this.prisma.track.findFirst({
        where: { id: trackId, eventId },
      });
      if (!track) {
        throw new NotFoundException("Track not found for this event");
      }
      return this.prisma.roundTrackProblem.upsert({
        where: {
          roundId_trackId: { roundId, trackId },
        },
        create: {
          roundId,
          trackId,
          problemFileUrl: problemFileUrl || null,
        },
        update: {
          problemFileUrl: problemFileUrl || null,
        },
      });
    }

    return this.prisma.round.update({
      where: { id: roundId },
      data: { problemFileUrl: problemFileUrl || null },
    });
  }

  async revealTracks(eventId: number, forceReassign = false) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { deferredTrackAssignment: true },
    });
    if (!event) throw new NotFoundException("Event not found");
    if (!event.deferredTrackAssignment) {
      throw new BadRequestException(
        "This event does not use deferred track assignment.",
      );
    }
    return this.trackAssignmentService.assignDeferredTracks(eventId, {
      forceReassign,
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
