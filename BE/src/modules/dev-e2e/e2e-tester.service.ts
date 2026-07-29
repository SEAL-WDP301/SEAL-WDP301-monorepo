import { Injectable, BadRequestException } from '@nestjs/common';
import { exec } from 'child_process';
import * as path from 'path';

export const E2E_SCRIPTS_MAP: Record<string, { file: string; title: string }> = {
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

@Injectable()
export class E2eTesterService {
  async runScript(scriptKey: string, eventId?: number): Promise<{ success: boolean; message: string; output: string }> {
    const targetScript = E2E_SCRIPTS_MAP[scriptKey];
    if (!targetScript) {
      throw new BadRequestException(`Invalid script key: "${scriptKey}". Allowed keys: ${Object.keys(E2E_SCRIPTS_MAP).join(', ')}`);
    }

    const scriptPath = path.resolve(process.cwd(), targetScript.file);

    return new Promise((resolve) => {
      const env = { ...process.env };
      if (eventId) {
        env.TARGET_EVENT_ID = String(eventId);
      }

      // Run script via npx -y ts-node
      const command = `npx -y ts-node "${scriptPath}"`;
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
