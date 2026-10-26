// Live mode: re-run processing for a failed document using the stored original file.
import { HttpError, ok, route } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { getAIProvider } from "@/lib/ai";
import { downloadOriginalFile, processStoredDocument } from "@/lib/data/live-documents";
import { toDocument } from "@/lib/data/live-mappers";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const viewer = await requireUser();
  const db = viewer.supabase;
  const { data: doc } = await db.from("documents").select("*").eq("id", id).eq("user_id", viewer.userId).maybeSingle();
  if (!doc) throw new HttpError(404, "Document not found.");
  if (!doc.storage_path) throw new HttpError(409, "The original file is not stored, so it cannot be reprocessed. Upload it again.");
  const bytes = await downloadOriginalFile(doc.storage_path);
  try {
    await processStoredDocument(db, getAIProvider(), viewer.userId, { id: doc.id, name: doc.name, kind: doc.kind, mimeType: doc.mime_type }, bytes);
  } catch {
    // failure reason is stored on the row
  }
  const { data: saved } = await db.from("documents").select("*").eq("id", id).single();
  return ok({ document: toDocument(saved) }, saved?.status === "failed" ? 422 : 200);
});
