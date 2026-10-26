// Extractive (non-LLM) grounded answers: selects the most relevant sentences from retrieved
// passages. Used in demo mode and whenever no AI provider is configured. Safe for the browser.
import type { RetrievedPassage, TutorAnswer } from "@/types/domain";
import { citationFromChunk } from "./citations";
import { DEFAULT_SUFFICIENCY, isEvidenceSufficient } from "./lexical";
import { splitSentences, tokenCoverage } from "./text";

export function insufficientAnswer(passages: RetrievedPassage[], reason?: string): TutorAnswer {
  return {
    status: "insufficient_evidence",
    answer:
      reason ??
      "Your uploaded materials don't contain enough information to answer this. Try rephrasing with terms from your notes, or upload material that covers this topic. I won't answer from general knowledge, because the answer couldn't be checked against your sources.",
    citations: [],
    method: "extractive",
    retrieval: passages[0]?.method ?? "none",
    passagesConsidered: passages.length,
  };
}

export function extractiveAnswer(query: string, passages: RetrievedPassage[], maxSentences = 4): TutorAnswer {
  if (!isEvidenceSufficient(query, passages, DEFAULT_SUFFICIENCY)) return insufficientAnswer(passages);
  const candidates = passages.slice(0, 3).flatMap((p, rank) =>
    splitSentences(p.chunk.text)
      .filter((s) => !/^#/.test(s) && s.length > 30)
      .map((sentence, i) => ({ sentence, chunk: p.chunk, score: tokenCoverage(query, sentence) - rank * 0.05 - i * 0.002, order: rank * 1000 + i }))
  );
  const picked = candidates
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.order - b.order);
  if (picked.length === 0) return insufficientAnswer(passages);
  const usedChunks = Array.from(new Map(picked.map((p) => [p.chunk.id, p.chunk])).values());
  return {
    status: "answered",
    answer: picked.map((p) => p.sentence).join(" "),
    citations: usedChunks.map((c) => citationFromChunk(c, query)),
    method: "extractive",
    retrieval: passages[0].method,
    passagesConsidered: passages.length,
  };
}
