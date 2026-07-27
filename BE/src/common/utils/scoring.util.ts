export interface ScoringRubric {
  id: number;
  maxScore: number;
  weight: number | { toString(): string };
}

export interface ScoringEntry {
  criterionId: number;
  scoreValue: number | { toString(): string };
}

export interface JudgeScoreEntry extends ScoringEntry {
  judgeId: number;
}

function toNumber(value: number | { toString(): string }): number {
  return typeof value === "number" ? value : Number(value);
}

export function isJudgeScoringComplete(
  rubrics: ScoringRubric[],
  scores: ScoringEntry[],
): boolean {
  if (rubrics.length === 0) return false;
  const scoredIds = new Set(scores.map((s) => s.criterionId));
  return rubrics.every((rubric) => scoredIds.has(rubric.id));
}

export function computeJudgeWeightedScore(
  rubrics: ScoringRubric[],
  scores: ScoringEntry[],
): number | null {
  if (rubrics.length === 0 || scores.length === 0) return null;

  const scoreMap = new Map(
    scores.map((s) => [s.criterionId, toNumber(s.scoreValue)]),
  );

  let weightedSum = 0;
  let totalWeight = 0;

  for (const rubric of rubrics) {
    const value = scoreMap.get(rubric.id);
    if (value === undefined) continue;

    const weight = toNumber(rubric.weight);
    const normalized = (value / rubric.maxScore) * 10;
    weightedSum += normalized * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return null;

  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

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
