import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting 05-create-submissions.ts...");

    // Muốn chạy cho 1 Event cụ thể? Bỏ comment dòng dưới và điền ID (VD: 42)
    const TARGET_EVENT_ID: number | null = null; 

    // 1. Get the latest active event
    const latestEvent = await prisma.event.findFirst({
        where: TARGET_EVENT_ID 
            ? { id: TARGET_EVENT_ID } 
            : { status: { in: ['active', 'ongoing'] } },
        orderBy: { createdAt: 'desc' },
        include: { rounds: { where: { roundNumber: 1 } } }
    });

    if (!latestEvent || latestEvent.rounds.length === 0) {
        console.error("No active event with round 1 found. Run 01-create-event.ts first.");
        return;
    }

    const round1 = latestEvent.rounds[0];

    // 2. Find approved teams for this event
    const approvedTeams = await prisma.team.findMany({
        where: { 
            eventId: latestEvent.id,
            status: 'approved'
        }
    });

    if (approvedTeams.length === 0) {
        console.error("No approved teams found. Please approve teams in the admin panel first.");
        return;
    }

    for (const team of approvedTeams) {
        // Idempotency check: Does team already have a submission?
        const existingSubmission = await prisma.submission.findFirst({
            where: {
                teamId: team.id,
                roundId: round1.id
            }
        });

        if (existingSubmission) {
            console.log(`Team ${team.name} already has a submission. Skipping.`);
            continue;
        }


        // Create Submission for Round 1
        await prisma.submission.create({
            data: {
                teamId: team.id,
                roundId: round1.id,
                status: 'submitted',
                fileUrl: 'https://example.com/dummy-submission.pdf',
                submittedById: team.leaderId,
                description: `E2E submission for ${team.name}`
            }
        });

        console.log(`Created Submission for Team '${team.name}'.`);
    }

    console.log("Successfully created submissions for all approved teams.");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
