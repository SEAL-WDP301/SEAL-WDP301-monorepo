import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { CreateMentorFeedbackDto } from "../dto/create-mentor-feedback.dto";
import { FeedbackGateway } from "../gateways/feedback.gateway";

@Injectable()
export class MentorFeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feedbackGateway: FeedbackGateway,
  ) {}

  async findAllByMentor(mentorId: number, eventId?: number) {
    return this.prisma.mentorFeedback.findMany({
      where: {
        mentorId,
        team: {
          mentorAssignments: { some: { mentorId } },
          ...(eventId && { eventId }),
        },
      },
      include: this.feedbackInclude(),
      orderBy: { createdAt: "desc" },
    });
  }

  async create(
    mentorId: number,
    submissionId: number,
    dto: CreateMentorFeedbackDto,
  ) {
    const submission = await this.prisma.submission.findFirst({
      where: {
        id: submissionId,
        team: {
          mentorAssignments: { some: { mentorId } },
        },
      },
      select: { id: true, teamId: true },
    });

    if (!submission) {
      throw new NotFoundException("Assigned team submission not found");
    }

    const feedback = await this.prisma.mentorFeedback.create({
      data: {
        mentorId,
        teamId: submission.teamId,
        submissionId: submission.id,
        content: dto.content.trim(),
        status: "unread",
      },
      include: this.feedbackInclude(),
    });

    this.feedbackGateway.notifyFeedbackUpdated(submission.teamId);
    return feedback;
  }

  async update(
    mentorId: number,
    feedbackId: number,
    dto: CreateMentorFeedbackDto,
  ) {
    const feedback = await this.ensureOwnedFeedback(mentorId, feedbackId);

    const updated = await this.prisma.mentorFeedback.update({
      where: { id: feedbackId },
      data: { content: dto.content.trim() },
      include: this.feedbackInclude(),
    });

    this.feedbackGateway.notifyFeedbackUpdated(feedback.teamId);
    return updated;
  }

  async remove(mentorId: number, feedbackId: number) {
    const feedback = await this.ensureOwnedFeedback(mentorId, feedbackId);
    const deleted = await this.prisma.mentorFeedback.delete({
      where: { id: feedbackId },
    });
    this.feedbackGateway.notifyFeedbackUpdated(feedback.teamId);
    return deleted;
  }

  private async ensureOwnedFeedback(mentorId: number, feedbackId: number) {
    const feedback = await this.prisma.mentorFeedback.findFirst({
      where: {
        id: feedbackId,
        mentorId,
        team: {
          mentorAssignments: { some: { mentorId } },
        },
      },
      select: { id: true, teamId: true },
    });

    if (!feedback) {
      throw new NotFoundException("Mentor feedback not found");
    }

    return feedback;
  }

  private feedbackInclude() {
    return {
      team: {
        include: {
          event: true,
          track: true,
        },
      },
      submission: {
        include: {
          round: true,
        },
      },
    };
  }
}
