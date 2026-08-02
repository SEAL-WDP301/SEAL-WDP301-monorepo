-- Deferred track assignment + per-track problem files

ALTER TABLE "events"
ADD COLUMN IF NOT EXISTS "deferred_track_assignment" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "teams"
ALTER COLUMN "track_id" DROP NOT NULL;

ALTER TABLE "student_registrations"
ALTER COLUMN "track_id" DROP NOT NULL;

-- Soften FK so unassigned teams/registrations can exist without a track
ALTER TABLE "teams" DROP CONSTRAINT IF EXISTS "teams_track_id_fkey";
ALTER TABLE "teams"
ADD CONSTRAINT "teams_track_id_fkey"
FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_registrations" DROP CONSTRAINT IF EXISTS "student_registrations_track_id_fkey";
ALTER TABLE "student_registrations"
ADD CONSTRAINT "student_registrations_track_id_fkey"
FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "round_track_problems" (
    "id" SERIAL NOT NULL,
    "round_id" INTEGER NOT NULL,
    "track_id" INTEGER NOT NULL,
    "problem_file_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "round_track_problems_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "round_track_problems_round_id_track_id_key"
ON "round_track_problems"("round_id", "track_id");

ALTER TABLE "round_track_problems" DROP CONSTRAINT IF EXISTS "round_track_problems_round_id_fkey";
ALTER TABLE "round_track_problems"
ADD CONSTRAINT "round_track_problems_round_id_fkey"
FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "round_track_problems" DROP CONSTRAINT IF EXISTS "round_track_problems_track_id_fkey";
ALTER TABLE "round_track_problems"
ADD CONSTRAINT "round_track_problems_track_id_fkey"
FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
