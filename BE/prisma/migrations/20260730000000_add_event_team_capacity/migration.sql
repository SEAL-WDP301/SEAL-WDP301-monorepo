ALTER TABLE "events" ADD COLUMN "max_teams" INTEGER;

ALTER TABLE "events"
ADD CONSTRAINT "events_max_teams_positive"
CHECK ("max_teams" IS NULL OR "max_teams" > 0);
