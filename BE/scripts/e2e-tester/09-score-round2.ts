import { scoreRound2, publishRound2, runScriptMain } from "./_shared";

runScriptMain(async () => {
  await scoreRound2();
  await publishRound2();
});
