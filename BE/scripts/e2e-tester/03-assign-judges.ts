import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting 03-assign-judges.ts...");

    // Muốn chạy cho 1 Event cụ thể? Bỏ comment dòng dưới và điền ID (VD: 42)
    const TARGET_EVENT_ID: number | null = null; 

    // 1. Get the latest active event and its tracks & rounds
    const latestEvent = await prisma.event.findFirst({
        where: TARGET_EVENT_ID 
            ? { id: TARGET_EVENT_ID } 
            : { status: { in: ['active', 'ongoing'] } },
        orderBy: { createdAt: 'desc' },
        include: { tracks: true, rounds: true }
    });

    if (!latestEvent || latestEvent.tracks.length < 2 || latestEvent.rounds.length < 2) {
        console.error("Incomplete event setup. Please run 01-create-event.ts first.");
        return;
    }

    const track1 = latestEvent.tracks[0];
    const track2 = latestEvent.tracks[1];
    const round1 = latestEvent.rounds.find(r => r.roundNumber === 1)!;
    const round2 = latestEvent.rounds.find(r => r.roundNumber === 2)!;

    // Find organizer
    const organizer = await prisma.user.findFirst({
        where: { role: { in: ['organizer', 'admin'] } }
    });

    // 2. Find judges (emails starting with judge)
    const judges = await prisma.user.findMany({
        where: { 
            email: { startsWith: 'judge' },
            role: 'stakeholder'
        }
    });

    if (judges.length === 0) {
        console.error("No judges found (email starting with 'judge'). Please seed some judges first.");
        return;
    }

    let trackToggle = true;

    for (const judge of judges) {
        // Assign to Round 1 (Track Specific)
        const assignedTrack = trackToggle ? track2 : track1;
        trackToggle = !trackToggle;

        const existingR1Assignment = await prisma.judgeAssignment.findFirst({
            where: { judgeId: judge.id, roundId: round1.id, trackId: assignedTrack.id }
        });

        if (!existingR1Assignment) {
            await prisma.judgeAssignment.create({
                data: {
                    judgeId: judge.id,
                    roundId: round1.id,
                    trackId: assignedTrack.id,
                    assignedById: organizer!.id
                }
            });
            console.log(`Assigned Judge ${judge.email} to Round 1 - Track '${assignedTrack.name}'`);
        } else {
            console.log(`Judge ${judge.email} already assigned to Round 1 - Track '${assignedTrack.name}'.`);
        }

        // Assign to Round 2 (Global - trackId: null)
        const existingR2Assignment = await prisma.judgeAssignment.findFirst({
            where: { judgeId: judge.id, roundId: round2.id, trackId: null }
        });

        if (!existingR2Assignment) {
            await prisma.judgeAssignment.create({
                data: {
                    judgeId: judge.id,
                    roundId: round2.id,
                    trackId: null,
                    assignedById: organizer!.id
                }
            });
            console.log(`Assigned Judge ${judge.email} to Round 2 (Global).`);
        } else {
            console.log(`Judge ${judge.email} already assigned to Round 2.`);
        }
    }

    console.log("Successfully assigned judges.");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
