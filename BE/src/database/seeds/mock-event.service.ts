import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  Role,
  Season,
  EventStatus,
  SubmissionType,
  TeamStatus,
  TeamMemberRole,
} from "@prisma/client";

@Injectable()
export class MockEventService {
  constructor(private readonly prisma: PrismaService) {}

  async run() {
    console.log("--- Starting Mock Event Seeding ---");
    const adminEmail = "admin@gmail.com";
    let adminUser = await this.prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!adminUser) {
      console.error(
        "Admin user not found. Please run 'npm run seed:run' first to create Admin.",
      );
      return;
    }

    // Create Event
    const event = await this.prisma.event.create({
      data: {
        name: "FPT Hackathon 2026",
        description: "Giải đấu Hackathon lớn nhất 2026 dành cho sinh viên IT trên toàn quốc. Thử thách giải quyết các vấn đề thực tiễn bằng công nghệ AI và Web3.",
        imageUrl: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&q=80&w=2070",
        season: Season.Spring,
        year: 2026,
        status: EventStatus.active,
        registrationDeadline: new Date(new Date().getTime() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
        startDate: new Date(new Date().getTime() + 20 * 24 * 60 * 60 * 1000), // 20 days from now
        endDate: new Date(new Date().getTime() + 22 * 24 * 60 * 60 * 1000), // 22 days from now
        githubOrgUrl: "https://github.com/fpt-hackathon-2026",
        location: "Đại học FPT, Khu CNC Hòa Lạc, Hà Nội",
        contact: JSON.stringify([
          { type: "Email", value: "hackathon@fpt.edu.vn" },
          { type: "Phone", value: "024 1234 5678" },
          { type: "Website", value: "https://fpt.edu.vn" }
        ]),
        rules: JSON.stringify([
          { title: "General Eligibility", itemsText: "Must be a university student.\nEach team can have 3-4 members.\nParticipants must follow the code of conduct." },
          { title: "Project Requirements", itemsText: "Code must be written during the hackathon.\nAll projects must be open source.\nTeams must submit a short video demo." }
        ]),
        faq: [
          { question: "Is this event free?", answer: "Yes, participation is 100% free for all university students." },
          { question: "Do I need a team?", answer: "You can register individually, and we will help you find a team during the team-matching phase." }
        ],
        createdById: adminUser.id,
        tracks: {
          create: [
            {
              name: "Web Development",
              description: "Xây dựng ứng dụng Web",
              maxTeams: 50,
              maxMembersPerTeam: 4,
            },
            {
              name: "AI Solutions",
              description: "Giải pháp ứng dụng Trí tuệ nhân tạo",
              maxTeams: 50,
              maxMembersPerTeam: 4,
            },
          ],
        },
        rounds: {
          create: [
            {
              roundNumber: 1,
              name: "Idea Pitching",
              submissionType: SubmissionType.file,
            },
            {
              roundNumber: 2,
              name: "Final Demo",
              submissionType: SubmissionType.github_link,
            },
          ],
        },
        prizes: {
          create: [
            { name: "First Prize", quantity: 1 },
            { name: "Second Prize", quantity: 1 },
            { name: "Third Prize", quantity: 1 },
            { name: "Honorable Mention", quantity: 1 },
          ],
        },
      },
      include: { tracks: true, prizes: true },
    });

    console.log(`[Event] Created event: ${event.name}`);

    // Get existing students
    const students = await this.prisma.user.findMany({
      where: { role: Role.student, isActive: true },
    });

    if (students.length === 0) {
      console.error(
        "No student users found in the database. Please create some students manually first.",
      );
      return;
    }

    const tracks = event.tracks;
    let studentIndex = 0;

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      // Create 2 Teams per track
      for (let t = 1; t <= 2; t++) {
        if (studentIndex >= students.length) break;

        const teamName = `Team ${track.name.split(" ")[0]} ${t}`;

        // Take up to 3 students per team
        const members = [];
        for (let m = 1; m <= 3; m++) {
          if (studentIndex < students.length) {
            members.push(students[studentIndex]);
            studentIndex++;
          }
        }

        if (members.length === 0) break;

        // Upsert registrations
        for (const u of members) {
          await this.prisma.studentRegistration.upsert({
            where: { userId_eventId: { userId: u.id, eventId: event.id } },
            update: { trackId: track.id, hasTeam: true },
            create: {
              userId: u.id,
              eventId: event.id,
              trackId: track.id,
              hasTeam: true,
            },
          });
        }

        // Create Team
        await this.prisma.team.create({
          data: {
            eventId: event.id,
            trackId: track.id,
            name: teamName,
            status: TeamStatus.approved,
            leaderId: members[0].id,
            members: {
              create: members.map((u, index) => ({
                userId: u.id,
                role:
                  index === 0 ? TeamMemberRole.leader : TeamMemberRole.member,
              })),
            },
          },
        });
        console.log(
          `[Team] Created team: ${teamName} in track ${track.name} with ${members.length} members.`,
        );
      }
    }

    console.log("--- Mock Event Seeding Completed ---");
  }
}
