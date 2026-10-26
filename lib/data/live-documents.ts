// Live ingestion pipeline: store file → extract → chunk → link → embed → persist chunks → status.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Chunk, DocumentKind, Topic } from "@/types/domain";
import type { AIProvider } from "@/lib/ai/provider";
import { createAdminClient } from "@/lib/supabase/server";
import { ExtractionError } from "@/lib/rag/extract";
import { linkChunksToTopics } from "@/lib/rag/link";
import { processDocument } from "@/lib/rag/process";
import { toTopic } from "./live-mappers";

const BUCKET = "documents";

export async function embedChunks(ai: AIProvider | null, chunks: Chunk[]): Promise<{ vectors: number[][] | null; status: "complete" | "not_configured" | "failed"; error?: string }> {
  if (!ai) return { vectors: null, status: "not_configured" };
  try {
    const vectors = await ai.embed(chunks.map((c) => `${c.section ?? ""}\n${c.text}`), "document");
    return { vectors, status: "complete" };
  } catch (err) {
    return { vectors: null, status: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}

export async function insertChunks(db: SupabaseClient, userId: string, chunks: Chunk[], vectors: number[][] | null) {
  for (let i = 0; i < chunks.length; i += 200) {
    const rows = chunks.slice(i, i + 200).map((c, j) => ({
      id: c.id,
      user_id: userId,
      document_id: c.documentId,
      document_name: c.documentName,
      ordinal: c.ordinal,
      page: c.page,
      section: c.section,
      content: c.text,
      topic_ids: c.topicIds,
      embedding: vectors ? JSON.stringify(vectors[i + j]) : null,
    }));
    const { error } = await db.from("document_chunks").insert(rows);
    if (error) throw new Error(`Saving chunks failed: ${error.message}`);
  }
}

/** Inserts parsed topics with fresh UUIDs, preserving the parent hierarchy. Returns the stored topics. */
export async function insertTopics(db: SupabaseClient, userId: string, parsed: Topic[], origin: Topic["origin"]): Promise<Topic[]> {
  const idMap = new Map(parsed.map((t) => [t.id, crypto.randomUUID()]));
  const ordered = [...parsed.filter((t) => !t.parentId), ...parsed.filter((t) => t.parentId)];
  const rows = ordered.map((t) => ({
    id: idMap.get(t.id)!,
    user_id: userId,
    parent_id: t.parentId ? (idMap.get(t.parentId) ?? null) : null,
    code: t.code,
    name: t.name,
    description: t.description,
    importance: t.importance,
    source_refs: t.sourceRefs,
    origin,
    position: parsed.indexOf(t),
  }));
  const { data, error } = await db.from("topics").insert(rows).select("*");
  if (error) throw new Error(`Saving topics failed: ${error.message}`);
  return (data ?? []).map(toTopic);
}

async function loadTopics(db: SupabaseClient, userId: string): Promise<Topic[]> {
  const { data, error } = await db.from("topics").select("*").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toTopic);
}

/** Runs the pipeline for a stored document. Marks the document failed (with reason) on any error. */
export async function processStoredDocument(
  db: SupabaseClient,
  ai: AIProvider | null,
  userId: string,
  doc: { id: string; name: string; kind: DocumentKind; mimeType: string },
  bytes: Uint8Array
): Promise<void> {
  await db.from("documents").update({ status: "processing", error: null, updated_at: new Date().toISOString() }).eq("id", doc.id).eq("user_id", userId);
  try {
    await db.from("document_chunks").delete().eq("document_id", doc.id).eq("user_id", userId);
    let topics = await loadTopics(db, userId);
    const processed = await processDocument({
      doc: { id: doc.id, name: doc.name, kind: doc.kind },
      bytes,
      mimeType: doc.mimeType,
      existingTopics: topics,
      makeChunkId: () => crypto.randomUUID(),
    });
    let chunks = processed.chunks;
    // A syllabus seeds the topic map only if the student has none yet; otherwise they re-extract explicitly.
    if (processed.parsedTopics && topics.length === 0) {
      topics = await insertTopics(db, userId, processed.parsedTopics, "parsed");
    }
    chunks = linkChunksToTopics(chunks, topics);
    const embedded = await embedChunks(ai, chunks);
    await insertChunks(db, userId, chunks, embedded.vectors);
    await db
      .from("documents")
      .update({
        status: "ready",
        error: embedded.status === "failed" ? `Text extracted, but embeddings failed (${embedded.error?.slice(0, 200)}). Keyword search will be used.` : null,
        page_count: processed.pageCount,
        chunk_count: chunks.length,
        embedding_status: embedded.status,
        preview_text: processed.previewText,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id)
      .eq("user_id", userId);
  } catch (err) {
    const message = err instanceof ExtractionError ? err.message : `Processing failed: ${err instanceof Error ? err.message.slice(0, 300) : "unknown error"}`;
    await db.from("documents").update({ status: "failed", error: message, updated_at: new Date().toISOString() }).eq("id", doc.id).eq("user_id", userId);
    throw err;
  }
}

export async function storeOriginalFile(userId: string, docId: string, fileName: string, bytes: Uint8Array, mimeType: string): Promise<string> {
  const path = `${userId}/${docId}/${fileName.replace(/[^\w.\-]+/g, "_").slice(0, 120)}`;
  const { error } = await createAdminClient().storage.from(BUCKET).upload(path, bytes, { contentType: mimeType, upsert: true });
  if (error) throw new Error(`Storing the file failed: ${error.message}`);
  return path;
}

export async function downloadOriginalFile(path: string): Promise<Uint8Array> {
  const { data, error } = await createAdminClient().storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`The original file could not be retrieved: ${error?.message ?? "missing"}`);
  return new Uint8Array(await data.arrayBuffer());
}

export async function deleteOriginalFile(path: string | null) {
  if (!path) return;
  await createAdminClient().storage.from(BUCKET).remove([path]);
}
