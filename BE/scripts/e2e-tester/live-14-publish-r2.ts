import { disconnect, publishRound2 } from "./_shared";

publishRound2()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(disconnect);
