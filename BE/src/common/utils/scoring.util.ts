export interface ScoringRubric {
  id: number;
  /** Kept for DB compat; scoring always uses JUDGE_SCORE_SCALE. */
  maxScore?: number;
  weight: number | { toString(): string };
}

export interface ScoringEntry {
  criterionId: number;
  scoreValue: number | { toString(): string };
}

export interface JudgeScoreEntry extends ScoringEntry {
  judgeId: number;
}

/** Each criterion weight ("phần") must sum to this for a round/track. */
export const RUBRIC_WEIGHT_TOTAL = 10;
/** Judges always rate every criterion on this 0–10 scale. */
export const JUDGE_SCORE_SCALE = 10;
const WEIGHT_EPSILON = 0.001;

function toNumber(value: number | { toString(): string }): number {
  return typeof value === "number" ? value : Number(value);
}

export function sumRubricWeights(rubrics: ScoringRubric[]): number {
  return rubrics.reduce((sum, rubric) => sum + toNumber(rubric.weight), 0);
}

export function isRubricWeightTotalValid(
  rubrics: ScoringRubric[],
  expected = RUBRIC_WEIGHT_TOTAL,
): boolean {
  return Math.abs(sumRubricWeights(rubrics) - expected) <= WEIGHT_EPSILON;
}

export function isJudgeScoringComplete(
  rubrics: ScoringRubric[],
  scores: ScoringEntry[],
): boolean {
  if (rubrics.length === 0) return false;
  const scoredIds = new Set(scores.map((s) => s.criterionId));
  return rubrics.every((rubric) => scoredIds.has(rubric.id));
}

/**
 * Example: weights 2+3+2+3 = 10. Judge gives criterion-1 score 8/10
 * → contribution = (8/10)*2 = 1.6
 * Judge total = Σ (score/10)*weight  (scale /10)
 */
export function computeJudgeWeightedScore(
  rubrics: ScoringRubric[],
  scores: ScoringEntry[],
): number | null {
  if (rubrics.length === 0 || scores.length === 0) return null;

  const scoreMap = new Map(
    scores.map((s) => [s.criterionId, toNumber(s.scoreValue)]),
  );

  let total = 0;
  let scoredAny = false;

  for (const rubric of rubrics) {
    const value = scoreMap.get(rubric.id);
    if (value === undefined) continue;

    scoredAny = true;
    total += (value / JUDGE_SCORE_SCALE) * toNumber(rubric.weight);
  }

  if (!scoredAny) return null;

  return Math.round(total * 100) / 100;
}

/** Submission final = average of judges who finished all criteria. */
export function computeSubmissionFinalScore(
  rubrics: ScoringRubric[],
  scores: JudgeScoreEntry[],
): number | null {
  const scoresByJudge = new Map<number, ScoringEntry[]>();

  for (const score of scores) {
    const existing = scoresByJudge.get(score.judgeId) ?? [];
    existing.push(score);
    scoresByJudge.set(score.judgeId, existing);
  }

  const judgeTotals: number[] = [];

  for (const judgeScores of scoresByJudge.values()) {
    if (!isJudgeScoringComplete(rubrics, judgeScores)) continue;

    const weighted = computeJudgeWeightedScore(rubrics, judgeScores);
    if (weighted !== null) judgeTotals.push(weighted);
  }

  if (judgeTotals.length === 0) return null;

  const average =
    judgeTotals.reduce((sum, value) => sum + value, 0) / judgeTotals.length;

  return Math.round(average * 100) / 100;
}
