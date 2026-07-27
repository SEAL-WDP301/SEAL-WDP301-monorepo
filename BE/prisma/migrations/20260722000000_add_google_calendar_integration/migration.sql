ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'event_published';

CREATE TABLE "google_calendar_connections" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "refresh_token_encrypted" TEXT NOT NULL,
    "scope" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "google_calendar_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "google_oauth_states" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "google_oauth_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_calendar_meetings" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "google_event_id" TEXT NOT NULL,
    "calendar_id" TEXT NOT NULL DEFAULT 'primary',
    "meet_url" TEXT,
    "html_link" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_calendar_meetings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "google_calendar_connections_user_id_key" ON "google_calendar_connections"("user_id");
CREATE INDEX "google_oauth_states_expires_at_idx" ON "google_oauth_states"("expires_at");
CREATE UNIQUE INDEX "event_calendar_meetings_event_id_key" ON "event_calendar_meetings"("event_id");
CREATE UNIQUE INDEX "event_calendar_meetings_google_event_id_key" ON "event_calendar_meetings"("google_event_id");

ALTER TABLE "google_calendar_connections" ADD CONSTRAINT "google_calendar_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "google_oauth_states" ADD CONSTRAINT "google_oauth_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_calendar_meetings" ADD CONSTRAINT "event_calendar_meetings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
