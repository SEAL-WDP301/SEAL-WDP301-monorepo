import { disconnect, submitRound1 } from "./_shared";

submitRound1()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(disconnect);
