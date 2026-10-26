// Deterministic, explainable gap analysis. Labels come only from evaluated answers —
// never from a model's opinion.
import type { MasteryLevel, MasterySnapshot, QuizAttempt, Topic, TopicMastery } from "@/types/domain";
import { descendantsOf } from "@/lib/rag/link";
import { DEFAULT_MASTERY_CONFIG, type MasteryConfig } from "./config";

export function levelFor(accuracy: number | null, evidenceCount: number, config: MasteryConfig = DEFAULT_MASTERY_CONFIG): MasteryLevel {
  if (accuracy === null || evidenceCount < config.minEvidence) return "insufficient";
  if (accuracy < config.weakBelow) return "weak";
  if (accuracy >= config.strongAtOrAbove) return "strong";
  return "medium";
}

export const LEVEL_LABEL: Record<MasteryLevel, string> = {
  weak: "Weak",
  medium: "Developing",
  strong: "Strong",
  insufficient: "Not enough evidence",
};

interface AnswerRecord {
  attemptId: string;
  completedAt: string;
  questionId: string;
  topicId: string;
  prompt: string;
  score: number;
  isCorrect: boolean;
  misconceptions: string[];
}

function answerRecords(attempts: QuizAttempt[]): AnswerRecord[] {
  return attempts
    .filter((a) => a.status === "completed" && a.results && a.completedAt)
    .sort((a, b) => a.completedAt!.localeCompare(b.completedAt!))
    .flatMap((a) =>
      a.results!.map((r) => ({
        attemptId: a.id,
        completedAt: a.completedAt!,
        questionId: r.questionId,
        topicId: r.topicId,
        prompt: r.prompt,
        score: r.score,
        isCorrect: r.isCorrect,
        misconceptions: r.misconceptions,
      }))
    );
}

/** Mastery for every topic, rolling sub-topic answers up into their parents. */
export function computeMastery(
  topics: Topic[],
  attempts: QuizAttempt[],
  config: MasteryConfig = DEFAULT_MASTERY_CONFIG
): Map<string, TopicMastery> {
  const records = answerRecords(attempts);
  const result = new Map<string, TopicMastery>();
  for (const topic of topics) {
    const scope = new Set([topic.id, ...descendantsOf(topic.id, topics)]);
    const mine = records.filter((r) => scope.has(r.topicId));
    const window = mine.slice(-config.recentWindow);
    const sum = (rs: AnswerRecord[]) => rs.reduce((n, r) => n + r.score, 0);
    const accuracy = mine.length ? sum(mine) / mine.length : null;
    const recentAccuracy = window.length ? sum(window) / window.length : null;
    const misconceptionCounts = new Map<string, number>();
    for (const r of window) for (const m of r.misconceptions) misconceptionCounts.set(m, (misconceptionCounts.get(m) ?? 0) + 1);
    result.set(topic.id, {
      topicId: topic.id,
      attempted: mine.length,
      correct: round2(sum(mine)),
      accuracy: accuracy === null ? null : round4(accuracy),
      windowAttempted: window.length,
      windowCorrect: round2(sum(window)),
      recentAccuracy: recentAccuracy === null ? null : round4(recentAccuracy),
      level: levelFor(recentAccuracy, window.length, config),
      misconceptions: Array.from(misconceptionCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([m]) => m)
        .slice(0, 5),
      lastAssessed: mine.length ? mine[mine.length - 1].completedAt : null,
      evidence: window.map((r) => ({ questionId: r.questionId, attemptId: r.attemptId, prompt: r.prompt, score: r.score, isCorrect: r.isCorrect })),
    });
  }
  return result;
}

/** Snapshot rows written after an attempt completes — the basis of "mastery over time". */
export function snapshotsAfterAttempt(
  topics: Topic[],
  attemptsIncludingThisOne: QuizAttempt[],
  attempt: QuizAttempt,
  config: MasteryConfig = DEFAULT_MASTERY_CONFIG
): MasterySnapshot[] {
  const mastery = computeMastery(topics, attemptsIncludingThisOne, config);
  const touched = new Set<string>();
  for (const r of attempt.results ?? []) {
    touched.add(r.topicId);
    let parent = topics.find((t) => t.id === r.topicId)?.parentId ?? null;
    while (parent) {
      touched.add(parent);
      parent = topics.find((t) => t.id === parent)?.parentId ?? null;
    }
  }
  return Array.from(touched).map((topicId) => {
    const m = mastery.get(topicId)!;
    return {
      attemptId: attempt.id,
      createdAt: attempt.completedAt ?? new Date().toISOString(),
      topicId,
      attempted: m.windowAttempted,
      correct: m.windowCorrect,
      accuracy: m.recentAccuracy,
      level: m.level,
    };
  });
}

export function overallMastery(mastery: Map<string, TopicMastery>, topLevelIds: string[]): number | null {
  const assessed = topLevelIds.map((id) => mastery.get(id)).filter((m): m is TopicMastery => !!m && m.recentAccuracy !== null);
  if (assessed.length === 0) return null;
  return assessed.reduce((n, m) => n + (m.recentAccuracy ?? 0), 0) / assessed.length;
}

/** Plain-language justification for a label, built from the actual answers. */
export function explainMastery(m: TopicMastery, config: MasteryConfig = DEFAULT_MASTERY_CONFIG): string {
  if (m.windowAttempted === 0) return "No answers on this topic yet. Take a diagnostic quiz to assess it.";
  const pct = Math.round((m.recentAccuracy ?? 0) * 100);
  const base = `Based on your last ${m.windowAttempted} answer${m.windowAttempted === 1 ? "" : "s"} on this topic: ${fmt(m.windowCorrect)} of ${m.windowAttempted} correct (${pct}%).`;
  if (m.level === "insufficient") return `${base} At least ${config.minEvidence} answers are needed before a label is assigned.`;
  const rule =
    m.level === "weak"
      ? `below the ${Math.round(config.weakBelow * 100)}% weak threshold`
      : m.level === "strong"
        ? `at or above the ${Math.round(config.strongAtOrAbove * 100)}% strong threshold`
        : `between ${Math.round(config.weakBelow * 100)}% and ${Math.round(config.strongAtOrAbove * 100)}%`;
  return `${base} That is ${rule}.`;
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}
