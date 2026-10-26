// Demo mode: returns the sample workspace (no answer keys) and one clearly flagged example attempt.
import { ok, route } from "@/lib/api/respond";
import { requireDemo } from "@/lib/auth/session";
import { buildSampleAttempt, loadSampleWorkspace } from "@/lib/demo/sample";

export const GET = route(async () => {
  await requireDemo();
  const ws = loadSampleWorkspace();
  return ok({ ...ws, sampleAttempt: buildSampleAttempt() });
});
