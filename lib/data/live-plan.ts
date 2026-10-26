// Live revision planning: deterministic planner + persistence. Old plans are deactivated, not
// deleted, so completed tasks remain available for progress tracking.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuizAttempt, RevisionPlan, RevisionTask, StudySettings, Topic } from "@/types/domain";
import { computeMastery } from "@/lib/diagnosis/mastery";
import { buildRevisionPlan } from "@/lib/revision/planner";
import { loadSettings } from "./live-state";
import { toTask } from "./live-mappers";

export async function persistPlan(db: SupabaseClient, userId: string, plan: RevisionPlan) {
  const { error: deactivateError } = await db.from("revision_plans").update({ is_active: false }).eq("user_id", userId).eq("is_active", true);
  if (deactivateError) throw new Error(deactivateError.message);
  const { error: planError } = await db.from("revision_plans").insert({
    id: plan.id, user_id: userId, based_on_attempt_id: plan.basedOnAttemptId, settings: plan.settings, warnings: plan.warnings, is_active: true,
  });
  if (planError) throw new Error(planError.message);
  if (plan.tasks.length) {
    const { error } = await db.from("revision_tasks").insert(
      plan.tasks.map((t, i) => ({
        id: t.id, user_id: userId, plan_id: plan.id, topic_id: t.topicId, day: t.day, kind: t.kind, minutes: t.minutes,
        objective: t.objective, reason: t.reason, completed: false, position: i,
      }))
    );
    if (error) throw new Error(error.message);
  }
}

async function completedTasks(db: SupabaseClient, userId: string): Promise<RevisionTask[]> {
  const { data } = await db.from("revision_tasks").select("*").eq("user_id", userId).eq("completed", true);
  return (data ?? []).map(toTask);
}

export async function buildAndSavePlan(
  db: SupabaseClient, userId: string, topics: Topic[], attempts: QuizAttempt[], settings: StudySettings, today: string, basedOnAttemptId: string | null
): Promise<RevisionPlan> {
  const plan = buildRevisionPlan({
    topics: topics.filter((t) => !t.parentId),
    mastery: computeMastery(topics, attempts),
    settings,
    today,
    basedOnAttemptId,
    completedTasks: await completedTasks(db, userId),
  });
  await persistPlan(db, userId, plan);
  return plan;
}

/** Called after each quiz: if the student has study settings, recompute their plan from new results. */
export async function regeneratePlanLive(db: SupabaseClient, userId: string, topics: Topic[], attempts: QuizAttempt[], today: string, attemptId: string): Promise<boolean> {
  const settings = await loadSettings(db, userId);
  if (!settings || settings.examDate <= today) return false;
  await buildAndSavePlan(db, userId, topics, attempts, settings, today, attemptId);
  return true;
}
