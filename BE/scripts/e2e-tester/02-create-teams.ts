import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting 02-create-teams.ts...");

    // Muốn chạy cho 1 Event cụ thể? Bỏ comment dòng dưới và điền ID (VD: 42)
    const TARGET_EVENT_ID: number | null = null; 

    // 1. Get the latest active event
    const latestEvent = await prisma.event.findFirst({
        where: TARGET_EVENT_ID 
            ? { id: TARGET_EVENT_ID } 
            : { status: { in: ['active', 'ongoing'] } },
        orderBy: { createdAt: 'desc' },
        include: { tracks: true, rounds: { where: { roundNumber: 1 } } }
    });

    if (!latestEvent || latestEvent.tracks.length < 2) {
        console.error("No active event with at least 2 tracks found. Run 01-create-event.ts first.");
        return;
    }

    const track1 = latestEvent.tracks[0];
    const track2 = latestEvent.tracks[1];
    const round1 = latestEvent.rounds[0];

    // 2. Find students
    const students = await prisma.user.findMany({
        where: { role: 'student' },
        take: 10 // Take up to 10 students for testing
    });

    if (students.length === 0) {
        console.error("No students found in the database.");
        return;
    }

    const TEAM_NAMES = [
        "ChickenWinner",
        "Hacker Lords",
        "Code Crushers",
        "Byte Warriors",
        "Null Pointers",
        "Bug Hunters",
        "Stack Smashers",
        "Syntax Squad",
        "Binary Beasts",
        "Dev Dominators",
    ];

    let trackToggle = true;

    for (let i = 0; i < students.length; i++) {
        const student = students[i];
        // Idempotency check: Does student already have a team in this event?
        const existingMember = await prisma.teamMember.findFirst({
            where: {
                userId: student.id,
                team: { eventId: latestEvent.id }
            }
        });

        if (existingMember) {
            console.log(`Student ${student.name} is already in a team for this event. Skipping.`);
            continue;
        }

        const assignedTrack = trackToggle ? track2 : track1;
        trackToggle = !trackToggle;

        // Create Team
        const teamName = TEAM_NAMES[i % TEAM_NAMES.length];
        const team = await prisma.team.create({
            data: {
                name: teamName,
                eventId: latestEvent.id,
                trackId: assignedTrack.id,
                status: 'pending', // Waiting for admin approval
                leaderId: student.id,
                members: {
                    create: {
                        userId: student.id,
                        role: 'leader',
                        status: 'accepted'
                    }
                }
            }
        });

        // Register to Round 1 so they show up in the Admin's Round Workspace Teams list
        await prisma.teamRound.create({
            data: {
                teamId: team.id,
                roundId: round1.id,
                status: 'competing'
            }
        });

        console.log(`Created Team '${teamName}' for Track '${assignedTrack.name}' in pending status.`);
    }

    console.log("Successfully created teams in pending status.");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
