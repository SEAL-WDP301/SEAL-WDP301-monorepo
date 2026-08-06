import { axiosClient } from "@/lib/axios";

export type EventSeason = "Spring" | "Summer" | "Fall";
export type EventStatus = "draft" | "active" | "ongoing" | "closed";
export type SubmissionType = "file" | "github_link";

export interface OrganizerTrackInput {
  id?: number;
  name: string;
  description?: string;
}

export interface OrganizerRoundInput {
  id?: number;
  roundNumber: number;
  name: string;
  submissionType: SubmissionType;
  submissionDeadline?: string;
  maxFileSizeMb?: number;
  isTrackSpecific: boolean;
  trackId?: number | null;
}

export interface OrganizerEventLocation {
  name?: string;
  venueName?: string;
  room?: string;
  address?: string;
  meetingPlatform?: string;
  meetingUrl?: string;
  mapUrl?: string;
  note?: string;
}

export interface OrganizerEventContact {
  label?: string;
  type?: string;
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  detail?: string;
  responseTime?: string;
}

export interface OrganizerEventRuleGroup {
  title?: string;
  name?: string;
  category?: string;
  rules: string[];
}

export interface OrganizerEventFAQItem {
  question?: string;
  q?: string;
  title?: string;
  answer?: string;
  a?: string;
  content?: string;
}

export interface OrganizerPrizeInput {
  id?: number;
  name: string;
  description?: string;
  quantity?: number;
  amount?: number;
  placement?: number | null;
  currency?: string;
}

export interface PrizePoolTotal {
  currency: string;
  amount: number;
}

export interface OrganizerPrize extends OrganizerPrizeInput {
  id: number;
}

export interface OrganizerEventPayload {
  name: string;
  description?: string;
  imageUrl?: string;
  season: EventSeason;
  year: number;
  maxTeams?: number | null;
  minMembersPerTeam: number;
  maxMembersPerTeam: number;
  /** Register without track; random reveal when a round opens */
  deferredTrackAssignment?: boolean;
  status?: EventStatus;
  registrationDeadline?: string;
  startDate?: string;
  endDate?: string;
  githubOrgUrl?: string;
  tracks?: OrganizerTrackInput[];
  rounds: OrganizerRoundInput[];
  prizes?: OrganizerPrizeInput[];
  location?: string;
  contact?: string;
  rules?: string;
  faq?: OrganizerEventFAQItem[];
}

export interface OrganizerTrack extends OrganizerTrackInput {
  id: number;
  _count?: {
    teams?: number;
  };
}

export interface OrganizerRoundTrackProblem {
  id?: number;
  roundId?: number;
  trackId: number;
  problemFileUrl?: string | null;
}

export interface OrganizerRound extends OrganizerRoundInput {
  id: number;
  status?: "not_started" | "open" | "closed" | "results_published" | string;
  startDate?: string;
  problemFileUrl?: string | null;
  trackProblems?: OrganizerRoundTrackProblem[];
  track?: OrganizerTrack | null;
  _count?: {
    submissions?: number;
  };
}

export interface OrganizerEvent extends Omit<
  OrganizerEventPayload,
  "tracks" | "rounds" | "imageUrl" | "endDate"
> {
  id: number;
  imageUrl?: string | null;
  image_url?: string | null;
  endDate?: string | null;
  icons?: Array<{
    id?: number;
    url: string;
  }>;
  tracks?: OrganizerTrack[];
  rounds?: OrganizerRound[];
  prizes?: OrganizerPrize[];
  prizePoolTotals?: PrizePoolTotal[];
  registeredTeams?: number;
  calendarMeeting?: EventCalendarMeeting | null;
  _count?: {
    teams?: number;
    submissions?: number;
  };
}

export interface GoogleCalendarStatus {
  connected: boolean;
  connectedAt?: string;
}

export interface EventCalendarMeeting {
  id: number;
  eventId: number;
  googleEventId: string;
  calendarId: string;
  meetUrl?: string | null;
  htmlLink?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  timeZone?: string;
  attendeeCount?: number;
  registeredAttendeeCount?: number;
}

export interface OrganizerRubric {
  id: number;
  name: string;
  description?: string | null;
  maxScore: number;
  weight: number;
  roundId: number;
  trackId?: number | null;
  round?: OrganizerRound;
  track?: OrganizerTrack | null;
}

export interface OrganizerRubricPayload {
  name: string;
  description?: string;
  maxScore: number;
  weight: number;
  roundId: number;
  trackId?: number | null;
}

export interface OrganizerRubricFilters {
  roundId?: string | number;
  trackId?: string | number | null;
}

function unwrapData<T>(response: { data?: { data?: T } }) {
  return response.data?.data as T;
}

function normalizeOrganizerEvent(event: OrganizerEvent): OrganizerEvent {
  return {
    ...event,
    endDate: event.endDate ?? undefined,
  };
}

export async function getOrganizerEvents() {
  const res = await axiosClient.get("/organizer/events");
  return (unwrapData<OrganizerEvent[]>(res) || []).map(normalizeOrganizerEvent);
}

export async function getOrganizerEvent(eventId: string | number) {
  const res = await axiosClient.get(`/organizer/events/${eventId}`);
  const event = unwrapData<OrganizerEvent>(res);
  return event ? normalizeOrganizerEvent(event) : undefined;
}

export async function createOrganizerEvent(payload: OrganizerEventPayload) {
  const res = await axiosClient.post("/organizer/events", payload);
  return normalizeOrganizerEvent(unwrapData<OrganizerEvent>(res));
}

export async function updateOrganizerEvent(
  eventId: string | number,
  payload: OrganizerEventPayload,
) {
  const res = await axiosClient.put(`/organizer/events/${eventId}`, payload);
  return normalizeOrganizerEvent(unwrapData<OrganizerEvent>(res));
}

export async function updateOrganizerEventStatus(
  eventId: string | number,
  status: EventStatus,
) {
  const res = await axiosClient.patch(`/organizer/events/${eventId}/status`, {
    status,
  });
  return normalizeOrganizerEvent(unwrapData<OrganizerEvent>(res));
}

export async function deleteOrganizerEvent(eventId: string | number) {
  await axiosClient.delete(`/organizer/events/${eventId}`);
}

export async function getGoogleCalendarStatus() {
  const response = await axiosClient.get("/integrations/google/status");
  return unwrapData<GoogleCalendarStatus>(response);
}

export async function getGoogleCalendarAuthorizationUrl() {
  const response = await axiosClient.post("/integrations/google/authorize-url");
  return unwrapData<{ url: string }>(response).url;
}

export async function disconnectGoogleCalendar() {
  await axiosClient.delete("/integrations/google/disconnect");
}

export interface SyncGoogleCalendarMeetingInput {
  meetingStartDate?: string;
  meetingEndDate?: string;
  attendeeEmails?: string[];
  sendInvitations?: boolean;
  notifyParticipants?: boolean;
  timeZone?: string;
}

export async function createGoogleCalendarMeeting(
  eventId: string | number,
  input: SyncGoogleCalendarMeetingInput,
) {
  const response = await axiosClient.post<{ data: EventCalendarMeeting }>(
    `/organizer/events/${eventId}/calendar-meeting`,
    input,
  );
  return response.data.data;
}

export async function updateGoogleCalendarMeeting(
  eventId: string | number,
  input: SyncGoogleCalendarMeetingInput,
) {
  const response = await axiosClient.patch<{ data: EventCalendarMeeting }>(
    `/organizer/events/${eventId}/calendar-meeting`,
    input,
  );
  return response.data.data;
}

export async function getOrganizerRubrics(
  eventId: string | number,
  filters: OrganizerRubricFilters = {},
) {
  const params = new URLSearchParams();

  if (filters.roundId) {
    params.set("roundId", String(filters.roundId));
  }

  if (filters.trackId !== undefined && filters.trackId !== null) {
    params.set("trackId", String(filters.trackId));
  }

  const query = params.toString();
  const res = await axiosClient.get(
    `/organizer/events/${eventId}/rubrics${query ? `?${query}` : ""}`,
  );
  return unwrapData<OrganizerRubric[]>(res);
}

export async function createOrganizerRubric(
  eventId: string | number,
  payload: OrganizerRubricPayload,
) {
  const res = await axiosClient.post(
    `/organizer/events/${eventId}/rubrics`,
    payload,
  );
  return unwrapData<OrganizerRubric>(res);
}

export interface SuggestedRubricCriterion {
  name: string;
  description: string;
  weight: number;
  whyChosen: string;
}

export interface SuggestRubricsResult {
  basedOn: {
    eventName: string;
    roundName: string;
    tracks: Array<{ name: string; description: string | null }>;
    problemStatements: Array<{
      label: string;
      trackName: string | null;
      source: "shared" | "track";
    }>;
    existingCriteria: string[];
  };
  overallRationale: string;
  criteria: SuggestedRubricCriterion[];
}

export async function suggestOrganizerRubrics(
  eventId: string | number,
  roundId: number,
) {
  const res = await axiosClient.post(
    `/organizer/events/${eventId}/rubrics/suggest`,
    { roundId },
    { timeout: 90_000 },
  );
  return unwrapData<SuggestRubricsResult>(res);
}

export async function bulkCreateOrganizerRubrics(
  eventId: string | number,
  payload: { rubrics: OrganizerRubricPayload[] },
) {
  const res = await axiosClient.post(
    `/organizer/events/${eventId}/rubrics/bulk`,
    payload,
  );
  return unwrapData<OrganizerRubric[]>(res);
}

export async function updateOrganizerRubric(
  eventId: string | number,
  rubricId: string | number,
  payload: OrganizerRubricPayload,
) {
  const res = await axiosClient.put(
    `/organizer/events/${eventId}/rubrics/${rubricId}`,
    payload,
  );
  return unwrapData<OrganizerRubric>(res);
}

export async function deleteOrganizerRubric(
  eventId: string | number,
  rubricId: string | number,
) {
  await axiosClient.delete(`/organizer/events/${eventId}/rubrics/${rubricId}`);
}

export async function bulkDeleteOrganizerRubrics(
  eventId: string | number,
  rubricIds: number[],
) {
  await axiosClient.delete(`/organizer/events/${eventId}/rubrics/bulk`, {
    data: { rubricIds },
  });
}

export interface DetailedCriterionAverage {
  criterionId: number;
  name: string;
  maxScore: number;
  weight: number;
  averageScore: number;
}

export interface DetailedJudgeScore {
  judgeId: number;
  judgeName: string;
  status: "completed" | "partial" | "pending";
  totalGivenScore: number | null;
  deviationFromAverage: number | null;
  comment?: string;
  criteriaScores: {
    criterionId: number;
    scoreValue: number;
  }[];
}

export interface DetailedRankedTeamEntry {
  rank: number;
  teamId: number;
  teamName: string;
  trackId: number;
  trackName: string;
  submissionId: number | null;
  finalScore: number | null;
  criteriaAverages: DetailedCriterionAverage[];
  judges: DetailedJudgeScore[];
  judgesAssigned?: number;
  judgesScored?: number;
  status: string;
  award?: OrganizerPrize | null;
  submittedAt: string;
  totalVotes?: number;
  votedBy?: {
    id: number;
    name: string;
    avatarUrl?: string;
  }[];
}

export interface DetailedRankingsResponse {
  round: {
    id: number;
    name: string;
    roundNumber: number;
    status: string;
    isFinalRound: boolean;
    isTrackSpecific?: boolean;
  };
  tracks: {
    track: { id: number; name: string };
    entries: DetailedRankedTeamEntry[];
  }[];
}

export async function getDetailedRoundRankings(
  eventId: string | number,
  roundId: string | number,
  trackId?: string | number,
) {
  const params = new URLSearchParams();
  if (trackId !== undefined && trackId !== null) {
    params.set("trackId", String(trackId));
  }
  const query = params.toString();
  const res = await axiosClient.get(
    `/organizer/events/${eventId}/rounds/${roundId}/rankings/detailed${query ? `?${query}` : ""}`,
  );
  return unwrapData<DetailedRankingsResponse>(res);
}

export async function getRoundRankings(
  eventId: string | number,
  roundId: string | number,
  trackId?: string | number,
) {
  const params = new URLSearchParams();
  if (trackId !== undefined && trackId !== null) {
    params.set("trackId", String(trackId));
  }
  const query = params.toString();
  const res = await axiosClient.get(
    `/organizer/events/${eventId}/rounds/${roundId}/rankings${query ? `?${query}` : ""}`,
  );
  return unwrapData<unknown>(res);
}

export interface PublishResultsPayload {
  /** Non-final: top N to advance (per track if track-specific, else whole round). */
  advanceCount?: number;
  advancingTeamIds?: number[];
  awards?: { teamId: number; awardId: number | null }[];
}

export async function publishRoundResults(
  eventId: string | number,
  roundId: string | number,
  payload: PublishResultsPayload,
) {
  const res = await axiosClient.post(
    `/organizer/events/${eventId}/rounds/${roundId}/publish-results`,
    payload,
  );
  return unwrapData<unknown>(res);
}

export async function updateRoundProblemFile(
  eventId: string | number,
  roundId: string | number,
  problemFileUrl: string | null,
  trackId?: number | null,
) {
  const res = await axiosClient.patch(
    `/organizer/events/${eventId}/rounds/${roundId}/problem-file`,
    { problemFileUrl, ...(trackId != null ? { trackId } : {}) },
  );
  return unwrapData<unknown>(res);
}

export async function createRoundTrack(
  eventId: string | number,
  roundId: string | number,
  body: { name: string; description?: string },
) {
  const res = await axiosClient.post(
    `/organizer/events/${eventId}/rounds/${roundId}/tracks`,
    body,
  );
  return unwrapData<OrganizerTrack>(res);
}

export async function updateTrackMetadata(
  eventId: string | number,
  trackId: number,
  body: { name: string; description?: string },
) {
  const res = await axiosClient.patch(
    `/organizer/events/${eventId}/tracks/${trackId}`,
    body,
  );
  return unwrapData<OrganizerTrack>(res);
}

/** Unscope a track from a round (delete the RoundTrackProblem row). Does NOT
 * delete the track itself — it stays in the event catalog / other rounds. */
export async function removeTrackFromRound(
  eventId: string | number,
  roundId: string | number,
  trackId: number,
) {
  const res = await axiosClient.delete(
    `/organizer/events/${eventId}/rounds/${roundId}/tracks/${trackId}`,
  );
  return unwrapData<unknown>(res);
}

export async function revealEventTracks(
  eventId: string | number,
  forceReassign = false,
) {
  const res = await axiosClient.post(
    `/organizer/events/${eventId}/tracks/reveal`,
    { forceReassign },
  );
  return unwrapData<{
    assignedCount: number;
    skippedAlreadyAssigned: number;
    trackCounts: Array<{
      trackId: number;
      trackName: string;
      teamCount: number;
    }>;
  }>(res);
}
