import { disconnect, seedUsers } from "./_shared";

seedUsers()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(disconnect);
