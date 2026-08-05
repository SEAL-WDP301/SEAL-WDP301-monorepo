import { publishRound1, openRound2, runScriptMain } from "./_shared";

runScriptMain(async () => {
  await publishRound1();
  await openRound2();
});
