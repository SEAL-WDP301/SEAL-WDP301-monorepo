import { approveTeams, createDemoTeams, disconnect } from "./_shared";

createDemoTeams()
  .then(() => approveTeams())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(disconnect);
