import { disconnect, scoreRound1 } from "./_shared";

scoreRound1()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(disconnect);
