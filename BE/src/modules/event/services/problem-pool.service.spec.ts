import { ProblemPoolService } from "./problem-pool.service";



describe("ProblemPoolService", () => {

  const prisma = {

    event: { findUnique: jest.fn() },

    round: { findFirst: jest.fn() },

    eventProblemPoolItem: {

      findMany: jest.fn(),

      findFirst: jest.fn(),

      update: jest.fn(),

      updateMany: jest.fn(),

      count: jest.fn(),

    },

    roundTrackProblem: { update: jest.fn(), updateMany: jest.fn() },

    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>

      fn({

        roundTrackProblem: { update: jest.fn() },

        eventProblemPoolItem: { update: jest.fn() },

      }),

    ),

  };



  const service = new ProblemPoolService(prisma as never);



  beforeEach(() => jest.clearAllMocks());



  it("requires enough unassigned pool items for track count", async () => {

    prisma.event.findUnique

      .mockResolvedValueOnce({

        id: 1,

        deferredTrackAssignment: true,

      })

      .mockResolvedValueOnce({ maxTeams: 30 });

    prisma.round.findFirst.mockResolvedValue({

      id: 10,

      eventId: 1,

      status: "not_started",

      isTrackSpecific: true,

      trackProblems: [

        { trackId: 1, track: { id: 1, name: "Bảng A" } },

        { trackId: 2, track: { id: 2, name: "Bảng B" } },

      ],

    });

    prisma.eventProblemPoolItem.updateMany.mockResolvedValue({ count: 0 });

    prisma.roundTrackProblem.updateMany.mockResolvedValue({ count: 0 });

    prisma.eventProblemPoolItem.count.mockResolvedValue(0);

    prisma.eventProblemPoolItem.findMany.mockResolvedValue([

      { id: 1, label: "Đề 1", problemFileUrl: "a.pdf" },

    ]);



    await expect(

      service.lotteryAssignProblemsToRound(1, 10),

    ).rejects.toThrow("Need at least 2 unassigned pool item");

  });



  it("blocks re-running Phase 1 when pool items are already assigned", async () => {

    prisma.event.findUnique

      .mockResolvedValueOnce({

        id: 1,

        deferredTrackAssignment: true,

      })

      .mockResolvedValueOnce({ maxTeams: 30 });

    prisma.round.findFirst.mockResolvedValue({

      id: 10,

      eventId: 1,

      status: "not_started",

      isTrackSpecific: true,

      trackProblems: [

        { trackId: 1, track: { id: 1, name: "Bảng A" } },

      ],

    });

    prisma.eventProblemPoolItem.count.mockResolvedValue(1);



    await expect(

      service.lotteryAssignProblemsToRound(1, 10),

    ).rejects.toThrow("Phase 1 đã chạy");

  });



  it("rejects pool when event is not Flow B", async () => {

    prisma.event.findUnique.mockResolvedValue({

      id: 1,

      deferredTrackAssignment: false,

    });



    await expect(service.listPoolItems(1)).rejects.toThrow("Flow B");

  });

});

