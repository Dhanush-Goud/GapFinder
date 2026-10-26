// Live mode: the signed-in student's full workspace (documents, topics, attempts, mastery, plan).
import { ok, route } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { loadState } from "@/lib/data/live-state";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const viewer = await requireUser();
  return ok(await loadState(viewer.supabase, viewer.userId));
});
