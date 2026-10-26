"use client";
// Derived, deterministic views of the workspace shared by several pages.
import { useMemo } from "react";
import type { MasteryLevel, Topic, TopicMastery } from "@/types/domain";
import { computeMastery, overallMastery } from "@/lib/diagnosis/mastery";
import { useAppState } from "./AppStateProvider";

const SEVERITY: Record<MasteryLevel, number> = { weak: 0, insufficient: 1, medium: 2, strong: 3 };

export function useDerived() {
  const { state, config } = useAppState();
  return useMemo(() => {
    const mastery = computeMastery(state.topics, state.attempts);
    const topLevel = state.topics.filter((t) => !t.parentId);
    // In demo mode only the sample syllabus can be quizzed; uploaded syllabi are shown but not assessed.
    const assessable = config.mode === "demo" ? topLevel.filter((t) => t.origin === "sample") : topLevel;
    const counts: Record<MasteryLevel, number> = { weak: 0, medium: 0, strong: 0, insufficient: 0 };
    for (const t of assessable) counts[mastery.get(t.id)?.level ?? "insufficient"]++;
    const bySeverity = [...assessable].sort((a, b) => {
      const ma = mastery.get(a.id)!;
      const mb = mastery.get(b.id)!;
      return SEVERITY[ma.level] - SEVERITY[mb.level] || (ma.recentAccuracy ?? 1) - (mb.recentAccuracy ?? 1) || (b.importance ?? 0) - (a.importance ?? 0);
    });
    const topicName = (id: string) => state.topics.find((t) => t.id === id)?.name ?? "Unknown topic";
    const completedAttempts = state.attempts.filter((a) => a.status === "completed");
    const hasSampleData = state.attempts.some((a) => a.isSample);
    return {
      mastery,
      topLevel,
      assessable,
      counts,
      bySeverity,
      overall: overallMastery(mastery, assessable.map((t) => t.id)),
      topicName,
      completedAttempts,
      hasSampleData,
      childrenOf: (id: string): Topic[] => state.topics.filter((t) => t.parentId === id),
      masteryOf: (id: string): TopicMastery | undefined => mastery.get(id),
    };
  }, [state, config.mode]);
}
