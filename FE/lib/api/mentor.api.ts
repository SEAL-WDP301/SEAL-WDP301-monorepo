import { axiosClient } from "@/lib/axios";

export interface MentorTeamMember {
  id?: number;
  role?: string;
  status?: string;
  user?: {
    id?: number;
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
    avatar_url?: string | null;
  };
}

export interface MentorTeamRound {
  id?: number;
  teamId?: number;
  roundId?: number;
  status?: string; // "competing" | "advanced" | "eliminated" | "pending"
  score?: number | null;
  round?: MentorRound;
}

export interface MentorTeam {
  id: number;
  name: string;
  status?: string;
  createdAt?: string;
  event?: { id?: number; name?: string };
  track?: { id?: number; name?: string; maxMembersPerTeam?: number };
  leader?: { id?: number; name?: string | null; email?: string | null };
  members?: MentorTeamMember[];
  teamRounds?: MentorTeamRound[];
}

export interface MentorAssignment {
  id?: number;
  teamId: number;
  team?: MentorTeam;
}

export interface MentorProfile {
  id: number;
  name?: string | null;
  email: string;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  role?: string;
  stakeholderProfile?: {
    jobTitle?: string | null;
    organization?: string | null;
    organizationName?: string | null;
    experience?: string | null;
    achievements?: string | null;
    bio?: string | null;
    isPublic?: boolean;
  } | null;
  mentorAssignments?: MentorAssignment[];
}

export interface UserNotification {
  id: number;
  title: string;
  content: string;
  type?: string;
  isRead?: boolean;
  createdAt: string;
}

export interface MentorRound {
  id: number;
  name: string;
  roundNumber?: number;
  status?: string;
  submissionDeadline?: string | null;
  problemFileUrl?: string | null;
}

export interface MentorFeedback {
  id: number;
  mentorId?: number;
  teamId?: number;
  submissionId?: number;
  content: string;
  status?: string;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  team?: Pick<MentorTeam, "id" | "name" | "event" | "track">;
  submission?: Omit<MentorSubmission, "feedback">;
}

export interface MentorSubmission {
  id: number;
  teamId: number;
  roundId: number;
  status?: string;
  submissionType?: string;
  fileUrl?: string | null;
  githubUrl?: string | null;
  demoUrl?: string | null;
  slideUrl?: string | null;
  description?: string | null;
  submittedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  team?: MentorTeam;
  round?: MentorRound;
  feedback?: MentorFeedback | null;
  mentorFeedbacks?: MentorFeedback[];
}

export interface StudentWorkspaceMentor {
  id?: number;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  stakeholderProfile?: {
    jobTitle?: string | null;
    organization?: string | null;
    organizationName?: string | null;
    experience?: string | null;
    achievements?: string | null;
    bio?: string | null;
  } | null;
}

export interface StudentWorkspaceFeedback {
  id: number;
  mentorId?: number;
  teamId?: number;
  submissionId?: number;
  content: string;
  status?: string;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  mentor?: StudentWorkspaceMentor | null;
  submission?: {
    id?: number;
    round?: {
      id?: number;
      name?: string;
    } | null;
  } | null;
}

export interface StudentMentorWorkspaceData {
  team?: {
    id?: number;
    name?: string;
    mentorAssignments?: Array<{
      id?: number;
      mentor?: StudentWorkspaceMentor | null;
    }>;
  } | null;
  currentActiveRound?: {
    id?: number;
    name?: string;
  } | null;
  latestSubmission?: {
    id?: number;
    round?: {
      id?: number;
      name?: string;
    } | null;
    feedback?: StudentWorkspaceFeedback | null;
    mentorFeedbacks?: StudentWorkspaceFeedback[];
  } | null;
  submissions?: Array<{
    id?: number;
    round?: {
      id?: number;
      name?: string;
    } | null;
    feedback?: StudentWorkspaceFeedback | null;
    mentorFeedbacks?: StudentWorkspaceFeedback[];
  }>;
  feedback?: StudentWorkspaceFeedback[];
  mentorFeedback?: StudentWorkspaceFeedback[];
  mentorFeedbacks?: StudentWorkspaceFeedback[];
}

function unwrapData<T>(response: { data?: { data?: T } }) {
  return response.data?.data as T;
}

export async function getMentorProfile() {
  const response = await axiosClient.get("/users/profile");
  return unwrapData<MentorProfile>(response);
}

export async function getMentorNotifications() {
  const response = await axiosClient.get("/notifications");
  return unwrapData<UserNotification[]>(response) || [];
}

export async function updateMentorProfile(
  payload: NonNullable<MentorProfile["stakeholderProfile"]>
) {
  const response = await axiosClient.put("/users/profile/stakeholder", payload);
  return unwrapData<MentorProfile>(response);
}

export async function getMentorTeams(eventId?: string | number) {
  const url = eventId ? `/mentor/teams?eventId=${eventId}` : "/mentor/teams";
  const response = await axiosClient.get(url);
  return unwrapData<MentorTeam[]>(response) || [];
}

export async function getMentorTeam(teamId: string | number) {
  const response = await axiosClient.get(`/mentor/teams/${teamId}`);
  return unwrapData<MentorTeam>(response);
}

export async function getMentorTeamSubmissions(teamId: string | number) {
  const response = await axiosClient.get(`/mentor/teams/${teamId}/submissions`);
  const data =
    unwrapData<Array<MentorSubmission & { mentorFeedbacks?: MentorFeedback[] }>>(
      response
    ) || [];
  return data.map((sub) => ({
    ...sub,
    feedback: sub.mentorFeedbacks?.[0] || sub.feedback || null,
  })) as MentorSubmission[];
}

export async function getMentorSubmissions(eventId?: string | number) {
  const url = eventId ? `/mentor/submissions?eventId=${eventId}` : "/mentor/submissions";
  const response = await axiosClient.get(url);
  return unwrapData<MentorSubmission[]>(response) || [];
}

export async function getMentorSubmission(submissionId: string | number) {
  const response = await axiosClient.get(`/mentor/submissions/${submissionId}`);
  return unwrapData<MentorSubmission>(response);
}

export async function getMentorFeedback(eventId?: string | number) {
  const url = eventId ? `/mentor/feedback?eventId=${eventId}` : "/mentor/feedback";
  const response = await axiosClient.get(url);
  return unwrapData<MentorFeedback[]>(response) || [];
}

export async function getStudentMentorWorkspace(eventId: string | number) {
  const response = await axiosClient.get<{
    data: StudentMentorWorkspaceData;
  }>("/student/teams/my-team/workspace", {
    params: { eventId },
  });
  return response.data.data;
}

export async function getStudentAssignedMentor(eventId: string | number) {
  const response = await axiosClient.get<{
    data?: {
      teamInfo?: {
        team?: {
          mentorAssignments?: Array<{
            id?: number;
            mentor?: StudentWorkspaceMentor | null;
          }>;
        } | null;
      } | null;
    };
  }>(`/student/teams/status/${eventId}`);

  return (
    response.data?.data?.teamInfo?.team?.mentorAssignments?.[0]?.mentor || null
  );
}

export function getAssignedMentorTeams(profile?: MentorProfile | null) {
  return (profile?.mentorAssignments || [])
    .map((assignment) => assignment.team)
    .filter((team): team is MentorTeam => Boolean(team));
}

export async function updateStudentMentorFeedbackStatus(feedbackId: number | string, status: "unread" | "acknowledged" | "completed") {
  const response = await axiosClient.patch(`/student/teams/my-team/feedbacks/${feedbackId}/status`, { status });
  return response.data;
}
