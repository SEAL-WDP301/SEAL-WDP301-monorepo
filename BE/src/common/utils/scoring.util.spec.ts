import {
  computeJudgeWeightedScore,
  computeSubmissionFinalScore,
  isRubricWeightTotalValid,
  JUDGE_SCORE_SCALE,
  RUBRIC_WEIGHT_TOTAL,
} from "./scoring.util";

describe("scoring.util (parts out of 10)", () => {
  // Criteria shares: 2 + 3 + 2 + 3 = 10
  const rubrics = [
    { id: 1, weight: 2 },
    { id: 2, weight: 3 },
    { id: 3, weight: 2 },
    { id: 4, weight: 3 },
  ];

  it("requires weights to total 10", () => {
    expect(isRubricWeightTotalValid(rubrics)).toBe(true);
    expect(RUBRIC_WEIGHT_TOTAL).toBe(10);
    expect(JUDGE_SCORE_SCALE).toBe(10);
  });

  it("maps judge 0-10 rating onto criterion weight share", () => {
    // Criterion 1 weight 2, score 8/10 → (8/10)*2 = 1.6
    expect(
      computeJudgeWeightedScore([{ id: 1, weight: 2 }], [
        { criterionId: 1, scoreValue: 8 },
      ]),
    ).toBe(1.6);
  });

  it("sums all criterion contributions for a judge", () => {
    // (10/10)*2 + (10/10)*3 + (10/10)*2 + (10/10)*3 = 10
    expect(
      computeJudgeWeightedScore(rubrics, [
        { criterionId: 1, scoreValue: 10 },
        { criterionId: 2, scoreValue: 10 },
        { criterionId: 3, scoreValue: 10 },
        { criterionId: 4, scoreValue: 10 },
      ]),
    ).toBe(10);

    // (8/10)*2 + (6/10)*3 + (10/10)*2 + (5/10)*3 = 1.6 + 1.8 + 2 + 1.5 = 6.9
    expect(
      computeJudgeWeightedScore(rubrics, [
        { criterionId: 1, scoreValue: 8 },
        { criterionId: 2, scoreValue: 6 },
        { criterionId: 3, scoreValue: 10 },
        { criterionId: 4, scoreValue: 5 },
      ]),
    ).toBe(6.9);
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
