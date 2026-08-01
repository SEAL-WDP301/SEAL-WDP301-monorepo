ALTER TABLE "events"
ADD COLUMN "min_members_per_team" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "max_members_per_team" INTEGER NOT NULL DEFAULT 4;

UPDATE "events" AS event
SET "max_members_per_team" = limits."max_members_per_team"
FROM (
  SELECT
    "event_id",
    MAX("max_members_per_team") AS "max_members_per_team"
  FROM "tracks"
  WHERE "max_members_per_team" IS NOT NULL
  GROUP BY "event_id"
) AS limits
WHERE event."id" = limits."event_id";

ALTER TABLE "events"
ADD CONSTRAINT "events_team_member_limits_valid"
CHECK (
  "min_members_per_team" > 0
  AND "max_members_per_team" >= "min_members_per_team"
);

ALTER TABLE "tracks" DROP COLUMN "max_members_per_team";
