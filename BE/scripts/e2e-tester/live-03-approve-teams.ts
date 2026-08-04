import { approveTeams, disconnect } from "./_shared";

approveTeams()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(disconnect);
