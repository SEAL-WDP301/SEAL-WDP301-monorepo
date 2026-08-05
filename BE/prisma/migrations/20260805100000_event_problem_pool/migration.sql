-- CreateTable
CREATE TABLE "event_problem_pool_items" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "problem_file_url" TEXT NOT NULL,
    "assigned_round_id" INTEGER,
    "assigned_track_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_problem_pool_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_problem_pool_items_event_id_idx" ON "event_problem_pool_items"("event_id");

-- CreateIndex
CREATE INDEX "event_problem_pool_items_assigned_round_id_idx" ON "event_problem_pool_items"("assigned_round_id");

-- AddForeignKey
ALTER TABLE "event_problem_pool_items" ADD CONSTRAINT "event_problem_pool_items_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
