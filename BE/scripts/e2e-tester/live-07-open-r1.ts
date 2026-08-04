import { disconnect, openRound1 } from "./_shared";

openRound1()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(disconnect);
