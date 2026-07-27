export type RegistrationStatus =
  "Pending" | "Approved" | "Rejected" | "Cancelled";
export type EligibilityStatus = "Eligible" | "Needs Review" | "Not Eligible";
export type RegistrationTeamStatus =
  "No Team" | "Has Team" | "Team Full" | "Team Disbanded";
export type SortOrder = "asc" | "desc";

export interface RegistrationFilters {
  search: string;
  eventId: string;
  status: string;
  eligibility: string;
  teamStatus: string;
  season: string;
  year: string;
  dateRange: string;
  sortBy: string;
  sortOrder: SortOrder;
  page: number;
  limit: number;
}

export interface RegistrationMetric {
  id: string;
  label: string;
  value: number;
  suffix?: string;
  delta: number;
  detail: string;
  icon: "total" | "pending" | "approved" | "rejected" | "rate";
}

export interface RegistrationOverview {
  metrics: RegistrationMetric[];
}
export interface RegistrationTrendPoint {
  date: string;
  Total: number;
  Approved: number;
}

export interface RegistrationStudent {
  id: string;
  fullName: string;
  email: string;
  studentId: string;
  department: string;
  school: string;
  phone?: string;
  profileCompletion: number;
}

export interface RegistrationEvent {
  id: string;
  name: string;
  track: string;
  season: string;
  year: number;
}

export interface RegistrationTeam {
  id: string;
  name: string;
  status: RegistrationTeamStatus;
  role: "Leader" | "Member";
  leader: string;
  members: string[];
}

export interface RegistrationListItem {
  id: string;
  student: RegistrationStudent;
  event: RegistrationEvent;
  registeredAt: string;
  registeredRelative: string;
  eligibility: EligibilityStatus;
  eligibilityReason?: string;
  teamStatus: RegistrationTeamStatus;
  team?: RegistrationTeam;
  status: RegistrationStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface RegistrationAnswer {
  label: string;
  value: string;
}
export interface RegistrationHistoryItem {
  id: string;
  action: string;
  actor: string;
  time: string;
  note?: string;
}

export interface RegistrationDetails extends RegistrationListItem {
  agreedToTerms: boolean;
  source: string;
  answers: RegistrationAnswer[];
  history: RegistrationHistoryItem[];
}

export interface ApproveRegistrationInput {
  sendNotification: boolean;
  includeTeamInstructions: boolean;
}
export interface RejectRegistrationInput {
  reason: string;
  note: string;
  sendNotification: boolean;
  allowRegisterAgain: boolean;
}
export interface PaginatedRegistrationResponse {
  data: RegistrationListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
