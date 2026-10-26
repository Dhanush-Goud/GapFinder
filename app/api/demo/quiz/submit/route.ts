// Demo mode: grades answers against the server-side answer key (deterministic).
import { HttpError, ok, parseJson, route } from "@/lib/api/respond";
import { requireDemo } from "@/lib/auth/session";
import { demoQuestionBank } from "@/lib/demo/sample";
import { attemptScore, checkSubmission, gradeDeterministic } from "@/lib/evaluation/grade";
import { demoSubmitSchema } from "@/lib/validation/api";

export const POST = route(async (req: Request) => {
  await requireDemo();
  const input = await parseJson(req, demoSubmitSchema);
  const problem = checkSubmission(input.questionIds, input.answers);
  if (problem) throw new HttpError(400, problem);
  const bank = new Map(demoQuestionBank().map((q) => [q.id, q]));
  const results = input.questionIds.map((id) => {
    const q = bank.get(id);
    if (!q) throw new HttpError(400, "Unknown question in submission.");
    return gradeDeterministic(q, input.answers.find((a) => a.questionId === id));
  });
  return ok({ results, score: attemptScore(results) });
});
