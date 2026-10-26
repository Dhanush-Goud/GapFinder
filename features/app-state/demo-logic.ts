// Pure state transitions for demo mode (also unit-tested). The browser keeps the demo workspace;
// grading still happens on the server against the hidden answer key.
import type { AppState, EvaluatedAnswer, PublicQuestion, QuizAttempt, RevisionPlan, StudySettings } from "@/types/domain";
import { computeMastery, snapshotsAfterAttempt } from "@/lib/diagnosis/mastery";
import { buildRevisionPlan, minutesByTopic } from "@/lib/revision/planner";
import { addDays } from "@/lib/revision/dates";

export function defaultSettings(today: string): StudySettings {
  return { examDate: addDays(today, 14), hoursPerDay: 2, preferredSlot: "evening" };
}

export function planFor(state: AppState, settings: StudySettings, today: string, basedOnAttemptId: string | null): RevisionPlan {
  const completed = [...state.taskHistory, ...(state.plan?.tasks.filter((t) => t.completed) ?? [])];
  return buildRevisionPlan({
    // In demo mode only the sample syllabus has quiz questions, so only its units are planned.
    topics: state.topics.filter((t) => !t.parentId && t.origin === "sample"),
    mastery: computeMastery(state.topics, state.attempts),
    settings,
    today,
    basedOnAttemptId,
    completedTasks: completed,
  });
}

/** Keeps completed tasks of the old plan in history, then replaces the plan. */
export function withNewPlan(state: AppState, plan: RevisionPlan): AppState {
  const finished = state.plan?.tasks.filter((t) => t.completed) ?? [];
  const known = new Set(state.taskHistory.map((t) => t.id));
  return { ...state, plan, taskHistory: [...state.taskHistory, ...finished.filter((t) => !known.has(t.id))] };
}

export interface PlanShift {
  topicId: string;
  before: number;
  after: number;
}

/** How planned minutes per topic changed between two plans — shows that re-planning used new results. */
export function planShift(previous: RevisionPlan | null, next: RevisionPlan): PlanShift[] {
  if (!previous) return [];
  const before = minutesByTopic({ ...previous, tasks: previous.tasks.filter((t) => !t.completed) });
  const after = minutesByTopic(next);
  const ids = new Set([...before.keys(), ...after.keys()]);
  return Array.from(ids)
    .map((topicId) => ({ topicId, before: before.get(topicId) ?? 0, after: after.get(topicId) ?? 0 }))
    .filter((s) => s.before !== s.after);
}

export function completeAttempt(
  state: AppState,
  args: { id: string; createdAt: string; topicIds: string[]; difficulty: QuizAttempt["difficulty"]; questions: PublicQuestion[]; results: EvaluatedAnswer[]; score: number },
  today: string
): { state: AppState; shift: PlanShift[] } {
  if (state.attempts.some((a) => a.id === args.id)) return { state, shift: [] }; // duplicate submission guard
  const attempt: QuizAttempt = {
    id: args.id,
    createdAt: args.createdAt,
    completedAt: new Date().toISOString(),
    topicIds: args.topicIds,
    difficulty: args.difficulty,
    status: "completed",
    questions: args.questions,
    results: args.results,
    score: args.score,
    isSample: false,
  };
  const attempts = [...state.attempts, attempt];
  let next: AppState = { ...state, attempts, masteryHistory: [...state.masteryHistory, ...snapshotsAfterAttempt(state.topics, attempts, attempt)] };
  let shift: PlanShift[] = [];
  if (next.settings && next.settings.examDate > today) {
    const plan = planFor(next, next.settings, today, attempt.id);
    shift = planShift(state.plan, plan);
    next = withNewPlan(next, plan);
  }
  return { state: next, shift };
}

/** Removes the fictional example attempt and everything derived from it. */
export function clearSampleAttempts(state: AppState, today: string): AppState {
  const sampleIds = new Set(state.attempts.filter((a) => a.isSample).map((a) => a.id));
  let next: AppState = {
    ...state,
    attempts: state.attempts.filter((a) => !a.isSample),
    masteryHistory: state.masteryHistory.filter((s) => !sampleIds.has(s.attemptId)),
  };
  if (next.settings && next.settings.examDate > today) next = { ...next, plan: planFor(next, next.settings, today, null) };
  return next;
}
