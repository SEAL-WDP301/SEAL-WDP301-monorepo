import { disconnect, openRound2 } from "./_shared";

openRound2()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(disconnect);
