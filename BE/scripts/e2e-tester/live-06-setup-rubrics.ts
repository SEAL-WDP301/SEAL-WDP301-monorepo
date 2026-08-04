import { disconnect, setupRubrics } from "./_shared";

setupRubrics()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(disconnect);
