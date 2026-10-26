// Deterministic adaptive revision planner. Works without any AI provider.
// Inputs are structured mastery data; the output is validated before use.
import type { RevisionPlan, RevisionTask, StudySettings, TaskKind, Topic, TopicMastery } from "@/types/domain";
import { DEFAULT_MASTERY_CONFIG, type MasteryConfig } from "@/lib/diagnosis/config";
import { LEVEL_LABEL } from "@/lib/diagnosis/mastery";
import { addDays, daysBetween, isValidDateOnly } from "./dates";

export const PLANNER_LIMITS = {
  maxHorizonDays: 21,
  minHoursPerDay: 0.25,
  maxHoursPerDay: 12,
  maxBlockMinutes: 45,
  minBlockMinutes: 15,
  retestMinutes: 15,
};

export interface PlanInput {
  topics: Topic[]; // assessable topics (normally the top-level syllabus units)
  mastery: Map<string, TopicMastery>;
  settings: StudySettings;
  today: string;
  basedOnAttemptId: string | null;
  /** Previously completed tasks; study done since a topic's last assessment reduces its remaining need. */
  completedTasks?: RevisionTask[];
  newId?: () => string;
  config?: MasteryConfig;
}

interface TopicNeed {
  topic: Topic;
  mastery: TopicMastery | undefined;
  priority: number;
  minutes: number;
  reason: string;
}

const importanceFactor = (i: Topic["importance"]) => (i === 3 ? 1.25 : i === 1 ? 0.8 : 1);
const importanceText = (i: Topic["importance"]) => (i === 3 ? "high" : i === 2 ? "medium" : i === 1 ? "low" : null);

export function settingsErrors(settings: StudySettings, today: string): string[] {
  const errors: string[] = [];
  if (!isValidDateOnly(settings.examDate)) errors.push("Exam date is not a valid date.");
  else if (daysBetween(today, settings.examDate) < 1) errors.push("Exam date must be after today.");
  if (!(settings.hoursPerDay >= PLANNER_LIMITS.minHoursPerDay && settings.hoursPerDay <= PLANNER_LIMITS.maxHoursPerDay)) {
    errors.push(`Study hours per day must be between ${PLANNER_LIMITS.minHoursPerDay} and ${PLANNER_LIMITS.maxHoursPerDay}.`);
  }
  return errors;
}

function assessNeeds(input: PlanInput, config: MasteryConfig): TopicNeed[] {
  return input.topics.map((topic) => {
    const m = input.mastery.get(topic.id);
    const acc = m?.recentAccuracy ?? null;
    const factor = importanceFactor(topic.importance);
    let minutes: number;
    let priority: number;
    const level = m?.level ?? "insufficient";
    if (level === "weak") {
      minutes = 120 + 120 * ((config.weakBelow - (acc ?? 0)) / config.weakBelow);
      priority = 3 + (1 - (acc ?? 0));
    } else if (level === "medium") {
      minutes = 60 + 60 * ((config.strongAtOrAbove - (acc ?? 0)) / (config.strongAtOrAbove - config.weakBelow));
      priority = 1.5 + (1 - (acc ?? 0));
    } else if (level === "strong") {
      minutes = 20;
      priority = 0.2;
    } else {
      minutes = m && m.windowAttempted > 0 ? 35 : PLANNER_LIMITS.retestMinutes;
      priority = 2;
    }
    minutes *= level === "strong" ? 1 : factor;
    priority *= factor;

    // Credit study already completed since this topic was last assessed.
    const since = m?.lastAssessed ?? "";
    const done = (input.completedTasks ?? [])
      .filter((t) => t.topicId === topic.id && t.completed && t.kind !== "retest" && (t.completedAt ?? "") > since)
      .reduce((n, t) => n + t.minutes, 0);
    if (level === "weak" || level === "medium") minutes = Math.max(PLANNER_LIMITS.minBlockMinutes * 2, minutes - done);

    const parts: string[] = [];
    if (m && m.windowAttempted > 0) {
      parts.push(`${LEVEL_LABEL[level]}: ${Math.round((acc ?? 0) * 100)}% on your last ${m.windowAttempted} answer${m.windowAttempted === 1 ? "" : "s"}`);
    } else {
      parts.push("Not assessed yet — a short diagnostic quiz comes first");
    }
    if (m && level === "insufficient" && m.windowAttempted > 0) parts.push(`needs ${config.minEvidence - m.windowAttempted} more answer(s) for a reliable label`);
    const imp = importanceText(topic.importance);
    if (imp) parts.push(`${imp} syllabus weightage`);
    if (done > 0 && (level === "weak" || level === "medium")) parts.push(`${done} min already completed since last quiz`);
    return { topic, mastery: m, priority, minutes: Math.round(minutes / 5) * 5, reason: parts.join("; ") };
  });
}

interface Block {
  kind: TaskKind;
  minutes: number;
  objective: string;
}

function blocksFor(need: TopicNeed): Block[] {
  const { topic, mastery } = need;
  const level = mastery?.level ?? "insufficient";
  const focus = mastery?.misconceptions[0];
  if (level === "insufficient") {
    const blocks: Block[] = [];
    if (need.minutes > PLANNER_LIMITS.retestMinutes) {
      blocks.push({ kind: "study", minutes: need.minutes - PLANNER_LIMITS.retestMinutes, objective: `Skim your notes on ${topic.name} before being assessed.` });
    }
    blocks.push({ kind: "retest", minutes: PLANNER_LIMITS.retestMinutes, objective: `Take a diagnostic quiz on ${topic.name} so its mastery can be measured.` });
    return blocks;
  }
  if (level === "strong") {
    return [{ kind: "review", minutes: need.minutes, objective: `Quick review of ${topic.name} to keep it fresh; re-read your summary notes.` }];
  }
  const retest = PLANNER_LIMITS.retestMinutes;
  const practice = Math.max(PLANNER_LIMITS.minBlockMinutes, Math.round(((need.minutes - retest) * 0.3) / 5) * 5);
  let study = Math.max(PLANNER_LIMITS.minBlockMinutes, need.minutes - retest - practice);
  const blocks: Block[] = [];
  let part = 1;
  while (study > 0) {
    const m = Math.min(PLANNER_LIMITS.maxBlockMinutes, study);
    const minutes = m < PLANNER_LIMITS.minBlockMinutes && blocks.length ? m : Math.max(m, PLANNER_LIMITS.minBlockMinutes);
    if (minutes < PLANNER_LIMITS.minBlockMinutes && blocks.length) {
      blocks[blocks.length - 1].minutes += minutes;
    } else {
      blocks.push({
        kind: "study",
        minutes,
        objective:
          part === 1
            ? `Re-learn the core ideas of ${topic.name}${topic.description ? `: ${topic.description.replace(/\.$/, "")}` : ""}.`
            : `Continue ${topic.name}: work through the examples in your notes and summarise each sub-topic in your own words.`,
      });
    }
    study -= m;
    part++;
  }
  blocks.push({
    kind: "practice",
    minutes: practice,
    objective: focus ? `Practice ${topic.name}, targeting this mistake from your quiz: “${focus}”.` : `Practice problems on ${topic.name} without looking at the notes.`,
  });
  blocks.push({ kind: "retest", minutes: retest, objective: `Retest ${topic.name} with a diagnostic quiz to measure improvement.` });
  return blocks;
}

export function buildRevisionPlan(input: PlanInput): RevisionPlan {
  const config = input.config ?? DEFAULT_MASTERY_CONFIG;
  const newId = input.newId ?? (() => crypto.randomUUID());
  const errors = settingsErrors(input.settings, input.today);
  if (errors.length) throw new PlanError(errors.join(" "));

  const warnings: string[] = [];
  const daysToExam = daysBetween(input.today, input.settings.examDate);
  const horizon = Math.min(daysToExam, PLANNER_LIMITS.maxHorizonDays);
  if (daysToExam > PLANNER_LIMITS.maxHorizonDays) {
    warnings.push(`The plan covers the next ${PLANNER_LIMITS.maxHorizonDays} days; it is recalculated after every quiz, so later days are planned as you go.`);
  }
  const dailyCap = Math.round(input.settings.hoursPerDay * 60);
  const capacity = dailyCap * horizon;

  let needs = assessNeeds(input, config).sort((a, b) => b.priority - a.priority);
  const total = needs.reduce((n, x) => n + x.minutes, 0);
  if (total > capacity) {
    // Not enough time: drop maintenance reviews of strong topics first, then scale the rest down.
    const strongMinutes = needs.filter((n) => n.mastery?.level === "strong").reduce((n, x) => n + x.minutes, 0);
    if (strongMinutes > 0) {
      needs = needs.filter((n) => n.mastery?.level !== "strong");
      warnings.push("Time is tight, so reviews of topics you already know well were left out.");
    }
    const remaining = needs.reduce((n, x) => n + x.minutes, 0);
    if (remaining > capacity) {
      const scale = capacity / remaining;
      needs = needs.map((n) => ({ ...n, minutes: Math.max(PLANNER_LIMITS.retestMinutes, Math.floor((n.minutes * scale) / 5) * 5) }));
      warnings.push(
        `You need about ${Math.round(remaining / 60)} h of revision but have ${Math.round(capacity / 60)} h before the exam; time per topic was reduced in proportion to priority.`
      );
    }
  }

  const dayLoad = new Array<number>(horizon).fill(0);
  const tasks: RevisionTask[] = [];
  const queues = needs.map((need) => ({ need, blocks: blocksFor(need), nextDay: 0, lastStudyDay: -1 }));
  let dropped = 0;
  let active = true;
  while (active) {
    active = false;
    for (const q of queues) {
      const block = q.blocks.shift();
      if (!block) continue;
      active = true;
      let earliest = q.nextDay;
      if (block.kind === "retest" && q.lastStudyDay >= 0) earliest = Math.min(horizon - 1, q.lastStudyDay + 1);
      let placed = false;
      for (let attempt = 0; attempt < 2 && !placed; attempt++) {
        let minutes = block.minutes;
        for (let d = earliest; d < horizon; d++) {
          const free = dailyCap - dayLoad[d];
          if (free >= minutes || (attempt === 1 && free >= PLANNER_LIMITS.minBlockMinutes && block.kind !== "retest")) {
            minutes = Math.min(minutes, free);
            dayLoad[d] += minutes;
            tasks.push({
              id: newId(),
              day: addDays(input.today, d),
              topicId: q.need.topic.id,
              kind: block.kind,
              minutes,
              objective: block.objective,
              reason: q.need.reason,
              completed: false,
              completedAt: null,
            });
            q.nextDay = d;
            if (block.kind === "study" || block.kind === "practice") q.lastStudyDay = d;
            placed = true;
            break;
          }
        }
      }
      if (!placed) dropped += block.minutes;
    }
  }
  if (dropped > 0) warnings.push(`${dropped} minutes of lower-priority work did not fit into your daily limit and were left out.`);

  const order = new Map(needs.map((n, i) => [n.topic.id, i]));
  tasks.sort((a, b) => a.day.localeCompare(b.day) || (order.get(a.topicId)! - order.get(b.topicId)!));

  const plan: RevisionPlan = {
    id: newId(),
    createdAt: new Date().toISOString(),
    basedOnAttemptId: input.basedOnAttemptId,
    settings: input.settings,
    tasks,
    warnings,
  };
  const problems = validatePlan(plan, input.today);
  if (problems.length) throw new PlanError(`Generated plan failed validation: ${problems.join(" ")}`);
  return plan;
}

/** Deterministic schedule validation: no day over the limit, no impossible tasks, all inside the window. */
export function validatePlan(plan: RevisionPlan, today: string): string[] {
  const problems: string[] = [];
  const cap = Math.round(plan.settings.hoursPerDay * 60);
  const perDay = new Map<string, number>();
  for (const t of plan.tasks) {
    if (!Number.isInteger(t.minutes) || t.minutes <= 0) problems.push(`Task ${t.id} has an invalid duration.`);
    if (t.day < today || t.day >= plan.settings.examDate) problems.push(`Task ${t.id} is scheduled outside the study window.`);
    perDay.set(t.day, (perDay.get(t.day) ?? 0) + t.minutes);
  }
  for (const [day, minutes] of perDay) if (minutes > cap) problems.push(`${day} has ${minutes} min scheduled; the limit is ${cap} min.`);
  return problems;
}

export class PlanError extends Error {}

/** Minutes of planned work per topic — used to show how a new plan shifted time after a quiz. */
export function minutesByTopic(plan: RevisionPlan | null): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of plan?.tasks ?? []) out.set(t.topicId, (out.get(t.topicId) ?? 0) + t.minutes);
  return out;
}
