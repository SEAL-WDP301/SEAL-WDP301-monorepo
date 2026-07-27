"use client";

import { AreaChart } from "@tremor/react";

import { DashboardSection } from "./dashboard-section";
import { formatNumber } from "@/lib/admin-dashboard/dashboard-formatters";
import type {
  SubmissionActivityMetric,
  SubmissionSummaryMetric,
} from "@/lib/admin-dashboard/dashboard-types";

interface SubmissionActivityChartProps {
  data: SubmissionActivityMetric[];
  summary: SubmissionSummaryMetric;
}

export function SubmissionActivityChart({
  data,
  summary,
}: SubmissionActivityChartProps) {
  const peak = data.reduce<SubmissionActivityMetric | null>(
    (current, item) =>
      !current || item.Submissions > current.Submissions ? item : current,
    null,
  );
  const peakText =
    peak && peak.Submissions > 0
      ? `Peak: ${peak.date} · ${formatNumber(peak.Submissions)} submissions`
      : "No submissions in the selected period";

  return (
    <DashboardSection
      title="Submission Activity"
      description={`${peakText} · ${formatNumber(summary.submittedLast24Hours)} in the last 24h`}
    >
      <AreaChart
        data={data}
        index="date"
        categories={["Submissions"]}
        colors={["orange"]}
        valueFormatter={formatNumber}
        className="h-64"
        showAnimation={false}
      />
      <p className="mt-3 text-xs text-muted-foreground">
        {formatNumber(summary.teamsNotSubmitted)} teams have not submitted yet.
      </p>
    </DashboardSection>
  );
}
