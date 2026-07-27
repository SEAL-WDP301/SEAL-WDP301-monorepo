import { JudgeStats } from "./components/judge-stats";
import { QuickSubmission } from "./components/quick-submission";
import { TodayEvaluations } from "./components/today-evaluations";
import { JudgeDashboardHeader } from "./components/judge-dashboard-header";
import { PublicEventOnlineMeetingCard } from "@/components/events/public-event-online-meeting-card";

export default async function JudgePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  return (
    <div className="space-y-6">
      <JudgeDashboardHeader />
      <PublicEventOnlineMeetingCard eventId={eventId} />
      <JudgeStats />
      <TodayEvaluations />
      <QuickSubmission />
    </div>
  );
}
