import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting 06-score-round1.ts...");

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
    if (!round1) {
        console.error("Round 1 not found.");
        return;
    }

    // Get all judge assignments for Round 1
    const assignments = await prisma.judgeAssignment.findMany({
        where: { roundId: round1.id },
        include: { judge: true }
    });

    if (assignments.length === 0) {
        console.error("No judges assigned to Round 1. Please run 03-assign-judges.ts first.");
        return;
    }

    for (const assignment of assignments) {
        if (!assignment.trackId) continue; // Round 1 is track-specific

        // Find all submissions in this track for Round 1
        const submissions = await prisma.submission.findMany({
            where: {
                roundId: round1.id,
                team: { trackId: assignment.trackId }
            }
        });

        // Find criteria for this track in Round 1
        const criteria = await prisma.criterion.findMany({
            where: {
                roundId: round1.id,
                trackId: assignment.trackId
            }
        });

        if (criteria.length === 0) {
            console.error(`No criteria found for track ID ${assignment.trackId}. Run 04-generate-rubrics.ts first.`);
            continue;
        }

        for (const sub of submissions) {
            for (const crit of criteria) {
                // Idempotency: Has this judge already scored this submission for this criterion?
                const existingScore = await prisma.score.findFirst({
                    where: {
                        submissionId: sub.id,
                        judgeId: assignment.judgeId,
                        criterionId: crit.id
                    }
                });

                if (existingScore) {
                    console.log(`Judge ${assignment.judge.email} already scored Team ${sub.teamId} on criterion '${crit.name}'. Skipping.`);
                    continue;
                }

                // Generate random score between 0 and maxScore
                const randomScore = Math.floor(Math.random() * (crit.maxScore + 1));
                
                await prisma.score.create({
                    data: {
                        submissionId: sub.id,
                        judgeId: assignment.judgeId,
                        criterionId: crit.id,
                        scoreValue: randomScore,
                        comment: `Automated testing feedback: Score ${randomScore}/${crit.maxScore}`
                    }
                });
                console.log(`Judge ${assignment.judge.email} scored Team ${sub.teamId} on '${crit.name}': ${randomScore}`);
            }
        }

        // Vote for top 4 submissions with highest score from this judge
        const submissionsWithScores = [];
        for (const sub of submissions) {
            const judgeScores = await prisma.score.findMany({
                where: { submissionId: sub.id, judgeId: assignment.judgeId }
            });
            if (judgeScores.length > 0) {
                const totalScore = judgeScores.reduce((sum, s) => sum + Number(s.scoreValue), 0);
                submissionsWithScores.push({ submissionId: sub.id, totalScore, teamId: sub.teamId });
            }
        }

        submissionsWithScores.sort((a, b) => b.totalScore - a.totalScore);
        
        // Vote for top 20% or any logic, but since user said free, we can just vote for the top 2
        // Just as a simulation
        const topToVote = submissionsWithScores.slice(0, Math.max(2, Math.floor(submissionsWithScores.length / 3)));

        for (const topSub of topToVote) {
            const existingVote = await prisma.judgeVote.findFirst({
                where: { submissionId: topSub.submissionId, judgeId: assignment.judgeId }
            });
            if (!existingVote) {
                await prisma.judgeVote.create({
                    data: {
                        submissionId: topSub.submissionId,
                        judgeId: assignment.judgeId
                    }
                });
                console.log(`Judge ${assignment.judge.email} voted for Team ${topSub.teamId} (Score: ${topSub.totalScore})`);
            } else {
                console.log(`Judge ${assignment.judge.email} already voted for Team ${topSub.teamId}. Skipping.`);
            }
        }
    }

    console.log("Successfully scored Round 1.");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
