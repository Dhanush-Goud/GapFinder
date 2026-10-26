// Live topic extraction from the student's syllabus. The deterministic parser is tried first; the AI
// fallback is only accepted for topics whose quoted source text really appears in the syllabus.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Topic } from "@/types/domain";
import type { AIProvider } from "@/lib/ai/provider";
import { extractTopicsWithAI } from "@/lib/ai/tasks";
import { HttpError } from "@/lib/api/respond";
import { linkChunksToTopics } from "@/lib/rag/link";
import { isUsableTopicMap, parseSyllabus } from "@/lib/syllabus/parse";
import { toChunk } from "./live-mappers";
import { insertTopics } from "./live-documents";

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function extractTopicsLive(db: SupabaseClient, ai: AIProvider | null, userId: string) {
  const { data: docs } = await db.from("documents").select("id, name").eq("user_id", userId).eq("kind", "syllabus").eq("status", "ready");
  if (!docs?.length) throw new HttpError(422, "Upload a syllabus (document type “Syllabus”) first. The topic map is built from the syllabus.");
  const { data: rows } = await db.from("document_chunks").select("*").eq("user_id", userId).in("document_id", docs.map((d) => d.id)).order("ordinal");
  const chunks = (rows ?? []).map(toChunk);
  let topics: Topic[] = [];
  let method: "parsed" | "ai" = "parsed";
  for (const doc of docs) {
    const pages = chunks.filter((c) => c.documentId === doc.id).map((c) => ({ page: c.page, text: c.text }));
    const parsed = parseSyllabus(pages, doc, (code) => `${doc.id}:${code}`);
    if (isUsableTopicMap(parsed)) topics = topics.concat(parsed.topics);
  }
  if (topics.length === 0) {
    if (!ai) throw new HttpError(422, "No numbered units (e.g. “Unit 1: …”, “1.1 …”) were found in your syllabus, and no AI provider is configured to interpret it.");
    method = "ai";
    const fullText = chunks.map((c) => c.text).join("\n");
    const haystack = squash(fullText);
    const extracted = await extractTopicsWithAI(ai, fullText);
    const doc = docs[0];
    extracted.topics.forEach((t, i) => {
      if (!haystack.includes(squash(t.sourceQuote))) return; // unverifiable → rejected
      const id = `ai:${i}`;
      topics.push({
        id, code: null, name: t.name, description: t.description, parentId: null,
        importance: t.importance === "high" ? 3 : t.importance === "medium" ? 2 : t.importance === "low" ? 1 : null,
        sourceRefs: [{ documentId: doc.id, documentName: doc.name, section: t.sourceQuote.slice(0, 80), page: null }], origin: "ai",
      });
      t.subtopics.forEach((s, j) => {
        if (!haystack.includes(squash(s.sourceQuote))) return;
        topics.push({
          id: `ai:${i}.${j}`, code: null, name: s.name, description: s.description, parentId: id, importance: null,
          sourceRefs: [{ documentId: doc.id, documentName: doc.name, section: s.sourceQuote.slice(0, 80), page: null }], origin: "ai",
        });
      });
    });
    if (topics.filter((t) => !t.parentId).length === 0) throw new HttpError(422, "The AI could not produce topics that are verifiably present in your syllabus.");
  }

  // Replacing the topic map removes quiz data tied to old topics (the UI asks for confirmation).
  const { error: delError } = await db.from("topics").delete().eq("user_id", userId);
  if (delError) throw new Error(delError.message);
  const stored = await insertTopics(db, userId, topics, method);

  const { data: allRows } = await db.from("document_chunks").select("*").eq("user_id", userId);
  const relinked = linkChunksToTopics((allRows ?? []).map(toChunk), stored);
  for (let i = 0; i < relinked.length; i += 25) {
    await Promise.all(relinked.slice(i, i + 25).map((c) => db.from("document_chunks").update({ topic_ids: c.topicIds }).eq("id", c.id).eq("user_id", userId)));
  }
  return { method, topics: stored.length, linkedChunks: relinked.filter((c) => c.topicIds.length).length, totalChunks: relinked.length };
}
