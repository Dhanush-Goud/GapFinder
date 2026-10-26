// Live mode: mark a revision task complete / incomplete.
import { HttpError, ok, parseJson, route } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { toTask } from "@/lib/data/live-mappers";
import { taskUpdateSchema } from "@/lib/validation/api";

export const PATCH = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const viewer = await requireUser();
  const { completed } = await parseJson(req, taskUpdateSchema);
  const { data, error } = await viewer.supabase
    .from("revision_tasks")
    .update({ completed, completed_at: completed ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("user_id", viewer.userId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new HttpError(404, "Task not found.");
  return ok({ task: toTask(data) });
});
