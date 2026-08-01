-- CreateTable
CREATE TABLE "ai_score_suggestion_logs" (
    "id" SERIAL NOT NULL,
    "submission_id" INTEGER NOT NULL,
    "judge_id" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "context_summary" TEXT NOT NULL,
    "suggestions" JSONB NOT NULL,
    "applied_at" TIMESTAMP(3),
    "discarded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_score_suggestion_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_score_suggestion_logs_submission_id_judge_id_idx" ON "ai_score_suggestion_logs"("submission_id", "judge_id");

-- CreateIndex
CREATE INDEX "ai_score_suggestion_logs_created_at_idx" ON "ai_score_suggestion_logs"("created_at");

-- AddForeignKey
ALTER TABLE "ai_score_suggestion_logs" ADD CONSTRAINT "ai_score_suggestion_logs_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_score_suggestion_logs" ADD CONSTRAINT "ai_score_suggestion_logs_judge_id_fkey" FOREIGN KEY ("judge_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
