import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting 09-score-round2.ts...");

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



    // 3. Score Round 2 Submissions
    const assignments = await prisma.judgeAssignment.findMany({
        where: { roundId: round2.id, trackId: null },
        include: { judge: true }
    });

    if (assignments.length === 0) {
        console.error("No judges assigned to Round 2. Please run 03-assign-judges.ts first.");
        return;
    }

    const submissions = await prisma.submission.findMany({
        where: { roundId: round2.id }
    });

    const criteria = await prisma.criterion.findMany({
        where: { roundId: round2.id, trackId: null }
    });

    if (criteria.length === 0) {
        console.error("No criteria found for Round 2. Run 04-generate-rubrics.ts first.");
        return;
    }

    for (const sub of submissions) {
        for (const assignment of assignments) {
            for (const crit of criteria) {
                // Idempotency check
                const existingScore = await prisma.score.findFirst({
                    where: {
                        submissionId: sub.id,
                        judgeId: assignment.judgeId,
                        criterionId: crit.id
                    }
                });

                if (existingScore) {
                    console.log(`Judge ${assignment.judge.email} already scored Team ${sub.teamId} on criterion '${crit.name}' in R2. Skipping.`);
                    continue;
                }

                const randomScore = Math.floor(Math.random() * (crit.maxScore + 1));
                
                await prisma.score.create({
                    data: {
                        submissionId: sub.id,
                        judgeId: assignment.judgeId,
                        criterionId: crit.id,
                        scoreValue: randomScore,
                        comment: `Final Round automated feedback: Score ${randomScore}/${crit.maxScore}`
                    }
                });
                console.log(`Judge ${assignment.judge.email} scored Team ${sub.teamId} on '${crit.name}': ${randomScore} (R2)`);
            }
        }
    }

    // Vote for top 4 submissions with highest score from each judge
    for (const assignment of assignments) {
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
                console.log(`Judge ${assignment.judge.email} voted for Team ${topSub.teamId} in R2 (Score: ${topSub.totalScore})`);
            } else {
                console.log(`Judge ${assignment.judge.email} already voted for Team ${topSub.teamId} in R2. Skipping.`);
            }
        }
    }

    console.log("Successfully scored Round 2.");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
