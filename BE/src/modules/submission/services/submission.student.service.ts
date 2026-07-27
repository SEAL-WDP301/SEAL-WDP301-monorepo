import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { StorageService } from "../../../core/storage/storage.service";
import { SubmitProjectDto } from "../dto/submit-project.dto";
import {
  TeamMemberStatus,
  TeamStatus,
  SubmissionType,
  RoundResultStatus,
} from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class SubmissionStudentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async submitProject(
    userId: number,
    dto: SubmitProjectDto,
    file?: Express.Multer.File,
  ) {
    const teamMember = await this.prisma.teamMember.findFirst({
      where: {
        userId,
        status: TeamMemberStatus.accepted,
        team: { eventId: dto.eventId },
      },
      include: { team: true },
    });

    if (!teamMember) {
      throw new NotFoundException("You do not belong to a team in this event");
    }

    const team = teamMember.team;

    if (team.status !== TeamStatus.approved) {
      throw new BadRequestException(
        team.status === TeamStatus.pending
          ? "Your team must be approved by the organizer before submitting"
          : "Your team cannot submit in its current status",
      );
    }

    if (team.leaderId !== userId) {
      throw new ForbiddenException(
        "Only the team leader can submit the project",
      );
    }

    const teamId = team.id;

    const round = await this.prisma.round.findUnique({
      where: { id: dto.roundId },
    });

    if (!round || round.eventId !== dto.eventId) {
      throw new BadRequestException("Invalid round");
    }

    if (round.status !== "open") {
      throw new BadRequestException("Submission for this round is not open");
    }

    if (round.submissionDeadline && round.submissionDeadline < new Date()) {
      throw new BadRequestException("Submission deadline has passed");
    }

    await this.assertTeamCanSubmitInRound(teamId, round.id, round.roundNumber);

    const existingSubmission = await this.prisma.submission.findUnique({
      where: { teamId_roundId: { teamId, roundId: dto.roundId } },
    });

    if (round.submissionType === SubmissionType.github_link) {
      if (file) {
        throw new BadRequestException(
          "This round only accepts a GitHub repository link, not file uploads",
        );
      }
      if (!team.githubRepoUrl) {
        throw new BadRequestException(
          "No GitHub repository has been assigned to your team yet. Please wait for organizer approval.",
        );
      }
      if (dto.githubUrl && dto.githubUrl !== team.githubRepoUrl) {
        throw new BadRequestException(
          "You must use your assigned team repository URL for this submission",
        );
      }
    }

    if (round.submissionType === SubmissionType.file) {
      if (dto.githubUrl) {
        throw new BadRequestException(
          "This round only accepts file uploads, not GitHub links",
        );
      }
      if (!file && !existingSubmission?.fileUrl) {
        throw new BadRequestException("You must upload a file for this round");
      }
    }

    if (file && file.size > round.maxFileSizeMb * 1024 * 1024) {
      throw new BadRequestException(
        `File size exceeds the limit of ${round.maxFileSizeMb}MB`,
      );
    }

    let fileUrl = existingSubmission?.fileUrl ?? null;
    let fileKey = existingSubmission?.fileKey ?? null;
    const previousFileKey = existingSubmission?.fileKey ?? null;
    let uploadedFileKey: string | null = null;

    if (file) {
      const trackPath = round.isTrackSpecific ? `/track-${team.trackId}` : "";
      const uploadPath = `submissions/event-${dto.eventId}/round-${dto.roundId}${trackPath}/team-${teamId}`;
      const uploaded = await this.storageService.uploadFile(file, uploadPath);
      uploadedFileKey = uploaded.fileKey;
      fileUrl = uploaded.fileUrl;
      fileKey = uploaded.fileKey;
    }

    const githubUrl =
      round.submissionType === SubmissionType.github_link
        ? team.githubRepoUrl
        : null;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    let history: any[] = [];
    if (existingSubmission?.history) {
      history = existingSubmission.history as any[];
    }
    history.push({
      action: existingSubmission ? "updated" : "created",
      timestamp: new Date().toISOString(),
      userName: user?.name,
      userEmail: user?.email,
      fileName: file ? file.originalname : null,
    });

    const now = new Date();

    try {
      const submission = await this.prisma.submission.upsert({
        where: { teamId_roundId: { teamId, roundId: dto.roundId } },
        update: {
          fileUrl,
          fileKey,
          githubUrl,
          description: dto.description,
          history,
          submittedById: userId,
          status: "submitted",
          submittedAt: now,
          updatedAt: now,
        },
        create: {
          teamId,
          roundId: dto.roundId,
          fileUrl,
          fileKey,
          githubUrl,
          description: dto.description,
          history,
          submittedById: userId,
          status: "submitted",
          submittedAt: now,
        },
      });

      if (
        uploadedFileKey &&
        previousFileKey &&
        previousFileKey !== uploadedFileKey
      ) {
        await this.storageService.deleteFile(previousFileKey);
      }

      this.eventEmitter.emit("submission.created", {
        roundId: dto.roundId,
        teamId: teamId,
        teamName: team.name,
        submissionId: submission.id,
        timestamp: now,
      });

      return submission;
    } catch (error) {
      if (uploadedFileKey) {
        await this.storageService
          .deleteFile(uploadedFileKey)
          .catch(() => undefined);
      }
      throw error;
    }
  }

  private async assertTeamCanSubmitInRound(
    teamId: number,
    roundId: number,
    roundNumber: number,
  ) {
    let teamRound = await this.prisma.teamRound.findUnique({
      where: { teamId_roundId: { teamId, roundId } },
    });

    if (!teamRound && roundNumber === 1) {
      teamRound = await this.prisma.teamRound.create({
        data: { teamId, roundId, status: RoundResultStatus.competing },
      });
    }

    if (!teamRound) {
      throw new BadRequestException("Your team is not competing in this round");
    }

    if (teamRound.status === RoundResultStatus.eliminated) {
      throw new BadRequestException(
        "Your team has been eliminated from this round and cannot submit",
      );
    }

    return teamRound;
  }

}
