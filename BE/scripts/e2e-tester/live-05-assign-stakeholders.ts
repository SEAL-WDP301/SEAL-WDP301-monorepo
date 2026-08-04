import { assignStakeholders, disconnect } from "./_shared";

assignStakeholders()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(disconnect);
