import { createDemoTeams, disconnect } from "./_shared";

createDemoTeams()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(disconnect);
