"use client";

import Link from "next/link";
import { BarList } from "@tremor/react";

import { DashboardSection } from "./dashboard-section";
import {
  formatNumber,
  formatPercent,
} from "@/lib/admin-dashboard/dashboard-formatters";
import type {
  SubmissionStatusMetric,
  SubmissionSummaryMetric,
} from "@/lib/admin-dashboard/dashboard-types";

interface SubmissionStatusChartProps {
  data: SubmissionStatusMetric[];
  summary: SubmissionSummaryMetric;
}

export function SubmissionStatusChart({
  data,
  summary,
}: SubmissionStatusChartProps) {
  return (
    <DashboardSection
      title="Submission Status"
      description={`${formatNumber(summary.totalSubmittedTeams)} submitted teams · ${formatPercent(summary.submissionRate)} submission rate`}
    >
      <BarList
        data={data.map((item) => ({
          name: item.status,
          value: item.value,
          color: item.color,
        }))}
        valueFormatter={formatNumber}
        className="mt-2"
      />
      <Link
        href="/organizer/submissions"
        className="mt-6 inline-block text-xs font-semibold text-orange-400"
      >
        View Submissions →
      </Link>
    </DashboardSection>
  );
}
