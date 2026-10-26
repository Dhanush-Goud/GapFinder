// Live mode: delete all of the student's study data (documents, files, topics, quizzes, plans).
// The login account itself is kept.
import { ok, route } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";

export const DELETE = route(async () => {
  const viewer = await requireUser();
  const db = viewer.supabase;
  const admin = createAdminClient();
  const { data: files } = await admin.storage.from("documents").list(viewer.userId, { limit: 1000 });
  for (const folder of files ?? []) {
    const { data: inner } = await admin.storage.from("documents").list(`${viewer.userId}/${folder.name}`);
    const paths = (inner ?? []).map((f) => `${viewer.userId}/${folder.name}/${f.name}`);
    if (paths.length) await admin.storage.from("documents").remove(paths);
  }
  for (const table of ["revision_plans", "quiz_attempts", "questions", "topics", "documents"]) {
    const { error } = await admin.from(table).delete().eq("user_id", viewer.userId);
    if (error) throw new Error(`Deleting ${table} failed: ${error.message}`);
  }
  await db.from("profiles").update({ exam_date: null, hours_per_day: null, preferred_slot: null }).eq("id", viewer.userId);
  return ok({ deleted: true });
});
