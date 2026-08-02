-- AlterTable
ALTER TABLE "github_commits" ADD COLUMN IF NOT EXISTS "additions" INTEGER;
ALTER TABLE "github_commits" ADD COLUMN IF NOT EXISTS "deletions" INTEGER;
ALTER TABLE "github_commits" ADD COLUMN IF NOT EXISTS "changed_files" INTEGER;
ALTER TABLE "github_commits" ADD COLUMN IF NOT EXISTS "files" JSONB;
ALTER TABLE "github_commits" ADD COLUMN IF NOT EXISTS "author_login" TEXT;
ALTER TABLE "github_commits" ADD COLUMN IF NOT EXISTS "author_name" TEXT;

-- Deduplicate before unique (keep newest id)
DELETE FROM "github_commits" a
USING "github_commits" b
WHERE a.team_id = b.team_id
  AND a.commit_hash = b.commit_hash
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS "github_commits_team_id_commit_hash_key"
  ON "github_commits"("team_id", "commit_hash");
