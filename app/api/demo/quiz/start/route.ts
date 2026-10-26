// Demo mode: selects seeded, source-grounded questions. Answer keys are stripped before returning.
import { HttpError, ok, parseJson, route } from "@/lib/api/respond";
import { requireDemo } from "@/lib/auth/session";
import { demoQuestionBank, loadSampleWorkspace } from "@/lib/demo/sample";
import { descendantsOf } from "@/lib/rag/link";
import { selectQuestions } from "@/lib/quiz/select";
import { demoStartQuizSchema } from "@/lib/validation/api";
import type { PublicQuestion } from "@/types/domain";

export const POST = route(async (req: Request) => {
  await requireDemo();
  const input = await parseJson(req, demoStartQuizSchema);
  const { topics } = loadSampleWorkspace();
  const known = input.topicIds.filter((id) => topics.some((t) => t.id === id));
  if (known.length === 0) {
    throw new HttpError(422, "Demo mode only has seeded questions for the sample syllabus. Generating questions from your own uploads needs the live AI configuration.", "insufficient_evidence");
  }
  const bank = demoQuestionBank();
  const selected = selectQuestions(bank, {
    count: input.count,
    difficulty: input.difficulty,
    includeShortAnswer: input.includeShortAnswer,
    history: input.history,
    topicScope: known.map((id) => [id, ...descendantsOf(id, topics)]),
  });
  if (selected.length < 3) throw new HttpError(422, "Not enough grounded questions for this selection. Choose more topics.", "insufficient_evidence");
  const questions: PublicQuestion[] = selected.map(({ id, topicId, type, difficulty, prompt, options }) => ({ id, topicId, type, difficulty, prompt, options }));
  return ok({ questions, skippedTopicIds: input.topicIds.filter((id) => !known.includes(id)) });
});
