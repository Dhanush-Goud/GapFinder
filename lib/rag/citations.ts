// Citation construction and validation. Citations are only ever built from stored chunks;
// any chunk ID a model invents is rejected.
import type { Chunk, Citation } from "@/types/domain";
import { excerpt, tokenCoverage } from "./text";

export function citationFromChunk(chunk: Chunk, focus?: string): Citation {
  return {
    chunkId: chunk.id,
    documentId: chunk.documentId,
    documentName: chunk.documentName,
    page: chunk.page,
    section: chunk.section,
    excerpt: focus ? focusedExcerpt(chunk.text, focus) : excerpt(chunk.text),
  };
}

/** Picks the sentence window in the chunk that best matches `focus`. */
export function focusedExcerpt(text: string, focus: string, max = 300): string {
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/);
  let best = 0;
  let bestScore = -1;
  sentences.forEach((s, i) => {
    const score = tokenCoverage(focus, s);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  let out = sentences[best] ?? "";
  if (out.length < max * 0.6 && sentences[best + 1]) out = `${out} ${sentences[best + 1]}`;
  return excerpt(out, max);
}

export interface CitationValidation {
  citations: Citation[];
  invalidIds: string[];
}

/** Keeps only chunk IDs that exist in `allowed` (the passages actually retrieved for this request). */
export function validateCitations(chunkIds: string[], allowed: Chunk[], focus?: string): CitationValidation {
  const byId = new Map(allowed.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const citations: Citation[] = [];
  const invalidIds: string[] = [];
  for (const id of chunkIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const chunk = byId.get(id);
    if (chunk) citations.push(citationFromChunk(chunk, focus));
    else invalidIds.push(id);
  }
  return { citations, invalidIds };
}

/**
 * Grounding check: is `claim` (e.g. the correct answer plus its explanation) supported by the cited text?
 * A deterministic lexical heuristic — it catches answers about content that is absent from the
 * sources, but it is not a full entailment check.
 */
export function isClaimSupported(claim: string, evidence: string, threshold = 0.6): boolean {
  return tokenCoverage(claim, evidence) >= threshold;
}
