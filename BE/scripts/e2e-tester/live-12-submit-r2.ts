import { disconnect, submitRound2 } from "./_shared";

submitRound2()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(disconnect);
