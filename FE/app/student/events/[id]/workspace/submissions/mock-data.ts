export type RequirementStatus = "completed" | "missing";

export type Requirement = {
    label: string;
    status: RequirementStatus;
};

export type LinkField = {
    label: string;
    placeholder: string;
    value: string;
    status: "valid" | "missing";
};

export type HistoryItem = {
    version: string;
    action: string;
    timestamp: string;
    user: string;
    initials: string;
};

export type SubmissionStatus = "Draft" | "Submitted" | "Reviewed" | "Need Revision" | "Accepted";

export type CurrentRound = {
    name: string;
    dueDate: string;
    countdown: string;
    completedRequirements: number;
    totalRequirements: number;
    requiredFiles: string[];
};

export type UploadedFile = {
    name: string;
    size: string;
    progress: number;
};

export type SubmissionStatusSummary = {
    status: SubmissionStatus;
    lastUpdated: string;
    uploadedBy: string;
    version: string;
    scoreVisibility: string;
};

export type FeedbackSummary = {
    reviewerName: string;
    reviewerInitials: string;
    role: string;
    status: string;
    comment: string;
};

export const currentRound: CurrentRound = {
    name: "Semi Final Submission",
    dueDate: "23 May 2026, 11:59 PM",
    countdown: "2 days left",
    completedRequirements: 3,
    totalRequirements: 4,
    requiredFiles: [
        "Proposal PDF",
        "Source Code ZIP",
        "Demo Video URL",
        "GitHub Repository URL",
    ],
};

export const requirements: Requirement[] = [
    { label: "Proposal PDF uploaded", status: "completed" },
    { label: "GitHub URL added", status: "completed" },
    { label: "Demo video URL added", status: "completed" },
    { label: "Team description completed", status: "completed" },
    { label: "Final confirmation pending", status: "missing" },
];

export const linkFields: LinkField[] = [
    {
        label: "GitHub Repository URL",
        placeholder: "https://github.com/seal-warriors/project",
        value: "https://github.com/seal-warriors/agile-frontier",
        status: "valid",
    },
    {
        label: "Demo URL",
        placeholder: "https://youtu.be/demo",
        value: "https://youtu.be/seal-demo",
        status: "valid",
    },
    {
        label: "Slide Deck URL",
        placeholder: "https://slides.com/team/deck",
        value: "",
        status: "missing",
    },
    {
        label: "Figma/Prototype URL",
        placeholder: "https://figma.com/file/prototype",
        value: "https://figma.com/file/seal-prototype",
        status: "valid",
    },
];

export const submissionStatus: SubmissionStatusSummary = {
    status: "Draft" as SubmissionStatus,
    lastUpdated: "2 hours ago",
    uploadedBy: "Tam - Team Leader",
    version: "v2",
    scoreVisibility: "Not available yet",
};

export const uploadedFile: UploadedFile = {
    name: "proposal-v2.pdf",
    size: "18.4 MB",
    progress: 72,
};

export const history: HistoryItem[] = [
    {
        version: "v1",
        action: "submitted proposal package",
        timestamp: "20 May 2026, 10:30 PM",
        user: "Tam",
        initials: "TA",
    },
    {
        version: "v2",
        action: "updated GitHub URL",
        timestamp: "21 May 2026, 09:15 AM",
        user: "An",
        initials: "AN",
    },
    {
        version: "v3",
        action: "final submission draft prepared",
        timestamp: "22 May 2026, 11:48 PM",
        user: "Tam",
        initials: "TA",
    },
];

export const feedback: FeedbackSummary = {
    reviewerName: "Mr. Long Nguyen",
    reviewerInitials: "LN",
    role: "Mentor",
    status: "Pending",
    comment:
        "Your idea is clear, but the technical architecture needs more explanation.",
};
