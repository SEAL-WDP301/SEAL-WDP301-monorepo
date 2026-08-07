UPDATE "events"
SET
  "min_members_per_team" = LEAST(GREATEST("min_members_per_team", 2), 5),
  "max_members_per_team" = LEAST(GREATEST("max_members_per_team", 2), 5);

UPDATE "events"
SET "max_members_per_team" = "min_members_per_team"
WHERE "max_members_per_team" < "min_members_per_team";

ALTER TABLE "events"
ALTER COLUMN "min_members_per_team" SET DEFAULT 2,
ALTER COLUMN "max_members_per_team" SET DEFAULT 5;

ALTER TABLE "events"
DROP CONSTRAINT "events_team_member_limits_valid";

ALTER TABLE "events"
ADD CONSTRAINT "events_team_member_limits_valid"
CHECK (
  "min_members_per_team" >= 2
  AND "max_members_per_team" <= 5
  AND "max_members_per_team" >= "min_members_per_team"
);
