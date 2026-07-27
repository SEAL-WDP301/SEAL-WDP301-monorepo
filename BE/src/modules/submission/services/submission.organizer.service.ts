import {
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { NotificationService } from "../../notification/services/notification.service";
import { NotificationTemplates } from "../../notification/constants/notification.template";
import { NotificationType } from "@prisma/client";
import { MailService } from "../../../core/mail/mail.service";

import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

import { ConfigService } from "@nestjs/config";

@Injectable()
export class SubmissionOrganizerService {
  private readonly logger = new Logger(SubmissionOrganizerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    @InjectQueue("mail-notification") private readonly mailQueue: Queue,
  ) {}

  async bulkRemindSubmissions(eventId: number, roundId: number) {
    // 1. Get round info
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      include: { event: true },
    });
    if (!round || round.eventId !== eventId) {
      throw new NotFoundException("Round not found in this event");
    }

    // 2. Get all teams competing in this round
    const teamRounds = await this.prisma.teamRound.findMany({
      where: {
        roundId,
        status: "competing",
      },
      include: {
        team: {
          include: {
            leader: true,
            members: {
              where: { status: "accepted" },
              include: { user: true },
            },
          },
        },
      },
    });

    if (teamRounds.length === 0) {
      return { totalTeams: 0, unsubmittedCount: 0, submittedCount: 0 };
    }

    // 3. Get all submissions for this round
    const submissions = await this.prisma.submission.findMany({
      where: { roundId },
    });

    const submittedTeamIds = new Set(submissions.map((s) => s.teamId));

    const deadlineString = round.submissionDeadline
      ? new Date(round.submissionDeadline).toLocaleString("vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
        })
      : "Not specified";

    let timeRemaining = "Not specified";
    if (round.submissionDeadline) {
      const diffMs = new Date(round.submissionDeadline).getTime() - new Date().getTime();
      if (diffMs <= 0) {
        timeRemaining = "0 days 0 hours (Overdue)";
      } else {
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        timeRemaining = `${days} days, ${hours} hours, ${minutes} minutes`;
      }
    }

    let unsubmittedCount = 0;
    let submittedCount = 0;

    const frontendUrl = this.configService.get<string>("app.frontendUrl") || "http://localhost:3001";
    const actionUrl = `${frontendUrl}/student/events/${eventId}/workspace/submissions?roundId=${roundId}`;

    const promises = teamRounds.map(async (tr) => {
      const team = tr.team;
      const memberMap = new Map();
      memberMap.set(team.leader.id, team.leader);
      team.members.forEach((m) => memberMap.set(m.user.id, m.user));
      
      const members = Array.from(memberMap.values());
      const userIds = members.map(m => m.id);
      
      const isSubmitted = submittedTeamIds.has(team.id);

      if (isSubmitted) {
        submittedCount++;
        const template = NotificationTemplates[NotificationType.bulk_reminder_submitted](
          team.name,
          round.name,
          round.event.name,
          deadlineString,
          timeRemaining
        );
        await this.notificationService.createManyNotifications({
          userIds,
          eventId,
          type: NotificationType.bulk_reminder_submitted,
          title: template.title,
          content: template.content,
          actionUrl,
        });
      } else {
        unsubmittedCount++;
        const template = NotificationTemplates[NotificationType.bulk_reminder_unsubmitted](
          team.name,
          round.name,
          round.event.name,
          deadlineString,
          timeRemaining
        );
        await this.notificationService.createManyNotifications({
          userIds,
          eventId,
          type: NotificationType.bulk_reminder_unsubmitted,
          title: template.title,
          content: template.content,
          actionUrl,
        });
      }

      // Push email jobs to BullMQ mailQueue asynchronously with auto-delete on completion
      const emailPromises = members.map((member, idx) => 
        this.mailQueue.add(
          "send-email",
          {
            to: member.email,
            subject: `[${round.event.name}] Submission Reminder - Round ${round.name}`,
            content: `Reminder for team <strong>${team.name}</strong> regarding <strong>${round.name}</strong> deadline (${deadlineString}). Status: ${isSubmitted ? 'Submitted' : 'Pending'}.`,
            totalJobs: members.length,
            currentIndex: idx + 1,
          },
          { 
            attempts: 3, 
            backoff: { type: "exponential", delay: 1000 },
            removeOnComplete: true,
            removeOnFail: { count: 500 }
          }
        ).catch(error => this.logger?.error?.(`Failed to queue email for ${member.email}: ${error.message}`))
      );
      await Promise.all(emailPromises);
    });

    await Promise.all(promises);

    return {
      totalTeams: teamRounds.length,
      unsubmittedCount,
      submittedCount,
    };
  }
}
