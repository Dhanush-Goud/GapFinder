// Loads a signed-in student's workspace. Reads use the user's session, so RLS enforces ownership;
// every query is additionally filtered by user_id.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppState, QuizAttempt, RevisionPlan, StudySettings } from "@/types/domain";
import { buildAttempts, toChunk, toDocument, toSnapshot, toTask, toTopic } from "./live-mappers";

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Failed to load ${what}: ${res.error.message}`);
  return (res.data ?? []) as T;
}

export async function loadAttempts(db: SupabaseClient, userId: string): Promise<QuizAttempt[]> {
  const attemptRows = must(await db.from("quiz_attempts").select("*").eq("user_id", userId).order("created_at"), "attempts") as Record<string, unknown>[];
  const questionIds = Array.from(new Set(attemptRows.flatMap((a) => a.question_ids as string[])));
  const questionRows = questionIds.length
    ? (must(await db.from("questions").select("id, topic_id, type, difficulty, prompt, options").eq("user_id", userId).in("id", questionIds), "questions") as Record<string, unknown>[])
    : [];
  const answerRows = must(await db.from("student_answers").select("*").eq("user_id", userId), "answers") as Record<string, unknown>[];
  return buildAttempts(attemptRows, questionRows, answerRows);
}

export async function loadSettings(db: SupabaseClient, userId: string): Promise<StudySettings | null> {
  const { data } = await db.from("profiles").select("exam_date, hours_per_day, preferred_slot").eq("id", userId).maybeSingle();
  if (!data?.exam_date || !data.hours_per_day) return null;
  return { examDate: data.exam_date, hoursPerDay: Number(data.hours_per_day), preferredSlot: data.preferred_slot ?? "evening" };
}

export async function loadActivePlan(db: SupabaseClient, userId: string): Promise<RevisionPlan | null> {
  const { data: plan, error } = await db.from("revision_plans").select("*").eq("user_id", userId).eq("is_active", true).maybeSingle();
  if (error) throw new Error(`Failed to load plan: ${error.message}`);
  if (!plan) return null;
  const tasks = must(await db.from("revision_tasks").select("*").eq("plan_id", plan.id).order("day").order("position"), "tasks") as Record<string, unknown>[];
  return {
    id: plan.id,
    createdAt: plan.created_at,
    basedOnAttemptId: plan.based_on_attempt_id,
    settings: plan.settings,
    warnings: plan.warnings ?? [],
    tasks: tasks.map(toTask),
  };
}

export async function loadState(db: SupabaseClient, userId: string): Promise<AppState> {
  const [documents, topics, chunks, attempts, mastery, settings, plan, history] = await Promise.all([
    db.from("documents").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    db.from("topics").select("*").eq("user_id", userId).order("position"),
    // Chunk text is truncated for the browser; full text stays server-side for retrieval.
    db.from("document_chunks").select("id, document_id, document_name, ordinal, page, section, content, topic_ids").eq("user_id", userId).order("ordinal").limit(3000),
    loadAttempts(db, userId),
    db.from("topic_mastery_history").select("*").eq("user_id", userId).order("created_at"),
    loadSettings(db, userId),
    loadActivePlan(db, userId),
    db.from("revision_tasks").select("*, revision_plans!inner(is_active)").eq("user_id", userId).eq("completed", true).eq("revision_plans.is_active", false),
  ]);
  return {
    documents: (must(documents, "documents") as Record<string, unknown>[]).map(toDocument),
    topics: (must(topics, "topics") as Record<string, unknown>[]).map(toTopic),
    chunks: (must(chunks, "chunks") as Record<string, unknown>[]).map((r) => {
      const c = toChunk(r);
      return { ...c, text: c.text.length > 600 ? `${c.text.slice(0, 600)}…` : c.text };
    }),
    attempts,
    masteryHistory: (must(mastery, "mastery history") as Record<string, unknown>[]).map(toSnapshot),
    settings,
    plan,
    taskHistory: (must(history, "task history") as Record<string, unknown>[]).map(toTask),
  };
}
