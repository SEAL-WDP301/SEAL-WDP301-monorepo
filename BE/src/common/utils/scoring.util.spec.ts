import {
  computeJudgeWeightedScore,
  computeSubmissionFinalScore,
  isRubricWeightTotalValid,
  JUDGE_SCORE_SCALE,
  RUBRIC_WEIGHT_TOTAL,
} from "./scoring.util";

describe("scoring.util (weights as % totaling 100)", () => {
  // Criteria weights: 20 + 30 + 20 + 30 = 100
  const rubrics = [
    { id: 1, weight: 20 },
    { id: 2, weight: 30 },
    { id: 3, weight: 20 },
    { id: 4, weight: 30 },
  ];

  it("requires weights to total 100", () => {
    expect(isRubricWeightTotalValid(rubrics)).toBe(true);
    expect(RUBRIC_WEIGHT_TOTAL).toBe(100);
    expect(JUDGE_SCORE_SCALE).toBe(10);
  });

  it("maps judge 0-10 rating onto criterion weight percent", () => {
    // Criterion 1 weight 20%, score 8/10 → 8 * 20 / 100 = 1.6
    expect(
      computeJudgeWeightedScore([{ id: 1, weight: 20 }], [
        { criterionId: 1, scoreValue: 8 },
      ]),
    ).toBe(1.6);
  });

  it("sums all criterion contributions for a judge", () => {
    // all 10/10 → final 10
    expect(
      computeJudgeWeightedScore(rubrics, [
        { criterionId: 1, scoreValue: 10 },
        { criterionId: 2, scoreValue: 10 },
        { criterionId: 3, scoreValue: 10 },
        { criterionId: 4, scoreValue: 10 },
      ]),
    ).toBe(10);

    // 8*20/100 + 6*30/100 + 10*20/100 + 5*30/100 = 1.6 + 1.8 + 2 + 1.5 = 6.9
    expect(
      computeJudgeWeightedScore(rubrics, [
        { criterionId: 1, scoreValue: 8 },
        { criterionId: 2, scoreValue: 6 },
        { criterionId: 3, scoreValue: 10 },
        { criterionId: 4, scoreValue: 5 },
      ]),
    ).toBe(6.9);
  });

  it("allows decimal weights", () => {
    expect(
      isRubricWeightTotalValid([
        { id: 1, weight: 33.33 },
        { id: 2, weight: 33.33 },
        { id: 3, weight: 33.34 },
      ]),
    ).toBe(true);
  });

  it("averages complete judges only", () => {
    const finalScore = computeSubmissionFinalScore(rubrics, [
      { judgeId: 1, criterionId: 1, scoreValue: 10 },
      { judgeId: 1, criterionId: 2, scoreValue: 10 },
      { judgeId: 1, criterionId: 3, scoreValue: 10 },
      { judgeId: 1, criterionId: 4, scoreValue: 10 },
      { judgeId: 2, criterionId: 1, scoreValue: 5 },
    ]);
    expect(finalScore).toBe(10);
  });
});
