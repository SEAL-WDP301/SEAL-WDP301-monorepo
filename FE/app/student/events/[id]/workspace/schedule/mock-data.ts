export type ScheduleStatus = "Upcoming" | "Ongoing" | "Completed" | "Missed" | "Urgent";
export type RoadmapState = "completed" | "current" | "locked";
export type MeetingType = "Google Meet" | "Offline" | "Discord";

export type CalendarDay = {
    day: number;
    muted?: boolean;
    today?: boolean;
    urgent?: boolean;
    events?: string[];
};

export type UpcomingEvent = {
    title: string;
    time: string;
    status: ScheduleStatus;
    priority: "High" | "Medium" | "Low";
};

export type TimelineItem = {
    time: string;
    title: string;
    description: string;
    status: ScheduleStatus;
};

export type MentorMeeting = {
    title: string;
    mentor: string;
    initials: string;
    datetime: string;
    type: MeetingType;
};

export type RoadmapStep = {
    label: string;
    state: RoadmapState;
};

export type Reminder = {
    title: string;
    priority: "High" | "Medium" | "Low";
    assignee: string;
    done: boolean;
};

export type ScheduleMeta = {
    currentDate: string;
    timezone: string;
    currentRound: string;
};

export type DeadlineSummary = {
    title: string;
    countdown: string;
    progress: number;
};

export const calendarDays: CalendarDay[] = [
    { day: 28, muted: true },
    { day: 29, muted: true },
    { day: 30, muted: true },
    { day: 1 },
    { day: 2 },
    { day: 3, events: ["Workshop"] },
    { day: 4 },
    { day: 5 },
    { day: 6 },
    { day: 7, events: ["Mentor"] },
    { day: 8 },
    { day: 9 },
    { day: 10, events: ["Review"] },
    { day: 11 },
    { day: 12 },
    { day: 13 },
    { day: 14 },
    { day: 15, events: ["Internal"] },
    { day: 16 },
    { day: 17 },
    { day: 18 },
    { day: 19 },
    { day: 20, events: ["v1"] },
    { day: 21, events: ["Update"] },
    { day: 22 },
    { day: 23, urgent: true, events: ["Deadline"] },
    { day: 24, events: ["Slides"] },
    { day: 25 },
    { day: 26, today: true, events: ["Mentor"] },
    { day: 27, urgent: true, events: ["Submit"] },
    { day: 28 },
    { day: 29, events: ["Pitch"] },
    { day: 30 },
    { day: 31 },
    { day: 1, muted: true },
];

export const upcomingEvents: UpcomingEvent[] = [
    { title: "Mentor Meeting", time: "Today 8:00 PM", status: "Ongoing", priority: "Medium" },
    { title: "Submission Deadline", time: "Tomorrow 11:59 PM", status: "Urgent", priority: "High" },
    { title: "Semi Final Presentation", time: "Friday 9:00 AM", status: "Upcoming", priority: "High" },
    { title: "Architecture Workshop", time: "Sat 2:00 PM", status: "Upcoming", priority: "Medium" },
    { title: "Final Review Session", time: "Mon 7:30 PM", status: "Upcoming", priority: "Low" },
];

export const dailyTimeline: TimelineItem[] = [
    {
        time: "08:00 PM",
        title: "Mentor Review Session",
        description: "Architecture review with Mr. Huy Nguyen.",
        status: "Ongoing",
    },
    {
        time: "09:30 PM",
        title: "Team Internal Meeting",
        description: "Assign final fixes and presentation owners.",
        status: "Upcoming",
    },
    {
        time: "11:59 PM",
        title: "Submission Deadline",
        description: "Upload final GitHub URL, proposal, and demo video.",
        status: "Urgent",
    },
];

export const roadmap: RoadmapStep[] = [
    { label: "Registration", state: "completed" },
    { label: "Team Approval", state: "completed" },
    { label: "Proposal Submission", state: "completed" },
    { label: "Semi Final", state: "current" },
    { label: "Final Round", state: "locked" },
    { label: "Award Ceremony", state: "locked" },
];

export const reminders: Reminder[] = [
    { title: "Prepare presentation slides", priority: "High", assignee: "TA", done: false },
    { title: "Fix authentication flow", priority: "High", assignee: "AN", done: false },
    { title: "Submit final GitHub URL", priority: "Medium", assignee: "KH", done: true },
];
