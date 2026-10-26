"use client";
import { AlertCircle, BookOpen, CheckCircle2, ChevronDown, ChevronUp, Database, FileText, Loader2, PackageOpen, RotateCcw, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import type { DocumentKind, StudyDocument } from "@/types/domain";
import { formatBytes, formatDateTime, SampleDataBadge } from "@/components/domain";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Field, PageHeader, inputClass } from "@/components/ui";
import { useAppState } from "@/features/app-state/AppStateProvider";

const KINDS: { value: DocumentKind; label: string }[] = [
  { value: "syllabus", label: "Syllabus" },
  { value: "notes", label: "Notes" },
  { value: "textbook", label: "Textbook chapter" },
  { value: "question_paper", label: "Previous question paper" },
];
const MAX_MB = 4;

export function MaterialsView() {
  const { state, config, uploadDocument, retryDocument, deleteDocument, loadSamples } = useAppState();
  const [kind, setKind] = useState<DocumentKind>("notes");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasSyllabus = state.documents.some((d) => d.kind === "syllabus" && d.status === "ready");
  const hasSample = state.documents.some((d) => d.isSample);

  function pick(f: File | null) {
    setMessage(null);
    if (!f) return setFile(null);
    const ok = /\.(pdf|txt|md|markdown)$/i.test(f.name);
    if (!ok) {
      setMessage({ tone: "error", text: `“${f.name}” is not a PDF or text file.` });
      return setFile(null);
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setMessage({ tone: "error", text: `“${f.name}” is ${formatBytes(f.size)}; the limit is ${MAX_MB} MB.` });
      return setFile(null);
    }
    setFile(f);
  }

  async function upload() {
    if (!file) return;
    setBusy("upload");
    setMessage(null);
    try {
      const doc = await uploadDocument(file, kind);
      if (doc?.status === "failed") setMessage({ tone: "error", text: doc.error ?? "Processing failed." });
      else
        setMessage({
          tone: doc?.embeddingStatus === "failed" ? "warning" : "success",
          text: `“${doc.name}” processed: ${doc.chunkCount} passages indexed${doc.pageCount ? ` from ${doc.pageCount} pages` : ""}.${doc.error ? ` ${doc.error}` : ""}`,
        });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setBusy(null);
    }
  }

  async function run(id: string, fn: () => Promise<unknown>, success?: string) {
    setBusy(id);
    setMessage(null);
    try {
      const r = await fn();
      if (success || typeof r === "string") setMessage({ tone: "success", text: typeof r === "string" ? r : success! });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Action failed." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Materials"
        description="Upload your syllabus first — it defines the topic map. Notes and textbook chapters are split into passages that questions and explanations are grounded in."
        actions={
          config.mode === "live" && !hasSample ? (
            <Button variant="secondary" icon={PackageOpen} loading={busy === "samples"} onClick={() => run("samples", loadSamples)}>
              Load sample DSA course
            </Button>
          ) : undefined
        }
      />

      {message && <Alert tone={message.tone} className="mb-6">{message.text}</Alert>}

      <Card className="mb-6">
        <CardHeader icon={Upload} title="Upload a document" description={`PDF, .txt or .md — up to ${MAX_MB} MB. Text-based PDFs only (scanned images can't be read yet).`} />
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-[1fr_220px_auto] sm:items-end">
          <Field label="File" htmlFor="file">
            <input
              ref={inputRef}
              id="file"
              type="file"
              accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            />
          </Field>
          <Field label="Document type" htmlFor="kind">
            <select id="kind" value={kind} onChange={(e) => setKind(e.target.value as DocumentKind)} className={inputClass}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </Field>
          <Button onClick={upload} disabled={!file} loading={busy === "upload"} icon={Upload}>
            {busy === "upload" ? "Processing…" : "Upload & process"}
          </Button>
        </div>
        {!hasSyllabus && <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Tip: no syllabus yet. Upload one with numbered units (e.g. “Unit 1: Arrays”, “1.1 Indexing”) to build your topic map.</p>}
        {config.mode === "demo" && (
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            Demo mode: uploads are really extracted, chunked and searchable by the topic assistant, and an uploaded syllabus is parsed into topics. Generating quiz questions from your own files needs live mode with a Gemini key. Files stay in this browser.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader icon={BookOpen} title="Library" description={`${state.documents.length} document(s), ${state.chunks.length} indexed passages`} />
        {state.documents.length === 0 ? (
          <EmptyState icon={FileText} title="No documents yet">Upload your syllabus and notes to get started.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {state.documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                busy={busy === doc.id}
                live={config.mode === "live"}
                onRetry={() => run(doc.id, () => retryDocument(doc.id), "Reprocessing finished.")}
                onDelete={() => {
                  if (window.confirm(`Delete “${doc.name}” and its indexed passages?`)) void run(doc.id, () => deleteDocument(doc.id), "Document deleted.");
                }}
              />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function StatusBadge({ doc }: { doc: StudyDocument }) {
  if (doc.status === "ready") return <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> Ready</Badge>;
  if (doc.status === "failed") return <Badge tone="red"><AlertCircle className="h-3 w-3" /> Failed</Badge>;
  return <Badge tone="blue"><Loader2 className="h-3 w-3 animate-spin" /> Processing</Badge>;
}

const embeddingLabel: Record<StudyDocument["embeddingStatus"], { text: string; tone: "green" | "slate" | "red" | "blue" }> = {
  complete: { text: "Semantic search ready", tone: "green" },
  not_configured: { text: "Keyword search (no embeddings)", tone: "slate" },
  failed: { text: "Embeddings failed — keyword search", tone: "red" },
  pending: { text: "Embeddings pending", tone: "blue" },
};

function DocumentRow({ doc, busy, live, onRetry, onDelete }: { doc: StudyDocument; busy: boolean; live: boolean; onRetry: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const emb = embeddingLabel[doc.embeddingStatus];
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start gap-4">
        <span className="rounded-lg bg-slate-100 p-2 text-slate-500"><FileText className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium text-slate-900">{doc.name}</p>
            <StatusBadge doc={doc} />
            {doc.isSample && <SampleDataBadge />}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {KINDS.find((k) => k.value === doc.kind)?.label} · {doc.mimeType === "application/pdf" ? "PDF" : "Text"} · {formatBytes(doc.sizeBytes)} · uploaded {formatDateTime(doc.uploadedAt)}
          </p>
          {doc.status === "ready" && (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <Database className="h-3.5 w-3.5 text-slate-400" aria-hidden /> Text extracted · {doc.chunkCount} passages{doc.pageCount ? ` · ${doc.pageCount} pages` : " · section-referenced"}
              <Badge tone={emb.tone}>{emb.text}</Badge>
            </p>
          )}
          {doc.error && <p className={`mt-2 text-sm ${doc.status === "failed" ? "text-red-600" : "text-amber-700"}`}>{doc.error}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setOpen(!open)} icon={open ? ChevronUp : ChevronDown} aria-expanded={open}>Preview</Button>
          {live && doc.status === "failed" && <Button variant="secondary" icon={RotateCcw} loading={busy} onClick={onRetry}>Retry</Button>}
          <Button variant="danger" icon={Trash2} loading={busy} onClick={onDelete} aria-label={`Delete ${doc.name}`}>Delete</Button>
        </div>
      </div>
      {open && (
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
          {doc.previewText || "No text was extracted."}
        </pre>
      )}
    </li>
  );
}
