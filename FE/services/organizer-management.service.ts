import { axiosClient } from "@/lib/axios";
import type { AxiosResponse } from "axios";
import type {
  OrganizerPerson,
  OrganizerSettings,
  OrganizerSubmission,
  Paginated,
  PeopleFilters,
  SubmissionFilters,
} from "@/lib/organizer/management-types";
import { getDashboardFilterOptions } from "@/services/admin-dashboard.service";

type Row = Record<string, unknown>;
const record = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
const unwrap = (value: unknown): unknown => {
  const row = record(value);
  return row.data === undefined ? value : (record(row.data).data ?? row.data);
};
const list = (value: unknown, ...keys: string[]) => {
  const data = unwrap(value);
  if (Array.isArray(data)) return data;
  const row = record(data);
  for (const key of keys)
    if (Array.isArray(row[key])) return row[key] as unknown[];
  return [];
};
const pick = (row: Row, ...keys: string[]) =>
  keys
    .map((key) => row[key])
    .find((value) => value !== undefined && value !== null);
const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;
const numeric = (value: unknown) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;
const paginate = <T>(data: T[], page: number, limit: number): Paginated<T> => {
  const start = (page - 1) * limit;
  return {
    data: data.slice(start, start + limit),
    pagination: {
      page,
      limit,
      total: data.length,
      totalPages: Math.max(1, Math.ceil(data.length / limit)),
    },
  };
};
const formattedDate = (value: unknown) => {
  const raw = text(value);
  if (!raw) return "—";
  const date = new Date(raw);
  return Number.isNaN(date.getTime())
    ? raw
    : new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
};

async function getEvents() {
  return (await getDashboardFilterOptions()).events;
}

let cachedPeoplePromise: Promise<OrganizerPerson[]> | null = null;
let cachedSubmissionDashboardPromise: Promise<AxiosResponse[]> | null = null;

async function fetchPeople(): Promise<OrganizerPerson[]> {
  if (cachedPeoplePromise) return cachedPeoplePromise;

  cachedPeoplePromise = (async () => {
    try {
      const events = await getEvents();
      const [
        usersResponse,
        registrationsResponse,
        profileResponse,
        assignmentResponses,
      ] = await Promise.all([
          axiosClient.get("/users"),
          axiosClient.get(
            "/organizer/dashboard/recent-registrations?limit=100",
          ),
          axiosClient.get("/users/profile"),
          Promise.all(
            events.map(async (event) => ({
              event,
              response: await axiosClient.get(
                `/organizer/assignments/events/${event.value}`,
              ),
            })),
          ),
        ]);
      const students = list(
        registrationsResponse.data,
        "registrations",
        "items",
        "recentRegistrations",
      ).map((value, index): OrganizerPerson => {
        const row = record(value);
        const user = record(pick(row, "student", "user"));
        const event = record(row.event);
        const team = record(row.team);
        return {
          id: String(
            pick(user, "id", "userId") ??
              pick(row, "studentId", "id") ??
              `student-${index}`,
          ),
          name: text(
            pick(user, "name", "fullName"),
            text(pick(row, "studentName", "name"), "Unknown student"),
          ),
          email: text(pick(user, "email"), text(row.email)),
          code: text(pick(user, "studentId", "code")),
          role: "Student",
          event: text(pick(event, "name", "title"), text(row.eventName, "—")),
          assignment: text(pick(team, "name", "teamName"), "No team"),
          participationStatus:
            text(row.status).toLowerCase() === "rejected"
              ? "Inactive"
              : "Active",
          lastActive: formattedDate(
            pick(row, "updatedAt", "registeredAt", "createdAt"),
          ),
          department: text(pick(user, "department", "major")),
          skills: list(user.skills, "skills").map(String),
          bio: text(user.bio),
        };
      });
      const stakeholders = assignmentResponses.flatMap(({ event, response }) =>
        list(
          response.data,
          "assignments",
          "stakeholders",
          "judges",
          "items",
        ).flatMap((value, index): OrganizerPerson[] => {
          const stakeholder = record(value);
          const profile = record(stakeholder.stakeholderProfile);
          const mentorAssignments = list(stakeholder, "mentorAssignments");
          const judgeAssignments = list(stakeholder, "judgeAssignments");
          const id = String(
            pick(stakeholder, "id", "userId") ?? `${event.value}-${index}`,
          );
          const base = {
            id,
            name: text(
              pick(stakeholder, "name", "fullName"),
              "Unknown stakeholder",
            ),
            email: text(stakeholder.email),
            code: text(pick(stakeholder, "code", "stakeholderCode")),
            event: event.label,
            participationStatus: "Active" as const,
            lastActive: formattedDate(
              pick(stakeholder, "lastActive", "updatedAt"),
            ),
            department: text(
              pick(profile, "organization", "organizationName", "jobTitle"),
            ),
            skills: list(profile.skills, "skills").map(String),
            bio: text(profile.bio),
          };
          const people: OrganizerPerson[] = [];

          if (mentorAssignments.length) {
            const teams = [
              ...new Set(
                mentorAssignments
                  .map((item) =>
                    text(pick(record(record(item).team), "name", "teamName")),
                  )
                  .filter(Boolean),
              ),
            ];
            people.push({
              ...base,
              role: "Mentor",
              assignment: teams.join(", ") || "Mentor assignment",
            });
          }

          if (judgeAssignments.length) {
            const rounds = [
              ...new Set(
                judgeAssignments
                  .map((item) => {
                    const assignment = record(item);
                    const round = record(assignment.round);
                    const track = record(assignment.track);
                    const roundName = text(pick(round, "name", "title"));
                    const trackName = text(pick(track, "name", "title"));
                    return [roundName, trackName].filter(Boolean).join(" · ");
                  })
                  .filter(Boolean),
              ),
            ];
            people.push({
              ...base,
              role: "Judge",
              assignment: rounds.join(", ") || "Judge assignment",
            });
          }

          return people;
        }),
      );
      const profile = record(unwrap(profileResponse.data));
      const profileDetails = record(
        pick(profile, "stakeholderProfile", "profile"),
      );
      const organizer: OrganizerPerson = {
        id: String(profile.id ?? "current-organizer"),
        name: text(pick(profile, "name", "fullName"), "Current organizer"),
        email: text(profile.email),
        code: text(profile.code),
        role: "Organizer",
        event: events.map((event) => event.label).join(", "),
        assignment: "Current organizer",
        participationStatus: "Active",
        lastActive: "Current session",
        department: text(pick(profileDetails, "organization", "department")),
        skills: list(profileDetails.skills, "skills").map(String),
        bio: text(profileDetails.bio),
      };
      const unique = new Map<string, OrganizerPerson>();
      [...students, ...stakeholders, organizer].forEach((person) => {
        const key = person.id;
        const existing = unique.get(key);
        if (!existing) {
          unique.set(key, person);
          return;
        }

        unique.set(key, {
          ...existing,
          role:
            existing.role === person.role
              ? existing.role
              : existing.role === "Organizer" || person.role === "Organizer"
                ? "Organizer"
                : "Stakeholder",
          event: [...new Set([existing.event, person.event])].join(", "),
          assignment: [
            ...new Set([existing.assignment, person.assignment]),
          ].join(", "),
        });
      });

      list(usersResponse.data, "users", "items").forEach((value, index) => {
        const user = record(value);
        const id = String(pick(user, "id", "userId") ?? `user-${index}`);
        if (unique.has(id)) return;

        const rawRole = text(user.role).toLowerCase();
        const role: OrganizerPerson["role"] = rawRole === "student"
          ? "Student"
          : rawRole === "mentor"
            ? "Mentor"
            : rawRole === "judge"
              ? "Judge"
              : rawRole === "stakeholder"
                ? "Stakeholder"
                : "Organizer";
        const studentProfile = record(user.studentProfile);
        const stakeholderProfile = record(user.stakeholderProfile);

        unique.set(id, {
          id,
          name: text(pick(user, "name", "fullName"), "Unknown user"),
          email: text(user.email),
          code: text(
            pick(user, "code") ??
              pick(studentProfile, "studentCode", "code"),
          ),
          role,
          event: "—",
          assignment:
            role === "Student"
              ? "No event registration"
              : role === "Stakeholder"
                ? "No event assignment"
                : "System access",
          participationStatus:
            user.isActive === false ? "Inactive" : "Active",
          lastActive: formattedDate(
            pick(user, "lastActive", "updatedAt", "createdAt"),
          ),
          department: text(
            pick(studentProfile, "universityName", "major") ??
              pick(
                stakeholderProfile,
                "organization",
                "organizationName",
                "jobTitle",
              ),
          ),
          skills: list(stakeholderProfile.skills, "skills").map(String),
          bio: text(stakeholderProfile.bio),
        });
      });
      return [...unique.values()];
    } finally {
      // Clear cache after 1 second so next hard-refresh actually fetches data
      setTimeout(() => {
        cachedPeoplePromise = null;
      }, 1000);
    }
  })();

  return cachedPeoplePromise;
}

function mapSubmission(
  value: unknown,
  eventName: string,
  index: number,
): OrganizerSubmission {
  const row = record(value);
  const team = record(row.team);
  const round = record(row.round);
  const track = record(pick(row, "track") ?? team.track);
  const submittedAt = pick(row, "submittedAt", "updatedAt", "createdAt");
  const deadline = pick(round, "submissionDeadline", "deadline");
  const late = Boolean(
    deadline &&
    submittedAt &&
    new Date(String(submittedAt)).getTime() >
      new Date(String(deadline)).getTime(),
  );
  const isSubmitted =
    row.isSubmittedStatus === undefined
      ? Boolean(row.id)
      : Boolean(row.isSubmittedStatus);
  return {
    id: String(row.id ?? `${eventName}-${index}`),
    team: text(pick(team, "name", "teamName"), "Unknown team"),
    project: text(
      pick(row, "projectName", "title", "name"),
      text(pick(team, "projectName", "name"), "Submission"),
    ),
    event: eventName,
    round: text(pick(round, "name", "title")),
    track: text(pick(track, "name", "title")),
    submittedAt: formattedDate(submittedAt),
    status: !isSubmitted
      ? "Invalid"
      : late
        ? "Late"
        : row.reopenedAt
          ? "Reopened"
          : "On Time",
    repository: text(pick(row, "githubUrl", "repository", "repositoryUrl")),
    demo: text(pick(row, "demoUrl", "fileUrl")),
    description: text(pick(row, "description", "notes")),
  };
}

async function fetchSubmissions() {
  const events = await getEvents();
  const responses = await Promise.all(
    events.map(async (event) => ({
      event,
      response: await axiosClient.get(
        `/organizer/events/${event.value}/submissions`,
      ),
    })),
  );
  return responses.flatMap(({ event, response }) =>
    list(response.data, "submissions", "items").map((submission, index) =>
      mapSubmission(submission, event.label, index),
    ),
  );
}

async function fetchSubmissionDashboard() {
  if (cachedSubmissionDashboardPromise) return cachedSubmissionDashboardPromise;

  cachedSubmissionDashboardPromise = axiosClient
    .get("/organizer/dashboard/submissions")
    .then((response) => [response])
    .finally(() => {
      setTimeout(() => {
        cachedSubmissionDashboardPromise = null;
      }, 1000);
    });

  return cachedSubmissionDashboardPromise;
}

const emptySettings = (): OrganizerSettings => ({
  profile: {
    fullName: "",
    email: "",
    phone: "",
    department: "",
    position: "",
    bio: "",
  },
  eventDefaults: {
    season: "",
    minTeamSize: 0,
    maxTeamSize: 0,
    registrationMode: "",
    fileLimit: 0,
    timezone: "",
    visibility: "",
    dateFormat: "",
  },
  preferences: {
    theme: "",
    language: "",
    timezone: "",
    dateFormat: "",
    defaultEvent: "",
    pageSize: 10,
    reducedMotion: false,
  },
  notifications: {},
  sessions: [],
});

export const organizerManagementService = {
  async getPeople(filters: PeopleFilters): Promise<Paginated<OrganizerPerson>> {
    const people = await fetchPeople();
    const query = filters.search.toLowerCase();
    return paginate(
      people.filter(
        (person) =>
          (!query ||
            `${person.name} ${person.email}`.toLowerCase().includes(query)) &&
          (filters.role === "All" || person.role === filters.role) &&
          (filters.status === "All" ||
            person.participationStatus === filters.status),
      ),
      filters.page,
      filters.limit,
    );
  },
  async getPeopleSummary() {
    const people = await fetchPeople();
    return {
      total: people.length,
      students: people.filter((item) => item.role === "Student").length,
      mentors: people.filter((item) => item.role === "Mentor").length,
      judges: people.filter((item) => item.role === "Judge").length,
      stakeholders: people.filter((item) => item.role === "Stakeholder").length,
      organizers: people.filter((item) => item.role === "Organizer").length,
      active: people.filter((item) => item.participationStatus === "Active")
        .length,
    };
  },
  async getPerson(id: string) {
    return (await fetchPeople()).find((person) => person.id === id) ?? null;
  },
  async getSubmissions(
    filters: SubmissionFilters,
  ): Promise<Paginated<OrganizerSubmission>> {
    const submissions = await fetchSubmissions();
    const query = filters.search.toLowerCase();
    return paginate(
      submissions.filter(
        (submission) =>
          (!query ||
            `${submission.team} ${submission.project}`
              .toLowerCase()
              .includes(query)) &&
          (filters.status === "All" || submission.status === filters.status),
      ),
      filters.page,
      filters.limit,
    );
  },
  async getSubmissionSummary() {
    const [submissions, responses] = await Promise.all([
      fetchSubmissions(),
      fetchSubmissionDashboard(),
    ]);

    let dashboardTotal = 0;
    let dashboardOnTime = 0;
    let dashboardLate = 0;
    let notSubmitted = 0;

    responses.forEach((response) => {
      const payload = record(unwrap(response.data));
      const summary = record(payload.summary);

      // The dashboard API groups timing counts into an array rather than
      // returning the legacy flat summary fields.
      list(payload, "timingStatus").forEach((value) => {
        const row = record(value);
        const status = text(row.status).toUpperCase();
        const count = numeric(pick(row, "count", "value"));
        if (status === "ON_TIME") dashboardOnTime += count;
        if (status === "LATE") dashboardLate += count;
      });

      dashboardTotal += numeric(
        pick(summary, "totalSubmittedTeams", "total", "totalSubmissions") ??
          pick(payload, "total", "totalSubmissions"),
      );
      notSubmitted += numeric(
        pick(summary, "teamsNotSubmitted", "notSubmitted") ??
          pick(payload, "teamsNotSubmitted", "notSubmitted"),
      );
    });

    return {
      total: submissions.length || dashboardTotal,
      onTime:
        submissions.filter((item) => item.status === "On Time").length ||
        dashboardOnTime,
      late:
        submissions.filter((item) => item.status === "Late").length ||
        dashboardLate,
      notSubmitted,
    };
  },
  async getSubmissionActivity() {
    const responses = await fetchSubmissionDashboard();
    const totals = new Map<string, number>();

    responses.forEach((response) => {
      const payload = record(unwrap(response.data));
      list(payload, "activity", "trend", "submissionActivity").forEach(
        (value) => {
          const row = record(value);
          const date = text(pick(row, "period", "date", "day", "label"));
          if (!date) return;

          const count = numeric(
            pick(row, "submissionCount", "Submissions", "submissions", "count"),
          );
          totals.set(date, (totals.get(date) ?? 0) + count);
        },
      );
    });

    return [...totals]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, Submissions]) => ({ date, Submissions }));
  },
  async getSettings(): Promise<OrganizerSettings> {
    const response = await axiosClient.get("/users/profile");
    const user = record(unwrap(response.data));
    const details = record(pick(user, "stakeholderProfile", "profile"));
    const settings = emptySettings();
    settings.profile = {
      fullName: text(pick(user, "name", "fullName")),
      email: text(user.email),
      phone: text(pick(user, "phone") ?? details.phone),
      department: text(
        pick(details, "department", "organization", "organizationName"),
      ),
      position: text(pick(details, "jobTitle", "position")),
      bio: text(details.bio),
    };
    return settings;
  },
  async saveSettings(settings: OrganizerSettings) {
    const response = await axiosClient.put("/users/profile/stakeholder", {
      jobTitle: settings.profile.position,
      organization: settings.profile.department,
      bio: settings.profile.bio,
      phone: settings.profile.phone,
    });
    return unwrap(response.data);
  },
};
