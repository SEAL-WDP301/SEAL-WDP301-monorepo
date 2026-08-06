import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { CreateEventDto, CreatePrizeDto } from "../dto/create-event.dto";
import { UpdateEventDto } from "../dto/update-event.dto";
import { EventStatus, Prisma, RoundStatus, TeamStatus } from "@prisma/client";
import { TeamGithubService } from "../../team/services/team-github.service";
import { GithubWebhookService } from "../../github/services/github.webhook.service";

import { RoundAutomationSchedulerService } from "../../round/services/round-automation-scheduler.service";
import { calculatePrizePoolTotals } from "../utils/prize-value.utils";
import { TrackAssignmentService } from "./track-assignment.service";
import { assertTrackCountWithinMaxTeams } from "../utils/track-capacity.util";
import {
  getFlowBInheritedProblemUrl,
  propagateFlowBTrackProblems,
  resolveEffectiveTrackProblemUrl,
} from "../utils/flow-b-shared-problems.util";

@Injectable()
export class EventOrganizerService {
  private readonly logger = new Logger(EventOrganizerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly teamGithubService: TeamGithubService,
    private readonly roundAutomationSchedulerService: RoundAutomationSchedulerService,
    private readonly trackAssignmentService: TrackAssignmentService,
    @Inject(forwardRef(() => GithubWebhookService))
    private readonly githubWebhookService: GithubWebhookService,
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
      if (!Number.isInteger(prize.placement) || prize.placement < 1) {
        throw new BadRequestException({
          errorCode: "INVALID_PRIZE_PLACEMENT",
          message: "Prize placement must be a positive integer or null",
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

    const rankedPrizes = Array.from(primaryPrizes.entries())
      .sort(([firstPlacement], [secondPlacement]) =>
        firstPlacement - secondPlacement,
      )
      .map(([, prize]) => prize);
    const currencies = new Set(
      rankedPrizes.map((prize) => prize.currency ?? "VND"),
    );
    if (currencies.size > 1) {
      throw new BadRequestException({
        errorCode: "MIXED_PRIMARY_PRIZE_CURRENCIES",
        message: "Ranked prizes must use the same currency",
      });
    }

    for (let index = 1; index < rankedPrizes.length; index += 1) {
      const higher = rankedPrizes[index - 1];
      const lower = rankedPrizes[index];
      if ((higher.amount ?? 0) < (lower.amount ?? 0)) {
        throw new BadRequestException({
          errorCode: "INVALID_PRIZE_ORDER",
          message: "Prize amounts must not increase as placement increases",
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

    const deferred = Boolean(dto.deferredTrackAssignment);
    const data: Prisma.EventCreateInput = {
      ...restEventData,
      ...(faq !== undefined && {
        faq: faq as unknown as Prisma.InputJsonValue,
      }),
      createdBy: {
        connect: { id: userId },
      },
      ...(tracks?.length
        ? {
            tracks: {
              create: tracks,
            },
          }
        : {}),
      rounds: {
        create: rounds.map((r) => ({
          ...r,
          isTrackSpecific: deferred ? true : r.isTrackSpecific,
          advanceCount: r.advanceCount ?? null,
        })),
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
        problemPoolItems: { orderBy: { id: "asc" } },
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

    if (event.status === EventStatus.closed) {
      throw new BadRequestException("Closed events cannot be edited.");
    }

    // Allow track/round setup while every round is still not_started
    // (Flow B adds tracks after publish; recovery if auto-open failed).
    const hasStartedRound = (event.rounds || []).some(
      (r) => r.status !== RoundStatus.not_started,
    );
    if (hasStartedRound) {
      throw new BadRequestException(
        "Cannot edit event structure after a round has started.",
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

    // Flow B (deferred): every track needs its own đề → force track-specific rounds.
    const deferred =
      dto.deferredTrackAssignment ?? event.deferredTrackAssignment;
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
              isTrackSpecific: deferred ? true : r.isTrackSpecific,
              advanceCount: r.advanceCount ?? null,
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
                isTrackSpecific: deferred ? true : r.isTrackSpecific,
                advanceCount: r.advanceCount ?? null,
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

    // Shared rounds must not keep leftover per-track đề rows.
    if (!deferred && rounds?.length) {
      const sharedRoundIds = rounds
        .filter((r) => r.id && !r.isTrackSpecific)
        .map((r) => r.id!);
      if (sharedRoundIds.length) {
        await this.prisma.roundTrackProblem.deleteMany({
          where: { roundId: { in: sharedRoundIds } },
        });
      }
    }

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

      await this.assertRoundProblemsReady(
        eventId,
        targetRound,
        event.deferredTrackAssignment,
      );
    }

    let trackAssignment: Awaited<
      ReturnType<TrackAssignmentService["assignDeferredTracks"]>
    > | null = null;

    if (status === RoundStatus.open && event.deferredTrackAssignment) {
      try {
        trackAssignment =
          await this.trackAssignmentService.assignDeferredTracks(eventId, {
            roundId: targetRound.id,
          });
        this.logger.log(
          `Deferred track assignment for event ${eventId}: assigned ${trackAssignment.assignedCount} team(s), skipped ${trackAssignment.skippedAlreadyAssigned} already assigned`,
        );
      } catch (err) {
        this.logger.error(
          `Failed deferred track assignment for event ${eventId}`,
          err,
        );
        throw err;
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

    // Manual close: same as auto-freeze at deadline — public repos + students read-only
    if (status === RoundStatus.closed) {
      this.githubWebhookService.freezeEventRepos(eventId).catch((err) => {
        this.logger.error(
          `Failed to freeze/publicize GitHub repos after closing round ${roundId}`,
          err,
        );
      });
    }

    return { ...updatedRound, trackAssignment };
  }

  private async assertRoundProblemsReady(
    eventId: number,
    round: {
      id: number;
      name: string;
      isTrackSpecific: boolean;
      problemFileUrl: string | null;
    },
    deferredTrackAssignment: boolean,
  ) {
    const requirePerTrackProblems =
      deferredTrackAssignment || round.isTrackSpecific;

    if (!requirePerTrackProblems) {
      if (!round.problemFileUrl?.trim()) {
        throw new BadRequestException(
          `Cannot open "${round.name}" — upload the round problem file first.`,
        );
      }
      return;
    }

    const tracks = (
      await this.prisma.roundTrackProblem.findMany({
        where: { roundId: round.id },
        select: { track: { select: { id: true, name: true } } },
        orderBy: { trackId: "asc" },
      })
    ).map((p) => p.track);

    if (!tracks.length) {
      throw new BadRequestException(
        `Cannot open "${round.name}" — add at least one track to this round first.`,
      );
    }

    const problems = await this.prisma.roundTrackProblem.findMany({
      where: { roundId: round.id },
      select: { trackId: true, problemFileUrl: true },
    });
    const byTrack = new Map(
      problems.map((p) => [p.trackId, p.problemFileUrl?.trim() || ""]),
    );
    const missing: typeof tracks = [];
    for (const t of tracks) {
      const own = byTrack.get(t.id);
      if (own) continue;
      if (deferredTrackAssignment) {
        const inherited = await resolveEffectiveTrackProblemUrl(
          this.prisma,
          eventId,
          round.id,
          t.id,
        );
        if (inherited) continue;
      }
      missing.push(t);
    }
    if (missing.length) {
      throw new BadRequestException(
        `Cannot open "${round.name}" — each track needs a problem file before opening. Missing: ${missing
          .map((t) => t.name)
          .join(", ")}.`,
      );
    }
  }

  /**
   * Create a track scoped to a single round only. Independent of other rounds'
   * status — only this round must still be not_started.
   */
  async createRoundTrack(
    eventId: number,
    roundId: number,
    dto: { name: string; description?: string },
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { rounds: { select: { id: true, name: true, status: true } } },
    });
    if (!event) throw new NotFoundException("Event not found");
    if (event.status === EventStatus.closed) {
      throw new BadRequestException("Closed events cannot be edited.");
    }
    if (event.status === EventStatus.ongoing) {
      throw new BadRequestException(
        "Cannot add tracks while the event is ongoing.",
      );
    }

    const openedRound = event.rounds.find(
      (r) => r.status !== RoundStatus.not_started,
    );
    if (openedRound) {
      throw new BadRequestException(
        `Cannot add tracks after a round has opened ("${openedRound.name}").`,
      );
    }

    const round = await this.prisma.round.findFirst({
      where: { id: roundId, eventId },
    });
    if (!round) {
      throw new NotFoundException("Round not found in this event");
    }
    if (round.status !== RoundStatus.not_started) {
      throw new BadRequestException(
        "Tracks can only be added to this round while it is Not Started.",
      );
    }

    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException("Track name is required.");
    }

    const duplicate = await this.prisma.track.findFirst({
      where: { eventId, name: { equals: name, mode: "insensitive" } },
    });
    if (duplicate) {
      throw new BadRequestException(
        `A track named "${name}" already exists for this event.`,
      );
    }

    const roundTrackCount = await this.prisma.roundTrackProblem.count({
      where: { roundId },
    });
    try {
      assertTrackCountWithinMaxTeams(
        event.maxTeams,
        roundTrackCount + 1,
        "Add track",
      );
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    const track = await this.prisma.track.create({
      data: {
        eventId,
        name,
        description: dto.description?.trim() || null,
      },
    });

    await this.prisma.roundTrackProblem.create({
      data: {
        roundId,
        trackId: track.id,
        problemFileUrl: null,
      },
    });

    return track;
  }

  /** Update track name/description without touching round structure. */
  async updateTrackMetadata(
    eventId: number,
    trackId: number,
    dto: { name: string; description?: string },
  ) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException("Event not found");
    if (event.status === EventStatus.closed) {
      throw new BadRequestException("Closed events cannot be edited.");
    }

    const track = await this.prisma.track.findFirst({
      where: { id: trackId, eventId },
    });
    if (!track) throw new NotFoundException("Track not found for this event");

    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException("Track name is required.");
    }

    const duplicate = await this.prisma.track.findFirst({
      where: {
        eventId,
        id: { not: trackId },
        name: { equals: name, mode: "insensitive" },
      },
    });
    if (duplicate) {
      throw new BadRequestException(
        `A track named "${name}" already exists for this event.`,
      );
    }

    return this.prisma.track.update({
      where: { id: trackId },
      data: {
        name,
        description: dto.description?.trim() || null,
      },
    });
  }

  /** Unscope a track from a round (delete its RoundTrackProblem row). Does
   * NOT delete the Track itself — the track stays in the event catalog and
   * in any other round it's scoped to. */
  async removeTrackFromRound(eventId: number, roundId: number, trackId: number) {
    const round = await this.prisma.round.findFirst({
      where: { id: roundId, eventId },
    });
    if (!round) {
      throw new NotFoundException("Round not found in this event");
    }
    if (round.status !== RoundStatus.not_started) {
      throw new BadRequestException(
        "Tracks can only be added to or removed from a round while it is Not Started.",
      );
    }

    const existing = await this.prisma.roundTrackProblem.findUnique({
      where: { roundId_trackId: { roundId, trackId } },
    });
    if (!existing) {
      throw new NotFoundException("This track is not part of this round");
    }

    await this.prisma.roundTrackProblem.delete({
      where: { roundId_trackId: { roundId, trackId } },
    });

    return { success: true };
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

    if (trackId != null) {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        select: { deferredTrackAssignment: true },
      });
      if (!round.isTrackSpecific && !event?.deferredTrackAssignment) {
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
      let resolvedUrl = problemFileUrl?.trim() || null;
      if (!resolvedUrl && event?.deferredTrackAssignment) {
        resolvedUrl = await getFlowBInheritedProblemUrl(
          this.prisma,
          eventId,
          roundId,
          trackId,
        );
      }
      const result = await this.prisma.roundTrackProblem.upsert({
        where: {
          roundId_trackId: { roundId, trackId },
        },
        create: {
          roundId,
          trackId,
          problemFileUrl: resolvedUrl,
        },
        update: {
          problemFileUrl: resolvedUrl,
        },
      });
      if (resolvedUrl && event?.deferredTrackAssignment) {
        await propagateFlowBTrackProblems(this.prisma, eventId, roundId, [
          { trackId, problemFileUrl: resolvedUrl },
        ]);
      }
      return result;
    }

    if (!round.isTrackSpecific) {
      await this.prisma.roundTrackProblem.deleteMany({ where: { roundId } });
    }

    return this.prisma.round.update({
      where: { id: roundId },
      data: { problemFileUrl: problemFileUrl || null },
    });
  }

  async revealTracks(
    eventId: number,
    forceReassign = false,
    roundId?: number,
    studentSelfDraw?: boolean,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        deferredTrackAssignment: true,
        studentSelfTrackDraw: true,
        studentTrackDrawOpen: true,
      },
    });
    if (!event) throw new NotFoundException("Event not found");
    if (!event.deferredTrackAssignment) {
      throw new BadRequestException(
        "This event does not use deferred track assignment.",
      );
    }

    if (forceReassign) {
      throw new BadRequestException(
        "Ceremony chỉ chạy một lần — không thể bốc lại.",
      );
    }

    if (
      event.studentTrackDrawOpen &&
      event.studentSelfTrackDraw &&
      studentSelfDraw !== false
    ) {
      return this.trackAssignmentService.openStudentTrackDraw(eventId, roundId);
    }

    if (studentSelfDraw === true) {
      await this.prisma.event.update({
        where: { id: eventId },
        data: { studentSelfTrackDraw: true },
      });
      return this.trackAssignmentService.openStudentTrackDraw(eventId, roundId);
    }

    await this.prisma.event.update({
      where: { id: eventId },
      data: { studentSelfTrackDraw: false, studentTrackDrawOpen: false },
    });

    if (roundId != null) {
      const round = await this.prisma.round.findFirst({
        where: { id: roundId, eventId },
        select: { id: true, status: true, name: true },
      });
      if (!round) throw new NotFoundException("Round not found in this event");
      if (round.status !== RoundStatus.not_started) {
        throw new BadRequestException(
          `Team lottery is only allowed before "${round.name}" is opened.`,
        );
      }
    }

    await this.trackAssignmentService.assertCeremonyTeamLotteryNotYetRun(eventId);

    return this.trackAssignmentService.assignDeferredTracks(eventId, {
      roundId,
    });
  }

  async closeStudentTrackDraw(eventId: number) {
    return this.trackAssignmentService.closeStudentTrackDraw(eventId);
  }

  async getStudentTrackDrawStatus(eventId: number, roundId?: number) {
    return this.trackAssignmentService.getStudentDrawStatus(eventId, roundId);
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
