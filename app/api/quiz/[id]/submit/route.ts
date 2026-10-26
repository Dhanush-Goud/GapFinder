// Live mode: submit answers. Grading, mastery snapshots and re-planning all happen server-side.
import { z } from "zod";
import { ok, parseJson, route } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { getAIProvider } from "@/lib/ai";
import { submitQuizLive } from "@/lib/data/live-quiz";
import { submitQuizSchema } from "@/lib/validation/api";
import { toDateOnly } from "@/lib/revision/dates";

export const maxDuration = 60;

const schema = submitQuizSchema.extend({ today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const viewer = await requireUser();
  const input = await parseJson(req, schema);
  const result = await submitQuizLive(viewer.supabase, getAIProvider(), viewer.userId, z.string().uuid().parse(id), input.answers, input.today ?? toDateOnly(new Date()));
  return ok(result);
});
