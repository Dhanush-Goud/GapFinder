// Loads the sample DSA materials into a signed-in student's own account (real rows, real RLS),
// so judges can run the full live workflow without preparing documents.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AIProvider } from "@/lib/ai/provider";
import { HttpError } from "@/lib/api/respond";
import { loadSampleWorkspace, resolveBankQuestions } from "@/lib/demo/sample";
import { embedChunks, insertChunks, insertTopics } from "./live-documents";
import { saveQuestions } from "./live-quiz";

export async function loadSamplesLive(db: SupabaseClient, ai: AIProvider | null, userId: string) {
  const { count } = await db.from("documents").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_sample", true);
  if ((count ?? 0) > 0) throw new HttpError(409, "The sample materials are already in your library.");
  const { count: topicCount } = await db.from("topics").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if ((topicCount ?? 0) > 0) {
    throw new HttpError(409, "You already have a topic map from your own syllabus. Delete your data in Settings before loading the sample course.");
  }

  const ws = loadSampleWorkspace();
  const docIds = new Map(ws.documents.map((d) => [d.id, crypto.randomUUID()]));
  const { error: docError } = await db.from("documents").insert(
    ws.documents.map((d) => ({
      id: docIds.get(d.id), user_id: userId, name: d.name, kind: d.kind, mime_type: d.mimeType, size_bytes: d.sizeBytes,
      status: "processing", is_sample: true, preview_text: d.previewText, page_count: null, chunk_count: d.chunkCount,
    }))
  );
  if (docError) throw new Error(docError.message);

  const topics = await insertTopics(db, userId, ws.topics, "sample");
  const topicIdByCode = new Map(topics.map((t) => [t.code!, t.id]));
  const oldTopicToNew = new Map(ws.topics.map((t) => [t.id, topicIdByCode.get(t.code!)!]));
  const chunks = ws.chunks.map((c) => ({
    ...c,
    id: crypto.randomUUID(),
    documentId: docIds.get(c.documentId)!,
    topicIds: c.topicIds.map((t) => oldTopicToNew.get(t)!).filter(Boolean),
  }));
  const embedded = await embedChunks(ai, chunks);
  await insertChunks(db, userId, chunks, embedded.vectors);
  for (const d of ws.documents) {
    await db
      .from("documents")
      .update({ status: "ready", embedding_status: embedded.status, error: embedded.status === "failed" ? "Embeddings failed; keyword search will be used." : null })
      .eq("id", docIds.get(d.id))
      .eq("user_id", userId);
  }
  const questions = resolveBankQuestions(chunks, (code) => topicIdByCode.get(code), () => crypto.randomUUID(), docIds.get("sample-notes"));
  await saveQuestions(userId, questions, "sample");
  return { documents: ws.documents.length, topics: topics.length, chunks: chunks.length, questions: questions.length, embeddings: embedded.status };
}
