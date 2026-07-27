export type MemberStatus = "Active" | "Pending" | "Offline";

export type MemberRole = "TEAM LEADER" | "FRONTEND DEV" | "BACKEND DEV" | "PRESENTER";

export type TeamMember = {
    name: string;
    initials: string;
    role: MemberRole;
    university: string;
    bio: string;
    skills: string[];
    tasks: number;
    uploads: number;
    activity: "High" | "Medium" | "Low";
    status: MemberStatus;
};

export type PendingInvite = {
    name: string;
    email: string;
    sentTime: string;
    role: string;
};

export type MemberActivity = {
    label: string;
    time: string;
};

export const teamStats = [
    {
        label: "Total Members",
        value: "4 Members",
        helper: "Current active team size",
    },
    {
        label: "Available Slots",
        value: "1 Slot Left",
        helper: "Maximum team size is 5",
    },
    {
        label: "Team Roles",
        value: "Frontend • Backend • Presenter",
        helper: "Core coverage ready",
    },
];

export const roleFilters = ["All", "Leader", "Developer", "Presenter", "Designer"];

export const members: TeamMember[] = [
    {
        name: "Tam Nguyen",
        initials: "TA",
        role: "TEAM LEADER",
        university: "FPT University HCMC",
        bio: "Coordinates delivery, product scope, and frontend system quality.",
        skills: ["React", "NextJS", "UI/UX", "Shadcn UI"],
        tasks: 12,
        uploads: 3,
        activity: "High",
        status: "Active",
    },
    {
        name: "An Tran",
        initials: "AN",
        role: "BACKEND DEV",
        university: "FPT University HCMC",
        bio: "Owns API architecture, database design, and integration flow.",
        skills: ["NestJS", "PostgreSQL", "Auth", "REST API"],
        tasks: 10,
        uploads: 2,
        activity: "High",
        status: "Active",
    },
    {
        name: "Khang Le",
        initials: "KH",
        role: "FRONTEND DEV",
        university: "FPT University HCMC",
        bio: "Builds dashboard UI, responsive states, and component polish.",
        skills: ["React", "NextJS", "Tailwind", "UI/UX"],
        tasks: 8,
        uploads: 1,
        activity: "Medium",
        status: "Active",
    },
    {
        name: "Vy Pham",
        initials: "VY",
        role: "PRESENTER",
        university: "FPT University HCMC",
        bio: "Prepares research notes, demo narrative, and pitch materials.",
        skills: ["Research", "Pitching", "Slides", "Storytelling"],
        tasks: 6,
        uploads: 2,
        activity: "Medium",
        status: "Offline",
    },
];

export const pendingInvites: PendingInvite[] = [
    {
        name: "Minh Hoang",
        email: "minh.hoang@fpt.edu.vn",
        sentTime: "Sent 18 minutes ago",
        role: "Designer",
    },
    {
        name: "Linh Dao",
        email: "linh.dao@fpt.edu.vn",
        sentTime: "Sent yesterday",
        role: "Developer",
    },
];

export const memberActivities: MemberActivity[] = [
    { label: "Tam changed role to Team Leader", time: "10 minutes ago" },
    { label: "An joined the team", time: "12 minutes ago" },
    { label: "Vy uploaded presentation file", time: "2 hours ago" },
];
