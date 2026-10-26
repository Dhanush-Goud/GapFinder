import { describe, expect, it } from "vitest";
import type { Topic, TopicMastery } from "@/types/domain";
import { buildRevisionPlan, minutesByTopic, PlanError, validatePlan } from "@/lib/revision/planner";
import { addDays } from "@/lib/revision/dates";

const TODAY = "2026-10-26";
const topic = (id: string, importance: 1 | 2 | 3 | null = 2): Topic => ({ id, code: id, name: `Topic ${id}`, description: "desc", parentId: null, importance, sourceRefs: [], origin: "parsed" });
const m = (topicId: string, acc: number | null, n = 6, level?: TopicMastery["level"]): TopicMastery => ({
  topicId, attempted: n, correct: (acc ?? 0) * n, accuracy: acc, windowAttempted: n, windowCorrect: (acc ?? 0) * n, recentAccuracy: acc,
  level: level ?? (acc === null || n < 3 ? "insufficient" : acc < 0.5 ? "weak" : acc >= 0.8 ? "strong" : "medium"),
  misconceptions: [], lastAssessed: `${TODAY}T08:00:00Z`, evidence: [],
});
let seq = 0;
const newId = () => `id-${++seq}`;

const topics = [topic("A", 3), topic("B", 2), topic("C", 2), topic("D", 1)];

function plan(mastery: TopicMastery[], hoursPerDay = 2, days = 10) {
  return buildRevisionPlan({
    topics, mastery: new Map(mastery.map((x) => [x.topicId, x])), settings: { examDate: addDays(TODAY, days), hoursPerDay, preferredSlot: "evening" },
    today: TODAY, basedOnAttemptId: null, newId,
  });
}

describe("revision plan time constraints", () => {
  it("never schedules more than the daily limit", () => {
    for (const hours of [0.25, 0.5, 1, 2.5, 6]) {
      const p = plan([m("A", 0.1), m("B", 0.3), m("C", 0.6), m("D", 0.9)], hours, 7);
      const cap = Math.round(hours * 60);
      const perDay = new Map<string, number>();
      for (const t of p.tasks) perDay.set(t.day, (perDay.get(t.day) ?? 0) + t.minutes);
      for (const minutes of perDay.values()) expect(minutes).toBeLessThanOrEqual(cap);
      expect(validatePlan(p, TODAY)).toEqual([]);
    }
  });

  it("schedules only between today and the day before the exam", () => {
    const p = plan([m("A", 0.2)], 1, 3);
    expect(p.tasks.every((t) => t.day >= TODAY && t.day < addDays(TODAY, 3))).toBe(true);
  });

  it("warns instead of over-allocating when time is short", () => {
    const p = plan([m("A", 0.1), m("B", 0.1), m("C", 0.1), m("D", 0.1)], 0.5, 2);
    expect(p.warnings.join(" ")).toMatch(/reduced|did not fit/);
    expect(validatePlan(p, TODAY)).toEqual([]);
  });

  it("rejects impossible settings", () => {
    expect(() => plan([], 2, 0)).toThrow(PlanError);
    expect(() => plan([], 20, 5)).toThrow(/hours per day/);
  });

  it("flags plans that exceed the daily cap", () => {
    const p = plan([m("A", 0.2)], 1, 5);
    const broken = { ...p, tasks: p.tasks.map((t, i) => (i === 0 ? { ...t, minutes: 500 } : t)) };
    expect(validatePlan(broken, TODAY).join(" ")).toMatch(/limit/);
  });
});

describe("revision plan priorities", () => {
  it("puts weak topics first and gives them the most time", () => {
    const p = plan([m("A", 0.9), m("B", 0.2), m("C", 0.6), m("D", 0.95)]);
    const minutes = minutesByTopic(p);
    expect(p.tasks[0].topicId).toBe("B");
    expect(minutes.get("B")!).toBeGreaterThan(minutes.get("C")!);
    expect(minutes.get("C")!).toBeGreaterThan(minutes.get("A")!);
  });

  it("includes practice and a retest for weak topics, retest after study", () => {
    const p = plan([m("B", 0.2)]);
    const b = p.tasks.filter((t) => t.topicId === "B");
    expect(b.some((t) => t.kind === "practice")).toBe(true);
    const retest = b.find((t) => t.kind === "retest")!;
    const lastStudy = b.filter((t) => t.kind !== "retest").map((t) => t.day).sort().at(-1)!;
    expect(retest.day >= lastStudy).toBe(true);
  });

  it("schedules a diagnostic quiz for unassessed topics", () => {
    const p = plan([m("A", 0.2)]);
    expect(p.tasks.find((t) => t.topicId === "D")?.kind).toBe("retest");
  });

  it("gives every task a reason derived from the mastery data", () => {
    const p = plan([m("B", 0.25, 4)]);
    expect(p.tasks.find((t) => t.topicId === "B")!.reason).toMatch(/Weak: 25% on your last 4 answers/);
  });
});

describe("re-planning after improved quiz scores", () => {
  it("reduces time for a topic that improved from weak to strong and reassigns it", () => {
    const before = plan([m("A", 0.2), m("B", 0.3), m("C", 0.6), m("D", 0.6)], 1, 6);
    const after = plan([m("A", 1.0), m("B", 0.3), m("C", 0.6), m("D", 0.6)], 1, 6);
    const mb = minutesByTopic(before);
    const ma = minutesByTopic(after);
    expect(ma.get("A") ?? 0).toBeLessThan(mb.get("A")!); // strong: short review, or dropped when time is tight
    expect(after.tasks.filter((t) => t.topicId === "A").every((t) => t.kind === "review")).toBe(true);
    // freed time goes to the remaining gaps
    expect((ma.get("B") ?? 0) + (ma.get("C") ?? 0) + (ma.get("D") ?? 0)).toBeGreaterThanOrEqual((mb.get("B") ?? 0) + (mb.get("C") ?? 0) + (mb.get("D") ?? 0));
  });

  it("credits study completed since the last assessment", () => {
    const base = plan([m("B", 0.2)]);
    const completed = base.tasks.filter((t) => t.topicId === "B" && t.kind === "study").map((t) => ({ ...t, completed: true, completedAt: `${TODAY}T20:00:00Z` }));
    const next = buildRevisionPlan({
      topics, mastery: new Map([["B", m("B", 0.2)]]), settings: base.settings, today: TODAY, basedOnAttemptId: null, newId, completedTasks: completed,
    });
    expect(minutesByTopic(next).get("B")!).toBeLessThan(minutesByTopic(base).get("B")!);
  });
});
