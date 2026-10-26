// Keyword (BM25) retrieval. Used in demo mode and as the fallback when embeddings are unavailable.
// It is lexical, not semantic, and the UI labels it as such.
import type { Chunk, RetrievedPassage } from "@/types/domain";
import { contentTokens } from "./text";

export interface RetrievalFilter {
  topicIds?: string[];
  documentIds?: string[];
}

export function filterChunks(chunks: Chunk[], filter: RetrievalFilter = {}): Chunk[] {
  return chunks.filter((c) => {
    if (filter.documentIds?.length && !filter.documentIds.includes(c.documentId)) return false;
    if (filter.topicIds?.length && !c.topicIds.some((t) => filter.topicIds!.includes(t))) return false;
    return true;
  });
}

export function bm25Search(query: string, chunks: Chunk[], k = 5): RetrievedPassage[] {
  const qTokens = Array.from(new Set(contentTokens(query)));
  if (qTokens.length === 0 || chunks.length === 0) return [];
  const docs = chunks.map((c) => contentTokens(`${c.section ?? ""} ${c.text}`));
  const avgLen = docs.reduce((n, d) => n + d.length, 0) / docs.length || 1;
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const N = docs.length;
  const k1 = 1.4;
  const b = 0.75;
  const scored = docs.map((tokens, i) => {
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    for (const q of qTokens) {
      const f = tf.get(q);
      if (!f) continue;
      const idf = Math.log(1 + (N - (df.get(q) ?? 0) + 0.5) / ((df.get(q) ?? 0) + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * tokens.length) / avgLen)));
    }
    return { chunk: chunks[i], score, method: "lexical" as const };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b2) => b2.score - a.score)
    .slice(0, k);
}

/** Fraction of distinct query terms present across the retrieved passages. */
export function queryCoverage(query: string, passages: RetrievedPassage[]): number {
  const qTokens = Array.from(new Set(contentTokens(query)));
  if (qTokens.length === 0) return 0;
  const found = new Set(passages.flatMap((p) => contentTokens(`${p.chunk.section ?? ""} ${p.chunk.text}`)));
  return qTokens.filter((t) => found.has(t)).length / qTokens.length;
}

export interface SufficiencyConfig {
  minLexicalCoverage: number;
  minSemanticSimilarity: number;
}

export const DEFAULT_SUFFICIENCY: SufficiencyConfig = { minLexicalCoverage: 0.5, minSemanticSimilarity: 0.55 };

/** Decides whether retrieved passages are strong enough to ground an answer. */
export function isEvidenceSufficient(
  query: string,
  passages: RetrievedPassage[],
  config: SufficiencyConfig = DEFAULT_SUFFICIENCY
): boolean {
  if (passages.length === 0) return false;
  if (passages[0].method === "semantic") return passages[0].score >= config.minSemanticSimilarity;
  return queryCoverage(query, passages.slice(0, 3)) >= config.minLexicalCoverage;
}
