import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { SubmissionOrganizerService } from "./submission.organizer.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { NotificationService } from "../../notification/services/notification.service";
import { MailService } from "../../../core/mail/mail.service";
import { ConfigService } from "@nestjs/config";
import { getQueueToken } from "@nestjs/bullmq";

describe("SubmissionOrganizerService", () => {
  let service: SubmissionOrganizerService;
  let prismaService: jest.Mocked<Partial<PrismaService>>;

  beforeEach(async () => {
    prismaService = {
      round: {
        findUnique: jest.fn(),
      } as any,
      teamRound: {
        findMany: jest.fn(),
      } as any,
      submission: {
        findMany: jest.fn(),
      } as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmissionOrganizerService,
        { provide: PrismaService, useValue: prismaService },
        { provide: NotificationService, useValue: {} },
        { provide: MailService, useValue: {} },
        { provide: ConfigService, useValue: {} },
        { provide: getQueueToken("mail-notification"), useValue: { add: jest.fn() } },
      ],
    }).compile();

    service = module.get<SubmissionOrganizerService>(SubmissionOrganizerService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("bulkRemindSubmissions", () => {
    it("should throw NotFoundException if round does not exist", async () => {
      (prismaService.round.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.bulkRemindSubmissions(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should return zeros if no teams are competing in round", async () => {
      (prismaService.round.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        eventId: 10,
        submissionDeadline: new Date(),
        event: { title: "Test Hackathon" },
      });
      (prismaService.teamRound.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.bulkRemindSubmissions(10, 1);
      expect(result).toEqual({
        totalTeams: 0,
        unsubmittedCount: 0,
        submittedCount: 0,
      });
    });
  });
});
