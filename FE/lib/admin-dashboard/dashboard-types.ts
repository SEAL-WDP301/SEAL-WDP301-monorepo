export type DateRange = "7d" | "30d" | "90d" | "year";
export type Season = "all" | "spring" | "summer" | "fall";

export interface DashboardFilters {
  range: DateRange;
  eventId: string;
  season: Season;
  year: number;
}

export interface MetricCardData {
  id: string;
  label: string;
  value: number;
  delta: number;
  detail: string;
  comparison: string;
  href: string;
  sparkline: number[];
  icon:
    | "events"
    | "active"
    | "registrations"
    | "participants"
    | "submissions"
    | "users";
}

export interface DashboardOverview {
  metrics: MetricCardData[];
}

export interface EventMonthlyMetric {
  month: string;
  Created: number;
  Starting: number;
  Completed: number;
}

export interface EventStatusMetric {
  status: string;
  value: number;
  color: string;
}

export interface RegistrationTrendMetric {
  date: string;
  Registrations: number;
  Participants: number;
}

export interface ParticipationConversionMetric {
  stage: string;
  value: number;
  rate: number;
  previousRate: number;
}

export interface ParticipantsByEventMetric {
  id: string;
  event: string;
  Participants: number;
  registrations: number;
  teams: number;
  submissions: number;
  capacity: number;
}

export interface SubmissionStatusMetric {
  status: string;
  value: number;
  color: string;
}

export interface SubmissionActivityMetric {
  date: string;
  Submissions: number;
}

export interface SubmissionSummaryMetric {
  totalSubmittedTeams: number;
  eligibleTeams: number;
  submissionRate: number;
  submittedLast24Hours: number;
  teamsNotSubmitted: number;
}

export interface ActiveUsersHourlyMetric {
  hour: string;
  Users: number;
}

export interface ActiveUsersByRoleMetric {
  role: string;
  value: number;
  delta: number;
}

export type DeadlineStatus = "Upcoming" | "Urgent" | "Overdue" | "Completed";

export interface UpcomingDeadlineItem {
  id: string;
  eventId: string;
  event: string;
  type: string;
  date: string;
  remaining: string;
  status: DeadlineStatus;
  submissionRate?: number;
}

export type RegistrationStatus =
  "Pending" | "Approved" | "Rejected" | "Waitlisted";

export interface RecentRegistrationItem {
  id: string;
  student: string;
  initials: string;
  event: string;
  time: string;
  status: RegistrationStatus;
  teamStatus: string;
}

export interface QuickActionItem {
  label: string;
  href: string;
  icon: "create" | "review" | "submission" | "notify" | "users";
}

export interface AdminDashboardData {
  overview: DashboardOverview;
  eventsByMonth: EventMonthlyMetric[];
  eventStatus: EventStatusMetric[];
  registrationTrend: RegistrationTrendMetric[];
  conversion: ParticipationConversionMetric[];
  participantsByEvent: ParticipantsByEventMetric[];
  submissionStatus: SubmissionStatusMetric[];
  submissionActivity: SubmissionActivityMetric[];
  submissionSummary: SubmissionSummaryMetric;
  deadlines: UpcomingDeadlineItem[];
  recentRegistrations: RecentRegistrationItem[];
  quickActions: QuickActionItem[];
}
