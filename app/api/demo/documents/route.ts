// Demo mode: runs the real extraction/chunking/linking pipeline on an uploaded file and returns the
// result for the browser to keep. Nothing is stored server-side and no external service is called.
import { z } from "zod";
import type { StudyDocument, Topic } from "@/types/domain";
import { HttpError, ok, route } from "@/lib/api/respond";
import { requireDemo } from "@/lib/auth/session";
import { detectMimeType, validateUpload } from "@/lib/rag/extract";
import { processDocument } from "@/lib/rag/process";
import { documentKindSchema } from "@/lib/validation/api";

export const runtime = "nodejs";

const topicLite = z.object({
  id: z.string(), code: z.string().nullable(), name: z.string(), description: z.string(),
  parentId: z.string().nullable(), importance: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  sourceRefs: z.array(z.any()), origin: z.enum(["parsed", "ai", "sample"]),
});

export const POST = route(async (req: Request) => {
  await requireDemo();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "No file was uploaded.");
  const kind = documentKindSchema.parse(form.get("kind"));
  const existingTopics = z.array(topicLite).max(500).parse(JSON.parse(String(form.get("topics") ?? "[]"))) as Topic[];
  const mimeType = detectMimeType(file.name, file.type);
  validateUpload(file.name, mimeType, file.size);

  const id = `doc-${crypto.randomUUID()}`;
  const processed = await processDocument({
    doc: { id, name: file.name, kind },
    bytes: new Uint8Array(await file.arrayBuffer()),
    mimeType,
    existingTopics,
    makeTopicId: (code) => `${id}:u${code}`,
  });
  const document: StudyDocument = {
    id, name: file.name, kind, mimeType, sizeBytes: file.size, uploadedAt: new Date().toISOString(),
    status: "ready", error: null, pageCount: processed.pageCount, chunkCount: processed.chunks.length,
    embeddingStatus: "not_configured", isSample: false, previewText: processed.previewText,
  };
  return ok({ document, chunks: processed.chunks, topics: processed.parsedTopics }, 201);
});
