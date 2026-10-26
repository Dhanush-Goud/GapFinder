// Live mode: save study settings and generate a revision plan from current mastery.
import { ok, parseJson, route } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { buildAndSavePlan } from "@/lib/data/live-plan";
import { toTopic } from "@/lib/data/live-mappers";
import { loadAttempts } from "@/lib/data/live-state";
import { planRequestSchema } from "@/lib/validation/api";

export const PUT = route(async (req: Request) => {
  const viewer = await requireUser();
  const { settings, today } = await parseJson(req, planRequestSchema);
  const db = viewer.supabase;
  const { error } = await db
    .from("profiles")
    .update({ exam_date: settings.examDate, hours_per_day: settings.hoursPerDay, preferred_slot: settings.preferredSlot, updated_at: new Date().toISOString() })
    .eq("id", viewer.userId);
  if (error) throw new Error(error.message);
  const { data: topicRows } = await db.from("topics").select("*").eq("user_id", viewer.userId);
  const attempts = await loadAttempts(db, viewer.userId);
  const lastAttempt = attempts.filter((a) => a.status === "completed").at(-1)?.id ?? null;
  const plan = await buildAndSavePlan(db, viewer.userId, (topicRows ?? []).map(toTopic), attempts, settings, today, lastAttempt);
  return ok({ plan });
});
