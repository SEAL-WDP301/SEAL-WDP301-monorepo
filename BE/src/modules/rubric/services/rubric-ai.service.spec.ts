import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { RubricAiService } from "./rubric-ai.service";

describe("RubricAiService", () => {
  const prisma = {
    event: { findUnique: jest.fn() },
    round: { findFirst: jest.fn() },
    criterion: { findMany: jest.fn() },
  };
  const config = { get: jest.fn().mockReturnValue("test-api-key") };
  const service = new RubricAiService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.event.findUnique.mockResolvedValue({
      id: 10,
      name: "SEAL 2026",
      description: "Build useful AI products",
      deferredTrackAssignment: true,
      tracks: [
        { id: 1, name: "AI", description: "Applied AI" },
        { id: 2, name: "Web", description: "Web products" },
        { id: 3, name: "LLM", description: "Language models" },
      ],
    });
    prisma.round.findFirst.mockResolvedValue({
      id: 20,
      name: "Qualification",
      roundNumber: 1,
      isTrackSpecific: true,
      problemFileUrl: null,
      trackProblems: [
        {
          problemFileUrl: "https://example.com/ai.pdf",
          track: { id: 1, name: "AI", description: "Applied AI" },
        },
        {
          problemFileUrl: "https://example.com/llm.pdf",
          track: { id: 3, name: "LLM", description: "Language models" },
        },
      ],
    });
    prisma.criterion.findMany.mockResolvedValue([]);
    jest
      .spyOn(
        service as unknown as {
          requestJsonCompletion: () => Promise<unknown>;
        },
        "requestJsonCompletion",
      )
      .mockResolvedValue({
        overallRationale: "Scoped to the round tracks.",
        criteria: [
          {
            name: "Technical Quality",
            description: "Quality of the implementation",
            weight: 100,
            whyChosen: "Relevant to both tracks",
          },
        ],
      });
  });

  it("returns only tracks scoped to the requested round", async () => {
    const result = await service.suggestRubrics(10, 20);

    expect(result.basedOn.roundName).toBe("Round 1: Qualification");
    expect(result.basedOn.tracks.map((track) => track.name)).toEqual([
      "AI",
      "LLM",
    ]);
    expect(result.basedOn.tracks.map((track) => track.name)).not.toContain(
      "Web",
    );
  });
});
