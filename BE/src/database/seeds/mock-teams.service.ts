import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Role, TeamStatus, TeamMemberRole } from "@prisma/client";

@Injectable()
export class MockTeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async run(eventId: number) {
    console.log(`--- Starting Mock Teams Seeding for Event ID: ${eventId} ---`);

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { tracks: true },
    });

    if (!event) {
      console.error(`[Error] Event with ID ${eventId} not found.`);
      return;
    }

    if (event.tracks.length === 0) {
      console.error(
        `[Error] Event ID ${eventId} has no tracks. Cannot assign teams.`,
      );
      return;
    }

    const students = await this.prisma.user.findMany({
      where: { role: Role.student, isActive: true },
    });

    if (students.length === 0) {
      console.error(
        "No student users found in the database. Please create some students first.",
      );
      return;
    }

    // Get existing team members for this event so we don't reuse students already in a team
    const existingMembers = await this.prisma.teamMember.findMany({
      where: { team: { eventId: event.id } },
      select: { userId: true },
    });
    const existingMemberIds = new Set(existingMembers.map((m) => m.userId));

    const availableStudents = students.filter(
      (s) => !existingMemberIds.has(s.id),
    );

    if (availableStudents.length === 0) {
      console.log(
        "All existing students are already in a team for this event. No new teams created.",
      );
      return;
    }

    let studentIndex = 0;
    const timeHash = Date.now().toString().slice(-4); // to ensure unique team names

    for (const track of event.tracks) {
      // Create 2 Teams per track
      for (let t = 1; t <= 2; t++) {
        if (studentIndex >= availableStudents.length) break;

        const teamName = `Team Mock ${timeHash} ${track.id}-${t}`;

        // Take up to 3 students per team
        const members = [];
        for (let m = 1; m <= 3; m++) {
          if (studentIndex < availableStudents.length) {
            members.push(availableStudents[studentIndex]);
            studentIndex++;
          }
        }

        if (members.length === 0) break;

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
          `[Team] Created team: ${teamName} in track ID ${track.id} with ${members.length} members.`,
        );
      }
    }

    console.log("--- Mock Teams Seeding Completed ---");
  }
}
