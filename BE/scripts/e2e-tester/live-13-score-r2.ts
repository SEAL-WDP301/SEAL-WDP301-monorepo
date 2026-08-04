import { disconnect, scoreRound2 } from "./_shared";

scoreRound2()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(disconnect);
