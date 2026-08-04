import { axiosClient } from "../axios";

export type JudgeScoringStatus = "pending" | "in_review" | "completed";

export interface JudgeAssignedRound {
  assignmentId: number;
  roundId: number;
  roundNumber: number;
  roundName: string;
  roundStatus: string;
  submissionDeadline?: string | null;
  trackId: number | null;
  trackName: string | null;
}

export interface JudgeAssignedEvent {
  id: number;
  name: string;
  season: string;
  year: number;
  status: string;
  rounds: JudgeAssignedRound[];
}

export interface JudgeRoundSubmission {
  submissionId: number;
  id: number;
  teamName: string;
  anonymousIndex?: number;
  track: { id: number; name: string };
  status: string;
  githubUrl?: string | null;
  submittedAt?: string | null;
  scoringStatus: JudgeScoringStatus;
  scoredCriteria: number;
  totalCriteria: number;
  weightedScore?: number | null;
  isVotedByMe?: boolean;
  /** True when this judge also mentors the team — scoring blocked. */
  mentoredByMe?: boolean;
}

export interface JudgeRubric {
  id: number;
  name: string;
  description?: string | null;
  maxScore: number;
  weight: number | string;
}

export interface JudgeScoreEntry {
  criterionId: number;
  scoreValue: number | string;
  comment?: string | null;
  criterion?: JudgeRubric;
}

export type JudgeSubmissionType = "file" | "github_link";

export interface JudgeSubmissionDetail {
  id: number;
  status: string;
  submissionType?: JudgeSubmissionType | null;
  fileUrl?: string | null;
  githubUrl?: string | null;
  description?: string | null;
  submittedAt?: string | null;
  teamId?: number;
  team: {
    id?: number;
    name: string;
    anonymousIndex?: number;
    track: { id: number; name: string };
  };
  round: {
    id: number;
    name: string;
    roundNumber: number;
    status: string;
    submissionType?: JudgeSubmissionType | null;
    submissionDeadline?: string | null;
    problemFileUrl?: string | null;
  };
  event: { id: number; name: string; season: string; year: number };
  rubrics: JudgeRubric[];
  myScores: JudgeScoreEntry[];
  scoringStatus: JudgeScoringStatus;
  weightedScore?: number | null;
  isVotedByMe?: boolean;
  mentoredByMe?: boolean;
}

export interface AiScoreSuggestion {
  criterionId: number;
  scoreValue: number;
  comment: string;
}

export interface AiSuggestScoresResult {
  auditId: number;
  suggestions: AiScoreSuggestion[];
  source: JudgeSubmissionType;
  contextSummary: string;
}

export interface SubmitJudgeScoresPayload {
  scores: Array<{
    criterionId: number;
    scoreValue: number;
    comment?: string;
  }>;
}

export const judgeApi = {
  getAssignedEvents: async () => {
    const response = await axiosClient.get("/judge/events");
    const data = response.data?.data as JudgeAssignedEvent[] || [];
    
    return data.map(event => {
      // Deduplicate rounds by roundId because a judge can be assigned to multiple tracks in the same round
      const uniqueRounds = Array.from(
        new Map(event.rounds.map(r => [r.roundId, r])).values()
      );
      return { ...event, rounds: uniqueRounds };
    });
  },

  getRoundSubmissions: async (roundId: number) => {
    const response = await axiosClient.get(`/judge/rounds/${roundId}/submissions`);
    return response.data?.data as JudgeRoundSubmission[];
  },

  getSubmissionDetail: async (submissionId: number) => {
    const response = await axiosClient.get(`/judge/submissions/${submissionId}`);
    return response.data?.data as JudgeSubmissionDetail;
  },

  submitScores: async (
    submissionId: number,
    payload: SubmitJudgeScoresPayload,
  ) => {
    const response = await axiosClient.put(
      `/judge/submissions/${submissionId}/scores`,
      payload,
    );
    return response.data?.data as {
      scoringStatus: JudgeScoringStatus;
      weightedScore: number | null;
    };
  },

  suggestScores: async (submissionId: number) => {
    const response = await axiosClient.post(
      `/judge/submissions/${submissionId}/ai-suggest`,
      undefined,
      { timeout: 90_000 },
    );
    return response.data?.data as AiSuggestScoresResult;
  },

  applyAiSuggestion: async (auditId: number) => {
    const response = await axiosClient.post(
      `/judge/ai-suggestions/${auditId}/apply`,
    );
    return response.data?.data;
  },

  discardAiSuggestion: async (auditId: number) => {
    const response = await axiosClient.post(
      `/judge/ai-suggestions/${auditId}/discard`,
    );
    return response.data?.data;
  },

  toggleVote: async (submissionId: number) => {
    const response = await axiosClient.post(`/judge/submissions/${submissionId}/vote`);
    return response.data?.data as { isVotedByMe: boolean };
  },
};

/** Judge rates each criterion 0–10; weight is % of final (total 100%). */
export const JUDGE_SCORE_SCALE = 10;
export const RUBRIC_WEIGHT_TOTAL = 100;

export function criterionContribution(
  scoreValue: number,
  weightPercent: number,
): number {
  return (
    (scoreValue / JUDGE_SCORE_SCALE) *
    (weightPercent / 100) *
    JUDGE_SCORE_SCALE
  );
}

export function computeLocalWeightedScore(
  rubrics: JudgeRubric[],
  scores: Record<number, number>,
): number | null {
  if (!rubrics.length) return null;

  let total = 0;
  let scoredAny = false;

  for (const rubric of rubrics) {
    const value = scores[rubric.id];
    if (value === undefined) continue;

    scoredAny = true;
    total += criterionContribution(value, Number(rubric.weight));
  }

  if (!scoredAny) return null;
  return Math.round(total * 100) / 100;
}

/** Display weighted scores with full precision (no rounding to 1 decimal). */
export function formatJudgeScore(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(Number(score))) return "—";
  return Number(score).toFixed(2);
}

export function mapScoringStatusLabel(status: JudgeScoringStatus) {
  switch (status) {
    case "completed":
      return "Completed";
    case "in_review":
      return "In Review";
    default:
      return "Pending";
  }
}

export function formatSubmissionLabel(submission: {
  id: number;
  submissionId?: number;
  anonymousIndex?: number;
  teamName?: string;
  name?: string;
}) {
  if (submission.teamName) return submission.teamName;
  if (submission.name) return submission.name;
  const value = submission.anonymousIndex ?? submission.submissionId ?? submission.id;
  return `Team #${String(value).padStart(3, "0")}`;
}
