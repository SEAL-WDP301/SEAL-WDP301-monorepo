import { disconnect, publishRound1 } from "./_shared";

publishRound1()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(disconnect);
