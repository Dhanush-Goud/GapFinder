// Live mode: (re)build the topic map from the student's syllabus.
import { ok, route } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { getAIProvider } from "@/lib/ai";
import { extractTopicsLive } from "@/lib/data/live-topics";

export const maxDuration = 60;

export const POST = route(async () => {
  const viewer = await requireUser();
  return ok(await extractTopicsLive(viewer.supabase, getAIProvider(), viewer.userId));
});
