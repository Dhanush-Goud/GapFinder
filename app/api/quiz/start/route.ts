// Live mode: start a diagnostic quiz. Returns questions WITHOUT answer keys.
import { ok, parseJson, route } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { getAIProvider } from "@/lib/ai";
import { startQuizLive } from "@/lib/data/live-quiz";
import { startQuizSchema } from "@/lib/validation/api";

export const maxDuration = 60;

export const POST = route(async (req: Request) => {
  const viewer = await requireUser();
  const input = await parseJson(req, startQuizSchema);
  const result = await startQuizLive(viewer.supabase, getAIProvider(), viewer.userId, input);
  return ok({ attemptId: result.attemptId, createdAt: result.createdAt, questions: result.questions, notes: result.notes, rejectedCount: result.rejected.length }, 201);
});
