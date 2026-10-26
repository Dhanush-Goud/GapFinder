// Live mode: delete a document, its chunks (cascade) and its stored file.
import { HttpError, ok, route } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { deleteOriginalFile } from "@/lib/data/live-documents";

export const DELETE = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const viewer = await requireUser();
  const { data: doc } = await viewer.supabase.from("documents").select("id, storage_path").eq("id", id).eq("user_id", viewer.userId).maybeSingle();
  if (!doc) throw new HttpError(404, "Document not found.");
  const { error } = await viewer.supabase.from("documents").delete().eq("id", id).eq("user_id", viewer.userId);
  if (error) throw new Error(error.message);
  await deleteOriginalFile(doc.storage_path);
  return ok({ deleted: id });
});
