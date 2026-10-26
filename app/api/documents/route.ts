// Live mode: upload a document and run the ingestion pipeline.
import { HttpError, ok, route } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { getAIProvider } from "@/lib/ai";
import { processStoredDocument, storeOriginalFile } from "@/lib/data/live-documents";
import { toDocument } from "@/lib/data/live-mappers";
import { detectMimeType, validateUpload } from "@/lib/rag/extract";
import { documentKindSchema } from "@/lib/validation/api";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = route(async (req: Request) => {
  const viewer = await requireUser();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "No file was uploaded.");
  const kind = documentKindSchema.parse(form.get("kind"));
  const mimeType = detectMimeType(file.name, file.type);
  validateUpload(file.name, mimeType, file.size);
  const bytes = new Uint8Array(await file.arrayBuffer());

  const db = viewer.supabase;
  const { data: doc, error } = await db
    .from("documents")
    .insert({ user_id: viewer.userId, name: file.name.slice(0, 255), kind, mime_type: mimeType, size_bytes: file.size, status: "processing" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  try {
    const storagePath = await storeOriginalFile(viewer.userId, doc.id, file.name, bytes, mimeType);
    await db.from("documents").update({ storage_path: storagePath }).eq("id", doc.id).eq("user_id", viewer.userId);
    await processStoredDocument(db, getAIProvider(), viewer.userId, { id: doc.id, name: doc.name, kind, mimeType }, bytes);
  } catch (err) {
    // processStoredDocument already recorded the failure reason on the document row.
    await db.from("documents").update({ status: "failed", error: err instanceof Error ? err.message.slice(0, 400) : "Processing failed" }).eq("id", doc.id).eq("user_id", viewer.userId).eq("status", "processing");
    const { data: failed } = await db.from("documents").select("*").eq("id", doc.id).single();
    return ok({ document: failed ? toDocument(failed) : null, error: failed?.error ?? "Processing failed." }, 422);
  }
  const { data: saved } = await db.from("documents").select("*").eq("id", doc.id).single();
  return ok({ document: toDocument(saved) }, 201);
});
