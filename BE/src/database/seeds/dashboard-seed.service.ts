import { Injectable } from "@nestjs/common";
import {
  EventStatus,
  NotificationType,
  Role,
  RoundResultStatus,
  RoundStatus,
  Season,
  SubmissionStatus,
  SubmissionType,
  TeamMemberRole,
  TeamMemberStatus,
  TeamStatus,
} from "@prisma/client";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";

const DAY = 86_400_000;
const DEMO_PREFIX = "Dashboard Demo";

interface DashboardEventConfig {
  name: string;
  season: Season;
  year: number;
  status: EventStatus;
  createdAt: Date;
  registrationDeadline: Date;
  startDate: Date;
  endDate: Date;
}

@Injectable()
export class DashboardSeedService {
  constructor(private readonly prisma: PrismaService) {}

  async run() {
    console.log("--- Starting Organizer Dashboard Seeding ---");
    await this.cleanPreviousDashboardSeed();

    const passwordHash = await bcrypt.hash("12345678", 10);
    const organizer = await this.upsertUser(
      "organizer.dashboard@seal.local",
      "Dashboard Organizer",
      Role.organizer,
      passwordHash,
    );
    const students = await Promise.all(
      Array.from({ length: 18 }, (_, index) =>
        this.upsertStudent(index + 1, passwordHash),
      ),
    );
    const judges = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        this.upsertUser(
          `dashboard.judge${index + 1}@seal.local`,
          `Dashboard Judge ${index + 1}`,
          Role.stakeholder,
          passwordHash,
        ),
      ),
    );

    const now = new Date();
    const year = now.getUTCFullYear();
    const configs = this.buildEventConfigs(now, year);
    const events = [];

    for (let index = 0; index < configs.length; index++) {
      const event = await this.seedEvent(
        configs[index],
        organizer.id,
        students,
        judges,
        index,
      );
      events.push(event);
    }

    await this.seedReminderNotifications(events[0].id, students.slice(0, 8));

    console.log(`Dashboard organizer: ${organizer.email}`);
    console.log("Dashboard password: 12345678");
    console.log(`Created ${events.length} dashboard events.`);
    console.log("--- Organizer Dashboard Seeding Completed ---");
  }

  private async cleanPreviousDashboardSeed() {
    const previousEvents = await this.prisma.event.findMany({
      where: { name: { startsWith: DEMO_PREFIX } },
      select: { id: true },
    });
    const eventIds = previousEvents.map(({ id }) => id);
    if (!eventIds.length) return;

    await this.prisma.notification.deleteMany({
      where: { eventId: { in: eventIds } },
    });
    await this.prisma.event.deleteMany({ where: { id: { in: eventIds } } });
  }

  private upsertUser(
    email: string,
    name: string,
    role: Role,
    passwordHash: string,
  ) {
    return this.prisma.user.upsert({
      where: { email },
      update: { name, role, passwordHash, isActive: true },
      create: { email, name, role, passwordHash, isActive: true },
    });
  }

  private async upsertStudent(index: number, passwordHash: string) {
    const padded = String(index).padStart(2, "0");
    const user = await this.upsertUser(
      `dashboard.student${padded}@seal.local`,
      `Dashboard Student ${padded}`,
      Role.student,
      passwordHash,
    );
    await this.prisma.studentProfile.upsert({
      where: { userId: user.id },
      update: {
        studentType: "fpt",
        studentCode: `DB2026${padded}`,
        universityName: "FPT University",
      },
      create: {
        userId: user.id,
        studentType: "fpt",
        studentCode: `DB2026${padded}`,
        universityName: "FPT University",
      },
    });
    return user;
  }

  private buildEventConfigs(now: Date, year: number): DashboardEventConfig[] {
    const monthAgo = (months: number, day = 10) =>
      new Date(Date.UTC(year, now.getUTCMonth() - months, day, 8));
    return [
      {
        name: `${DEMO_PREFIX} - Ongoing Hackathon`,
        season: Season.Summer,
        year,
        status: EventStatus.ongoing,
        createdAt: monthAgo(2),
        registrationDeadline: new Date(now.getTime() - 15 * DAY),
        startDate: new Date(now.getTime() - 10 * DAY),
        endDate: new Date(now.getTime() + 10 * DAY),
      },
      {
        name: `${DEMO_PREFIX} - Registration Open`,
        season: Season.Summer,
        year,
        status: EventStatus.active,
        createdAt: monthAgo(1),
        registrationDeadline: new Date(now.getTime() + 12 * DAY),
        startDate: new Date(now.getTime() + 20 * DAY),
        endDate: new Date(now.getTime() + 25 * DAY),
      },
      {
        name: `${DEMO_PREFIX} - Upcoming Challenge`,
        season: Season.Fall,
        year,
        status: EventStatus.ongoing,
        createdAt: monthAgo(0, 2),
        registrationDeadline: new Date(now.getTime() + 20 * DAY),
        startDate: new Date(now.getTime() + 45 * DAY),
        endDate: new Date(now.getTime() + 50 * DAY),
      },
      {
        name: `${DEMO_PREFIX} - Completed Spring`,
        season: Season.Spring,
        year,
        status: EventStatus.closed,
        createdAt: monthAgo(5),
        registrationDeadline: new Date(now.getTime() - 100 * DAY),
        startDate: new Date(now.getTime() - 90 * DAY),
        endDate: new Date(now.getTime() - 85 * DAY),
      },
      {
        name: `${DEMO_PREFIX} - Draft Innovation Day`,
        season: Season.Fall,
        year,
        status: EventStatus.draft,
        createdAt: new Date(now.getTime() - 2 * DAY),
        registrationDeadline: new Date(now.getTime() + 50 * DAY),
        startDate: new Date(now.getTime() + 60 * DAY),
        endDate: new Date(now.getTime() + 62 * DAY),
      },
      {
        name: `${DEMO_PREFIX} - Previous Year Final`,
        season: Season.Fall,
        year: year - 1,
        status: EventStatus.closed,
        createdAt: new Date(Date.UTC(year - 1, 8, 1)),
        registrationDeadline: new Date(Date.UTC(year - 1, 8, 15)),
        startDate: new Date(Date.UTC(year - 1, 9, 1)),
        endDate: new Date(Date.UTC(year - 1, 9, 3)),
      },
    ];
  }

  private async seedEvent(
    config: DashboardEventConfig,
    organizerId: number,
    students: Array<{ id: number; email: string; name: string }>,
    judges: Array<{ id: number; email: string; name: string }>,
    eventIndex: number,
  ) {
    const event = await this.prisma.event.create({
      data: {
        ...config,
        description: "Seed data for Organizer Dashboard charts and KPIs.",
        location: "FPT University",
        createdById: organizerId,
      },
    });
    const tracks = await Promise.all(
      ["Software Solutions", "AI & Data"].map((name) =>
        this.prisma.track.create({
          data: {
            eventId: event.id,
            name,
            maxTeams: 10,
            maxMembersPerTeam: 4,
          },
        }),
      ),
    );
    const roundOne = await this.prisma.round.create({
      data: {
        eventId: event.id,
        roundNumber: 1,
        name: "Proposal Round",
        status:
          config.status === EventStatus.closed
            ? RoundStatus.results_published
            : RoundStatus.closed,
        submissionType: SubmissionType.file,
        submissionDeadline:
          config.status === EventStatus.closed
            ? new Date(config.endDate.getTime() - 2 * DAY)
            : new Date(Date.now() - DAY),
      },
    });
    const roundTwo = await this.prisma.round.create({
      data: {
        eventId: event.id,
        roundNumber: 2,
        name: "Final Submission",
        status:
          config.status === EventStatus.ongoing
            ? RoundStatus.open
            : RoundStatus.not_started,
        submissionType: SubmissionType.github_link,
        submissionDeadline:
          config.status === EventStatus.closed
            ? config.endDate
            : new Date(Date.now() + (eventIndex === 0 ? 1 : 7) * DAY),
      },
    });
    const criterion = await this.prisma.criterion.create({
      data: {
        name: "Overall Quality",
        description: "Dashboard seed evaluation criterion",
        maxScore: 10,
        weight: 1,
        roundId: roundOne.id,
        trackId: tracks[0].id,
        createdById: organizerId,
      },
    });

    await this.prisma.judgeAssignment.createMany({
      data: judges.slice(0, 2).map((judge) => ({
        judgeId: judge.id,
        roundId: roundOne.id,
        trackId: tracks[0].id,
        assignedById: organizerId,
      })),
      skipDuplicates: true,
    });

    const eventStudents = students.slice(0, 16);
    for (let index = 0; index < eventStudents.length; index++) {
      await this.prisma.studentRegistration.create({
        data: {
          userId: eventStudents[index].id,
          eventId: event.id,
          trackId: tracks[index % tracks.length].id,
          hasTeam: index < 12,
          createdAt: new Date(Date.now() - (index + eventIndex * 2) * DAY),
          reviewedById: index < 12 ? organizerId : null,
          reviewedAt:
            index < 12
              ? new Date(Date.now() - Math.max(1, index - 1) * DAY)
              : null,
        },
      });
    }

    for (let teamIndex = 0; teamIndex < 3; teamIndex++) {
      const members = students.slice(teamIndex * 4, teamIndex * 4 + 4);
      const status =
        eventIndex === 1 && teamIndex === 2
          ? TeamStatus.pending
          : TeamStatus.approved;
      const team = await this.prisma.team.create({
        data: {
          eventId: event.id,
          trackId: tracks[teamIndex % tracks.length].id,
          name: `${DEMO_PREFIX} Team ${eventIndex + 1}-${teamIndex + 1}`,
          status,
          leaderId: members[0].id,
          members: {
            create: members.map((member, memberIndex) => ({
              userId: member.id,
              role:
                memberIndex === 0
                  ? TeamMemberRole.leader
                  : TeamMemberRole.member,
              status: TeamMemberStatus.accepted,
              joinedAt: new Date(Date.now() - (10 - memberIndex) * DAY),
            })),
          },
        },
      });
      await this.prisma.teamRound.createMany({
        data: [
          {
            teamId: team.id,
            roundId: roundOne.id,
            status: RoundResultStatus.competing,
          },
          {
            teamId: team.id,
            roundId: roundTwo.id,
            status: RoundResultStatus.competing,
          },
        ],
      });

      if (teamIndex < 2 && status === TeamStatus.approved) {
        const deadline = roundOne.submissionDeadline ?? new Date();
        const submission = await this.prisma.submission.create({
          data: {
            teamId: team.id,
            roundId: roundOne.id,
            status:
              teamIndex === 0
                ? SubmissionStatus.valid
                : SubmissionStatus.under_review,
            fileUrl: `https://example.com/dashboard/team-${team.id}.pdf`,
            description: "Dashboard seed submission",
            submittedById: members[0].id,
            submittedAt: new Date(
              deadline.getTime() + (teamIndex === 0 ? -2 : 4) * 3_600_000,
            ),
          },
        });
        if (teamIndex === 0) {
          await this.prisma.score.create({
            data: {
              submissionId: submission.id,
              judgeId: judges[0].id,
              criterionId: criterion.id,
              scoreValue: 8 + (eventIndex % 2),
              comment: "Strong seeded submission",
            },
          });
        }
      }
    }

    return event;
  }

  private async seedReminderNotifications(
    eventId: number,
    students: Array<{ id: number }>,
  ) {
    await this.prisma.notification.createMany({
      data: students.map((student, index) => ({
        userId: student.id,
        eventId,
        type: NotificationType.deadline_reminder,
        title: "Dashboard demo deadline reminder",
        content: "The final submission deadline is approaching.",
        isRead: index % 3 === 0,
        isEmailSent: index % 2 === 0,
        sentAt: index % 2 === 0 ? new Date() : null,
      })),
    });
  }
}
