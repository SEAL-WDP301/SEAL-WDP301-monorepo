export type ChangeDirection = "INCREASE" | "DECREASE" | "UNCHANGED";

export interface ComparisonMetric {
  value: number;
  previousValue: number;
  changePercentage: number;
  changeDirection: ChangeDirection;
}

export interface DashboardOverview {
  totalEvents: ComparisonMetric & { newEvents: number };
  activeEvents: { value: number; endingSoon: number; startingSoon: number };
  totalRegistrations: ComparisonMetric & { pending: number };
  totalParticipants: ComparisonMetric & { approvalRate: number };
  totalSubmissions: ComparisonMetric & {
    last24Hours: number;
    pendingEvaluation: number;
    submissionRate: number;
  };
}
