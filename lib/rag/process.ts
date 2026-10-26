// Storage-agnostic ingestion: extract → chunk → (parse syllabus) → link to topics.
// Embedding and persistence are done by the caller so the demo path makes no external calls.
import type { Chunk, DocumentKind, Topic } from "@/types/domain";
import { chunkDocument } from "./chunk";
import { extractText, type ExtractedPage } from "./extract";
import { linkChunksToTopics } from "./link";
import { parseSyllabus, isUsableTopicMap } from "@/lib/syllabus/parse";

export interface ProcessedDocument {
  pages: ExtractedPage[];
  pageCount: number | null;
  chunks: Chunk[];
  previewText: string;
  /** Topics parsed from this document when it is a syllabus with recognisable structure. */
  parsedTopics: Topic[] | null;
}

export async function processDocument(args: {
  doc: { id: string; name: string; kind: DocumentKind };
  bytes: Uint8Array;
  mimeType: string;
  existingTopics: Topic[];
  makeChunkId?: (ordinal: number) => string;
  makeTopicId?: (code: string) => string;
}): Promise<ProcessedDocument> {
  const extracted = await extractText(args.bytes, args.mimeType, args.doc.name);
  let chunks = chunkDocument(args.doc, extracted.pages, undefined, args.makeChunkId);
  let parsedTopics: Topic[] | null = null;
  if (args.doc.kind === "syllabus") {
    const parsed = parseSyllabus(extracted.pages, args.doc, args.makeTopicId);
    if (isUsableTopicMap(parsed)) parsedTopics = parsed.topics;
  }
  const topicsForLinking = parsedTopics ?? args.existingTopics;
  if (topicsForLinking.length) chunks = linkChunksToTopics(chunks, topicsForLinking);
  const previewText = extracted.pages.map((p) => (p.page ? `[Page ${p.page}]\n${p.text}` : p.text)).join("\n\n").slice(0, 1500);
  return { pages: extracted.pages, pageCount: extracted.pageCount, chunks, previewText, parsedTopics };
}
