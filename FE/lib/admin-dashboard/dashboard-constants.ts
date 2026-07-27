import type { QuickActionItem } from "./dashboard-types";

export const QUICK_ACTIONS: QuickActionItem[] = [
  { label: "Create Event", href: "/organizer/events/create", icon: "create" },
  { label: "Review Registrations", href: "/organizer/registrations?status=pending", icon: "review" },
  { label: "Pending Submissions", href: "/organizer/submissions?status=pending", icon: "submission" },
  { label: "Manage People", href: "/organizer/people", icon: "users" },
];
