import { Injectable, BadRequestException } from '@nestjs/common';
import { exec } from 'child_process';
import * as path from 'path';

const LEGACY_SCRIPTS: Record<string, { file: string; title: string }> = {
  '01-create-event': { file: 'scripts/e2e-tester/01-create-event.ts', title: '01. Create Event & Tracks' },
  '02-create-teams': { file: 'scripts/e2e-tester/02-create-teams.ts', title: '02. Create Teams & Members' },
  '03-assign-judges': { file: 'scripts/e2e-tester/03-assign-judges.ts', title: '03. Assign Judges & Mentors' },
  '04-generate-rubrics': { file: 'scripts/e2e-tester/04-generate-rubrics.ts', title: '04. Generate Rubrics' },
  '05-create-submissions': { file: 'scripts/e2e-tester/05-create-submissions.ts', title: '05. Create Submissions (R1)' },
  '06-score-round1': { file: 'scripts/e2e-tester/06-score-round1.ts', title: '06. Score Round 1' },
  '07-advance-to-round2': { file: 'scripts/e2e-tester/07-advance-to-round2.ts', title: '07. Advance to Round 2' },
  '08-create-submissions-round2': { file: 'scripts/e2e-tester/08-create-submissions-round2.ts', title: '08. Create Submissions (R2)' },
  '09-score-round2': { file: 'scripts/e2e-tester/09-score-round2.ts', title: '09. Score Round 2' },
};

const LIVE_DEMO_SCRIPTS: Record<string, { file: string; title: string }> = {
  'live-01-seed-users': { file: 'scripts/e2e-tester/live-01-seed-users.ts', title: 'Live 01. Seed Users' },
  'live-02-create-teams': { file: 'scripts/e2e-tester/live-02-create-teams.ts', title: 'Live 02. Create Pending Teams' },
  'live-03-approve-teams': { file: 'scripts/e2e-tester/live-03-approve-teams.ts', title: 'Live 03. Approve Teams' },
  'live-04-reveal-tracks': { file: 'scripts/e2e-tester/live-04-reveal-tracks.ts', title: 'Live 04. Reveal Tracks' },
  'live-05-assign-stakeholders': { file: 'scripts/e2e-tester/live-05-assign-stakeholders.ts', title: 'Live 05. Assign Mentor & Judges' },
  'live-06-setup-rubrics': { file: 'scripts/e2e-tester/live-06-setup-rubrics.ts', title: 'Live 06. Setup Rubrics' },
  'live-07-open-r1': { file: 'scripts/e2e-tester/live-07-open-r1.ts', title: 'Live 07. Open Round 1' },
  'live-08-submit-r1': { file: 'scripts/e2e-tester/live-08-submit-r1.ts', title: 'Live 08. Submit Round 1' },
  'live-09-score-r1': { file: 'scripts/e2e-tester/live-09-score-r1.ts', title: 'Live 09. Score Round 1' },
  'live-10-publish-r1': { file: 'scripts/e2e-tester/live-10-publish-r1.ts', title: 'Live 10. Publish Round 1' },
  'live-11-open-r2': { file: 'scripts/e2e-tester/live-11-open-r2.ts', title: 'Live 11. Open Round 2' },
  'live-12-submit-r2': { file: 'scripts/e2e-tester/live-12-submit-r2.ts', title: 'Live 12. Submit Round 2' },
  'live-13-score-r2': { file: 'scripts/e2e-tester/live-13-score-r2.ts', title: 'Live 13. Score Round 2' },
  'live-14-publish-r2': { file: 'scripts/e2e-tester/live-14-publish-r2.ts', title: 'Live 14. Publish Finals' },
};

export const E2E_SCRIPTS_MAP = { ...LEGACY_SCRIPTS, ...LIVE_DEMO_SCRIPTS };

@Injectable()
export class E2eTesterService {
  async runScript(scriptKey: string, eventId?: number): Promise<{ success: boolean; message: string; output: string }> {
    const targetScript = E2E_SCRIPTS_MAP[scriptKey];
    if (!targetScript) {
      throw new BadRequestException(`Invalid script key: "${scriptKey}". Allowed keys: ${Object.keys(E2E_SCRIPTS_MAP).join(', ')}`);
    }

    const scriptPath = path.resolve(process.cwd(), targetScript.file);
    const tsNodeRegister = path.resolve(process.cwd(), 'node_modules/ts-node/register/transpile-only.js');

    return new Promise((resolve) => {
      const env = { ...process.env };
      if (eventId) {
        env.TARGET_EVENT_ID = String(eventId);
      }

      const command = `"${process.execPath}" -r "${tsNodeRegister}" "${scriptPath}"`;
      exec(command, { cwd: process.cwd(), env, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        const fullOutput = (stdout + '\n' + stderr).trim();

        if (error) {
          console.error(`E2E Script [${scriptKey}] failed:`, fullOutput);
          return resolve({
            success: false,
            message: `Script ${targetScript.title} executed with errors`,
            output: fullOutput || error.message,
          });
        }

        return resolve({
          success: true,
          message: `Script ${targetScript.title} executed successfully!`,
          output: fullOutput,
        });
      });
    });
  }
}
