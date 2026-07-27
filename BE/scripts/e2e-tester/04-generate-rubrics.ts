import { PrismaClient } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting 04-generate-rubrics.ts...");

    // Muốn chạy cho 1 Event cụ thể? Bỏ comment dòng dưới và điền ID (VD: 42)
    const TARGET_EVENT_ID: number | null = null; 

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

    const organizer = await prisma.user.findFirst({
        where: { role: { in: ['organizer', 'admin'] } }
    });

    const track1 = latestEvent.tracks[0];
    const track2 = latestEvent.tracks[1];
    const round1 = latestEvent.rounds.find(r => r.roundNumber === 1)!;
    const round2 = latestEvent.rounds.find(r => r.roundNumber === 2)!;

    const workbookAllTracks = new ExcelJS.Workbook();
    const sheetAllTracks = workbookAllTracks.addWorksheet('Rubrics');
    
    const workbookSpecificTracks = new ExcelJS.Workbook();
    const sheetSpecificTracks = workbookSpecificTracks.addWorksheet('Rubrics');

    const columns = [
        { header: 'Track*', key: 'track', width: 20 },
        { header: 'Rubric Name*', key: 'name', width: 30 },
        { header: 'Description', key: 'description', width: 50 },
        { header: 'Max Score*', key: 'maxScore', width: 15 },
        { header: 'Weight*', key: 'weight', width: 15 }
    ];

    sheetAllTracks.columns = columns;
    sheetSpecificTracks.columns = columns;

    const rubricsData = [
        // Track 1 (Round 1)
        { track: track1.name, name: 'Innovation & Originality', desc: 'Is the idea new?', max: 20, w: 1, roundId: round1.id, trackId: track1.id },
        { track: track1.name, name: 'Technical Complexity', desc: 'Is the technical solution challenging?', max: 30, w: 1.5, roundId: round1.id, trackId: track1.id },
        { track: track1.name, name: 'Business Value', desc: 'Can it be monetized?', max: 20, w: 1, roundId: round1.id, trackId: track1.id },
        { track: track1.name, name: 'UI/UX Design', desc: 'Is it user friendly?', max: 15, w: 1, roundId: round1.id, trackId: track1.id },
        { track: track1.name, name: 'Presentation Quality', desc: 'How well did they present?', max: 15, w: 1, roundId: round1.id, trackId: track1.id },
        
        // Track 2 (Round 1)
        { track: track2.name, name: 'Decentralization Level', desc: 'How decentralized is it?', max: 25, w: 1.2, roundId: round1.id, trackId: track2.id },
        { track: track2.name, name: 'Smart Contract Security', desc: 'Are the contracts safe?', max: 25, w: 1.5, roundId: round1.id, trackId: track2.id },
        { track: track2.name, name: 'Real-world Application', desc: 'Can it be used today?', max: 20, w: 1, roundId: round1.id, trackId: track2.id },
        { track: track2.name, name: 'Scalability', desc: 'Can it handle high TPS?', max: 15, w: 1, roundId: round1.id, trackId: track2.id },
        { track: track2.name, name: 'Demo Completeness', desc: 'Is the demo working?', max: 15, w: 1, roundId: round1.id, trackId: track2.id },

        // Global (Round 2)
        { track: 'All Tracks', name: 'Global Impact', desc: 'Impact on humanity', max: 40, w: 2, roundId: round2.id, trackId: null },
        { track: 'All Tracks', name: 'Investment Readiness', desc: 'Ready for seed round?', max: 30, w: 1.5, roundId: round2.id, trackId: null },
        { track: 'All Tracks', name: 'Technical Mastery', desc: 'Architecture quality', max: 20, w: 1, roundId: round2.id, trackId: null },
        { track: 'All Tracks', name: 'Team Synergy', desc: 'How well the team works', max: 10, w: 0.5, roundId: round2.id, trackId: null }
    ];

    const outDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    for (const data of rubricsData) {
        // Add to Excel
        const row = {
            track: data.track,
            name: data.name,
            description: data.desc,
            maxScore: data.max,
            weight: data.w
        };

        if (data.track === 'All Tracks') {
            sheetAllTracks.addRow(row);
        } else {
            sheetSpecificTracks.addRow(row);
        }

        // Add to DB (Idempotent)
        const existingCriterion = await prisma.criterion.findFirst({
            where: { name: data.name, roundId: data.roundId, trackId: data.trackId }
        });

        if (!existingCriterion) {
            await prisma.criterion.create({
                data: {
                    name: data.name,
                    description: data.desc,
                    maxScore: data.max,
                    weight: data.w,
                    roundId: data.roundId,
                    trackId: data.trackId,
                    createdById: organizer!.id
                }
            });
            console.log(`Inserted Criterion: ${data.name}`);
        } else {
            console.log(`Criterion already exists: ${data.name}`);
        }
    }

    const filePathAll = path.join(outDir, 'rubrics_import_all_tracks.xlsx');
    const filePathSpecific = path.join(outDir, 'rubrics_import_specific_tracks.xlsx');
    
    await workbookAllTracks.xlsx.writeFile(filePathAll);
    await workbookSpecificTracks.xlsx.writeFile(filePathSpecific);
    
    console.log(`Successfully generated rubrics Excel files at:`);
    console.log(` - ${filePathAll}`);
    console.log(` - ${filePathSpecific}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
