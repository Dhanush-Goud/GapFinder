import { describe, expect, it } from "vitest";
import type { EvaluatedAnswer, QuizAttempt, Topic } from "@/types/domain";
import { computeMastery, explainMastery, levelFor, snapshotsAfterAttempt } from "@/lib/diagnosis/mastery";
import { DEFAULT_MASTERY_CONFIG } from "@/lib/diagnosis/config";

const topics: Topic[] = [
  { id: "u1", code: "1", name: "Arrays", description: "", parentId: null, importance: 3, sourceRefs: [], origin: "parsed" },
  { id: "u1.1", code: "1.1", name: "Indexing", description: "", parentId: "u1", importance: 3, sourceRefs: [], origin: "parsed" },
  { id: "u2", code: "2", name: "Graphs", description: "", parentId: null, importance: 2, sourceRefs: [], origin: "parsed" },
];

function result(topicId: string, correct: boolean, qid: string, score = correct ? 1 : 0): EvaluatedAnswer {
  return {
    questionId: qid, topicId, type: "mcq", difficulty: "easy", prompt: `Q ${qid}`, options: ["a", "b", "c", "d"], selectedOption: 0, answerText: null,
    correctOption: correct ? 0 : 1, expectedAnswer: null, score, isCorrect: correct, explanation: "", understood: [], missing: [],
    misconceptions: correct ? [] : ["Mixing up X and Y"], citations: [], evaluator: "deterministic",
  };
}

function attempt(id: string, day: number, results: EvaluatedAnswer[]): QuizAttempt {
  const at = new Date(Date.UTC(2026, 9, day)).toISOString();
  return { id, createdAt: at, completedAt: at, topicIds: [], difficulty: "mixed", status: "completed", questions: [], results, score: null, isSample: false };
}

describe("mastery thresholds", () => {
  it("labels weak below 50%, medium 50–79%, strong at 80%+", () => {
    expect(levelFor(0.49, 5)).toBe("weak");
    expect(levelFor(0.5, 5)).toBe("medium");
    expect(levelFor(0.79, 5)).toBe("medium");
    expect(levelFor(0.8, 5)).toBe("strong");
    expect(levelFor(1, 5)).toBe("strong");
    expect(levelFor(0, 3)).toBe("weak");
  });

  it("returns insufficient evidence below the minimum number of answers", () => {
    expect(levelFor(1, DEFAULT_MASTERY_CONFIG.minEvidence - 1)).toBe("insufficient");
    expect(levelFor(null, 0)).toBe("insufficient");
  });

  it("respects a custom configuration", () => {
    expect(levelFor(0.6, 2, { ...DEFAULT_MASTERY_CONFIG, minEvidence: 2, weakBelow: 0.7 })).toBe("weak");
  });
});

describe("computeMastery", () => {
  it("computes accuracy from actual answers and rolls sub-topics into parents", () => {
    const a = attempt("a1", 1, [result("u1.1", true, "q1"), result("u1", true, "q2"), result("u1", false, "q3"), result("u2", false, "q4")]);
    const m = computeMastery(topics, [a]);
    expect(m.get("u1")).toMatchObject({ attempted: 3, correct: 2, level: "medium" });
    expect(m.get("u1.1")).toMatchObject({ attempted: 1, level: "insufficient" });
    expect(m.get("u2")).toMatchObject({ attempted: 1, level: "insufficient" });
    expect(m.get("u1")!.misconceptions).toEqual(["Mixing up X and Y"]);
  });

  it("uses the recent window so improvement changes the label", () => {
    const first = attempt("a1", 1, [1, 2, 3, 4, 5, 6].map((i) => result("u2", i === 1, `w${i}`)));
    const second = attempt("a2", 2, [1, 2, 3, 4, 5, 6].map((i) => result("u2", true, `r${i}`)));
    const before = computeMastery(topics, [first]).get("u2")!;
    const after = computeMastery(topics, [first, second]).get("u2")!;
    expect(before.level).toBe("weak");
    expect(after.level).toBe("strong");
    expect(after.recentAccuracy).toBe(1);
    expect(after.accuracy).toBeCloseTo(7 / 12, 4); // all-time history is kept
  });

  it("counts partial credit for short answers", () => {
    const a = attempt("a1", 1, [result("u2", false, "s1", 0.5), result("u2", true, "q2"), result("u2", false, "q3", 0)]);
    expect(computeMastery(topics, [a]).get("u2")!.recentAccuracy).toBeCloseTo(0.5, 4);
  });

  it("ignores attempts that were not completed", () => {
    const a = { ...attempt("a1", 1, [result("u2", true, "q1")]), status: "in_progress" as const };
    expect(computeMastery(topics, [a]).get("u2")!.attempted).toBe(0);
  });

  it("explains a label with the numbers behind it", () => {
    const a = attempt("a1", 1, [result("u2", false, "1"), result("u2", false, "2"), result("u2", true, "3"), result("u2", false, "4")]);
    expect(explainMastery(computeMastery(topics, [a]).get("u2")!)).toMatch(/last 4 answers.*1 of 4 correct \(25%\).*below the 50% weak threshold/);
  });

  it("writes snapshots for touched topics and their ancestors", () => {
    const a = attempt("a1", 1, [result("u1.1", true, "q1")]);
    const snaps = snapshotsAfterAttempt(topics, [a], a);
    expect(snaps.map((s) => s.topicId).sort()).toEqual(["u1", "u1.1"]);
  });
});
