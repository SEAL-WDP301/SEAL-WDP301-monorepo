// chạy scripts
// npx ts-node scripts/e2e-tester/01-create-event.ts
// npx ts-node scripts/e2e-tester/02-assign-teams-and-submissions.ts


import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting 01-create-event.ts...");

    // Find an organizer/admin to be the creator
    const creator = await prisma.user.findFirst({
        where: { role: { in: ['organizer', 'admin'] } }
    });

    if (!creator) {
        console.error("No organizer or admin found. Please seed users first.");
        return;
    }

    // Prepare Event Data
    const eventName = `SEAL Hackathon ${new Date().getTime()}`;
    const newEvent = await prisma.event.create({
        data: {
            name: eventName,
            description: "A comprehensive hackathon event designed to push the boundaries of technology in AI and Web3.",
            season: 'Fall',
            year: 2026,
            status: 'active', // Active immediately to allow participation
            registrationDeadline: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000), // Deadline is in 7 days
            startDate: new Date(new Date().getTime() + 10 * 24 * 60 * 60 * 1000), // Event starts in 10 days
            endDate: new Date(new Date().getTime() + 24 * 24 * 60 * 60 * 1000), // Event ends in 24 days
            githubOrgUrl: 'https://github.com/DEMO-SEAL-HackaThon-ORG',
            location: JSON.stringify({"venueName":"FPT University Ho Chi Minh City","room":"Innovation Hall","address":"Lô E2a-7, Đường D1, Khu Công nghệ cao, TP. Thủ Đức, TP.HCM","meetingPlatform":"Google Meet","meetingUrl":"https://meet.google.com/abc-xyz-123","mapUrl":"https://maps.app.goo.gl/fpthcm","note":"Teams will receive detailed room allocation before the event day."}),
            contact: JSON.stringify([
              { type: "Email", value: "e2e-test@hackathon.com" },
              { type: "Website", value: "https://e2e-test.hackathon.com" }
            ]),
            rules: JSON.stringify([{"title":"Team Rules","rules":["Each team must follow the official team size configured for its track.","Participants must use their registered account and team workspace.","Team members are responsible for keeping project work original and transparent."]},{"title":"Submission Rules","rules":["Submit before the round deadline shown in the event workspace.","GitHub repositories or uploaded files must be accessible to organizers and judges.","Late, inaccessible, or incomplete submissions may not be evaluated."]},{"title":"Judging Rules","rules":["Projects are evaluated using the official rubric for each round.","Judge decisions are based on submitted work, presentation, and rule compliance.","Organizers may request clarification when submission evidence is unclear."]}]),
            faq: [{"answer": "Students who meet the event eligibility rules can register individually or as part of a team, depending on organizer settings.", "question": "Who can join this event?"}, {"answer": "Teams can update submissions while the round is still open. After the deadline, submissions are locked for evaluation.", "question": "Can a team update its submission?"}, {"answer": "Official announcements are posted in the event workspace and may also be sent through registered contact channels.", "question": "Where will announcements be posted?"}],
            prizes: {
                create: [
                    { name: '1st Prize', description: '$5,000 Cash + 10,000 AWS Credits', quantity: 1 },
                    { name: '2nd Prize', description: '$3,000 Cash + 5,000 AWS Credits', quantity: 1 },
                    { name: '3rd Prize', description: '$1,000 Cash + 2,000 AWS Credits', quantity: 1 },
                    { name: 'Honorable Mention', description: 'Exclusive Swag package + 1,000 AWS Credits', quantity: 1 },
                ]
            },
            createdById: creator.id,

            // Create Tracks
            tracks: {
                create: [
                    { name: 'AI & Data Track', description: 'Focus on AI, ML, Data Science', maxTeams: 50, maxMembersPerTeam: 5 },
                    { name: 'Web3 & Blockchain', description: 'Focus on decentralization', maxTeams: 50, maxMembersPerTeam: 5 }
                ]
            },
        },
        include: { tracks: true }
    });

    // Create Rounds
    // Round 1: Separate by track (isTrackSpecific: true)
    await prisma.round.create({
        data: {
            eventId: newEvent.id,
            roundNumber: 1,
            name: "Vòng Sơ loại (Round 1)",
            status: 'open',
            submissionType: 'file',
            submissionDeadline: new Date(new Date().getTime() + 14 * 24 * 60 * 60 * 1000), // +14 days
            maxFileSizeMb: 50, // 50 MB
            isTrackSpecific: true,
        }
    });

    // Round 2: Global (isTrackSpecific: false)
    await prisma.round.create({
        data: {
            eventId: newEvent.id,
            roundNumber: 2,
            name: "Vòng Chung kết (Round 2)",
            status: 'not_started',
            submissionType: 'github_link',
            submissionDeadline: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000), // +30 days
            maxFileSizeMb: 20,
            isTrackSpecific: false,
        }
    });

    console.log(`Event Created Successfully: ${eventName}`);
    console.log(`Event ID: ${newEvent.id}`);
    console.log(`Tracks: ${newEvent.tracks.map(t => t.name).join(', ')}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
