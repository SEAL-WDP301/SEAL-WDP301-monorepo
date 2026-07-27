import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { TeamMemberStatus } from "@prisma/client";

@Injectable()
export class FeedbackStudentService {
  constructor(private readonly prisma: PrismaService) {}

  async updateFeedbackStatus(userId: number, feedbackId: number, status: any) {
    const feedback = await this.prisma.mentorFeedback.findUnique({
      where: { id: feedbackId },
      include: { team: { include: { members: true } } },
    });

    if (!feedback) {
      throw new NotFoundException("Feedback not found");
    }

    const isMember = feedback.team.members.some(
      (m) => m.userId === userId && m.status === TeamMemberStatus.accepted,
    );
    const isLeader = feedback.team.leaderId === userId;

    if (!isMember && !isLeader) {
      throw new ForbiddenException("You do not belong to this team");
    }

    return this.prisma.mentorFeedback.update({
      where: { id: feedbackId },
      data: { status },
    });
  }
}
