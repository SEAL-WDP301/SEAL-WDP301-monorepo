import { approveTeams, createDemoTeams, runScriptMain } from "./_shared";

runScriptMain(async () => {
  await createDemoTeams();
  await approveTeams();
});
