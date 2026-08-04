import { disconnect, revealTracks } from "./_shared";

revealTracks()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(disconnect);
