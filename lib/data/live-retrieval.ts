// Live retrieval: semantic (pgvector) when embeddings exist, otherwise Postgres full-text search.
// The method used is returned with every passage so the UI can say which one ran.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RetrievedPassage } from "@/types/domain";
import type { AIProvider } from "@/lib/ai/provider";
import { contentTokens } from "@/lib/rag/text";
import { toChunk } from "./live-mappers";

export interface LiveRetrievalOptions {
  topicIds?: string[] | null;
  k?: number;
}

export async function retrieveLive(db: SupabaseClient, ai: AIProvider | null, query: string, opts: LiveRetrievalOptions = {}): Promise<RetrievedPassage[]> {
  const k = opts.k ?? 6;
  const topicFilter = opts.topicIds?.length ? opts.topicIds : null;
  if (ai) {
    try {
      const [embedding] = await ai.embed([query], "query");
      const { data, error } = await db.rpc("match_chunks", {
        query_embedding: JSON.stringify(embedding),
        match_count: k,
        filter_topic_ids: topicFilter,
        filter_document_ids: null,
      });
      if (error) throw new Error(error.message);
      if (data && data.length) {
        return (data as Record<string, unknown>[]).map((r) => ({ chunk: toChunk(r), score: Number(r.similarity), method: "semantic" as const }));
      }
    } catch (err) {
      console.warn("[gapfinder] semantic retrieval failed, falling back to full-text:", err instanceof Error ? err.message : err);
    }
  }
  const terms = Array.from(new Set(contentTokens(query))).slice(0, 12);
  if (terms.length === 0) return [];
  const { data, error } = await db.rpc("search_chunks_fulltext", {
    query_text: terms.join(" or "),
    match_count: k,
    filter_topic_ids: topicFilter,
  });
  if (error) throw new Error(`Full-text search failed: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ chunk: toChunk(r), score: Number(r.rank), method: "fulltext" as const }));
}
