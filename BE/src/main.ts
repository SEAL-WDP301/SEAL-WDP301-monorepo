import { bootstrap } from "./bootstrap";

/**
 * main.ts — Application entry point.
 * Delegates all setup to bootstrap() for separation of concerns and testability.
 */
bootstrap().catch((error) => {
  console.error("❌ Failed to start SEAL API:", error);
  process.exit(1);
});
