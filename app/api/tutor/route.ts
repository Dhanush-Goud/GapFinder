// Live mode: Explain-This-Topic. Retrieve → sufficiency check → grounded generation → citation validation.
// When the AI provider fails, falls back to extractive answer rather than returning an error.
import type { TutorAnswer } from "@/types/domain";
import { ok, parseJson, route } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { getAIProvider } from "@/lib/ai";
import { explainFromPassages } from "@/lib/ai/tasks";
import { retrieveLive } from "@/lib/data/live-retrieval";
import { validateCitations } from "@/lib/rag/citations";
import { isEvidenceSufficient } from "@/lib/rag/lexical";
import { extractiveAnswer, insufficientAnswer } from "@/lib/rag/tutor";
import { tutorSchema } from "@/lib/validation/api";

export const maxDuration = 60;

export const POST = route(async (req: Request) => {
  const viewer = await requireUser();
  const { question, topicId } = await parseJson(req, tutorSchema);
  const ai = getAIProvider();
  const passages = await retrieveLive(viewer.supabase, ai, question, { topicIds: topicId ? [topicId] : null, k: 6 });
  if (!isEvidenceSufficient(question, passages)) return ok(insufficientAnswer(passages));
  if (!ai) return ok(extractiveAnswer(question, passages));

  try {
    const chunks = passages.map((p) => p.chunk);
    const generated = await explainFromPassages(ai, question, chunks);
    const { citations } = validateCitations(generated.chunkIds, chunks, question);
    if (!generated.sufficient || citations.length === 0) {
      return ok(insufficientAnswer(passages, generated.sufficient ? "The explanation could not be tied to a valid source passage, so it was withheld." : generated.answer));
    }
    const answer: TutorAnswer = { status: "answered", answer: generated.answer, citations, method: "llm", retrieval: passages[0].method, passagesConsidered: passages.length };
    return ok(answer);
  } catch (err) {
    // AI provider failed (rate limit, timeout, invalid key, etc.) — fall back to extractive answer
    // rather than returning a 502 error. The extractive answer labels itself as non-AI.
    console.warn("[gapfinder] tutor AI fallback:", err instanceof Error ? err.message : err);
    return ok(extractiveAnswer(question, passages));
  }
});

