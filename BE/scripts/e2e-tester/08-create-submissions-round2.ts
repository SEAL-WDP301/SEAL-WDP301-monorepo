import { PrismaClient } from '@prisma/client';
import * as process from 'process';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting 08-create-submissions-round2.ts...");

    // Muốn chạy cho 1 Event cụ thể? Bỏ comment dòng dưới và điền ID (VD: 42)
    const TARGET_EVENT_ID: number | null = null; 

    const latestEvent = await prisma.event.findFirst({
        where: TARGET_EVENT_ID 
            ? { id: TARGET_EVENT_ID } 
            : { status: { in: ['active', 'ongoing'] } },
        orderBy: { createdAt: 'desc' },
        include: { rounds: true }
    });

    if (!latestEvent) {
        console.error("No active event found.");
        return;
    }

    const round2 = latestEvent.rounds.find(r => r.roundNumber === 2);

    if (!round2) {
        console.error("Missing Round 2.");
        return;
    }

    // Get all teams currently competing in Round 2
    const teamsInRound2 = await prisma.teamRound.findMany({
        where: { roundId: round2.id, status: 'competing' },
        include: { team: true }
    });

    if (teamsInRound2.length === 0) {
        console.error("No teams found in Round 2. Please run 07-advance-to-round2.ts first.");
        return;
    }

    for (const teamRound of teamsInRound2) {
        // Idempotency: is there already a submission for this team in Round 2?
        const existingSub = await prisma.submission.findFirst({
            where: { teamId: teamRound.teamId, roundId: round2.id }
        });

        if (!existingSub) {
            await prisma.submission.create({
                data: {
                    teamId: teamRound.teamId,
                    roundId: round2.id,
                    status: 'submitted',
                    githubUrl: 'https://github.com/dummy/repo',
                    submittedById: teamRound.team.leaderId,
                    description: `Final presentation codebase for ${teamRound.team.name}`
                }
            });
            console.log(`Created GitHub Submission for Team '${teamRound.team.name}' in Round 2.`);
        } else {
            console.log(`Team '${teamRound.team.name}' already has a submission in Round 2. Skipping.`);
        }
    }

    console.log("Successfully created submissions for Round 2.");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
