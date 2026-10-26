// Live mode: copy the sample DSA course into the signed-in account.
import { ok, route } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { getAIProvider } from "@/lib/ai";
import { loadSamplesLive } from "@/lib/data/live-samples";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = route(async () => {
  const viewer = await requireUser();
  return ok(await loadSamplesLive(viewer.supabase, getAIProvider(), viewer.userId), 201);
});
