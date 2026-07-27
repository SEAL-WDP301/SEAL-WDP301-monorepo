ALTER TABLE "event_calendar_meetings"
ADD COLUMN "start_date" TIMESTAMP(3),
ADD COLUMN "end_date" TIMESTAMP(3),
ADD COLUMN "time_zone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh';
