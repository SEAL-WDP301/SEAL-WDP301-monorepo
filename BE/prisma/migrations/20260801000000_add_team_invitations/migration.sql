CREATE TYPE "TeamInvitationStatus" AS ENUM ('pending', 'accepted', 'rejected', 'cancelled', 'expired');

CREATE TABLE "team_invitations" (
    "id" SERIAL NOT NULL,
    "team_id" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" "TeamInvitationStatus" NOT NULL DEFAULT 'pending',
    "invited_by_id" INTEGER NOT NULL,
    "accepted_by_id" INTEGER,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "team_invitations_token_hash_key" ON "team_invitations"("token_hash");
CREATE UNIQUE INDEX "team_invitations_team_id_email_key" ON "team_invitations"("team_id", "email");
CREATE INDEX "team_invitations_email_status_idx" ON "team_invitations"("email", "status");
CREATE INDEX "team_invitations_team_id_status_idx" ON "team_invitations"("team_id", "status");
CREATE INDEX "team_invitations_expires_at_idx" ON "team_invitations"("expires_at");

ALTER TABLE "team_invitations"
ADD CONSTRAINT "team_invitations_team_id_fkey"
FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "team_invitations"
ADD CONSTRAINT "team_invitations_invited_by_id_fkey"
FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "team_invitations"
ADD CONSTRAINT "team_invitations_accepted_by_id_fkey"
FOREIGN KEY ("accepted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
