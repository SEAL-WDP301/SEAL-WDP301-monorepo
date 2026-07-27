import { PrismaClient } from '@prisma/client';
import * as process from 'process';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting 07-advance-to-round2.ts...");

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

    const round1 = latestEvent.rounds.find(r => r.roundNumber === 1);
    const round2 = latestEvent.rounds.find(r => r.roundNumber === 2);

    if (!round1 || !round2) {
        console.error("Missing Round 1 or Round 2.");
        return;
    }

    // 1. Progress Event State
    if (round1.status !== 'results_published') {
        await prisma.round.update({
            where: { id: round1.id },
            data: { status: 'results_published' }
        });
        console.log("Round 1 status updated to 'results_published'.");
    }

    if (round2.status !== 'open') {
        await prisma.round.update({
            where: { id: round2.id },
            data: { status: 'open' }
        });
        console.log("Round 2 status updated to 'open'.");
    }

    // 2. Promote all teams from Round 1 to Round 2 (mock behavior)
    const teamsInRound1 = await prisma.teamRound.findMany({
        where: { roundId: round1.id },
        include: { team: true }
    });

    for (const teamRound of teamsInRound1) {
        // Idempotency: is team already in Round 2?
        const existingR2 = await prisma.teamRound.findFirst({
            where: { teamId: teamRound.teamId, roundId: round2.id }
        });

        if (!existingR2) {
            await prisma.teamRound.create({
                data: {
                    teamId: teamRound.teamId,
                    roundId: round2.id,
                    status: 'competing'
                }
            });
            console.log(`Promoted Team '${teamRound.team.name}' to Round 2.`);
        }
    }

    console.log("Successfully advanced teams to Round 2.");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
