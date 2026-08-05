import { openRound1, submitRound1, runScriptMain } from "./_shared";

runScriptMain(async () => {
  await openRound1();
  await submitRound1();
});
