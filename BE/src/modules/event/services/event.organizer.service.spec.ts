import { BadRequestException } from "@nestjs/common";
import { EventStatus, Season, SubmissionType } from "@prisma/client";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { CreateEventDto } from "../dto/create-event.dto";
import { RoundAutomationSchedulerService } from "../../round/services/round-automation-scheduler.service";
import { TeamGithubService } from "../../team/services/team-github.service";
import { EventOrganizerService } from "./event.organizer.service";
import { TrackAssignmentService } from "./track-assignment.service";

describe("EventOrganizerService team member limits", () => {
  const prisma = {
    event: { create: jest.fn() },
  };
  const service = new EventOrganizerService(
    prisma as unknown as PrismaService,
    {} as TeamGithubService,
    {} as RoundAutomationSchedulerService,
    {} as TrackAssignmentService,
  );

  const dto = {
    name: "SEAL Event",
    season: Season.Summer,
    year: 2026,
    status: EventStatus.draft,
    minMembersPerTeam: 3,
    maxMembersPerTeam: 5,
    tracks: [{ name: "Web" }],
    rounds: [
      {
        roundNumber: 1,
        name: "Proposal",
        submissionType: SubmissionType.file,
        isTrackSpecific: false,
      },
    ],
  } as CreateEventDto;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.event.create.mockResolvedValue({ id: 1 });
  });

  it("stores the event-level minimum and maximum", async () => {
    await service.createEvent(42, dto);

    expect(prisma.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          minMembersPerTeam: 3,
          maxMembersPerTeam: 5,
          tracks: { create: [{ name: "Web" }] },
        }),
      }),
    );
  });

  it("rejects a minimum greater than the maximum", async () => {
    await expect(
      service.createEvent(42, {
        ...dto,
        minMembersPerTeam: 6,
        maxMembersPerTeam: 5,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.event.create).not.toHaveBeenCalled();
  });
});
