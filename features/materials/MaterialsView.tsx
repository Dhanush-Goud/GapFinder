"use client";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  FileText,
  Filter,
  Loader2,
  PackageOpen,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { DocumentKind, StudyDocument } from "@/types/domain";
import { formatBytes, formatDateTime, SampleDataBadge } from "@/components/domain";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Field, PageHeader, inputClass } from "@/components/ui";
import { useAppState } from "@/features/app-state/AppStateProvider";

const KINDS: { value: DocumentKind; label: string }[] = [
  { value: "syllabus", label: "Syllabus (defines topic map)" },
  { value: "notes", label: "Lecture Notes" },
  { value: "textbook", label: "Textbook Chapter" },
  { value: "question_paper", label: "Previous Question Paper" },
];
const MAX_MB = 4;

export function MaterialsView() {
  const { state, config, uploadDocument, retryDocument, deleteDocument, loadSamples } = useAppState();
  const [kind, setKind] = useState<DocumentKind>("notes");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [filterKind, setFilterKind] = useState<string>("all");
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
      if (doc?.status === "failed") {
        setMessage({ tone: "error", text: doc.error ?? "Processing failed." });
      } else {
        setMessage({
          tone: doc?.embeddingStatus === "failed" ? "warning" : "success",
          text: `“${doc.name}” processed: ${doc.chunkCount} passages indexed${doc.pageCount ? ` from ${doc.pageCount} pages` : ""}.${doc.error ? ` ${doc.error}` : ""}`,
        });
      }
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

  const filteredDocs = useMemo(() => {
    return state.documents.filter((doc) => {
      const matchSearch = doc.name.toLowerCase().includes(search.toLowerCase());
      const matchKind = filterKind === "all" || doc.kind === filterKind;
      return matchSearch && matchKind;
    });
  }, [state.documents, search, filterKind]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Study Materials"
        description="Ingest, extract, and index course documents. Syllabi define verified topic graphs; notes and textbook chapters produce verifiable, cited passages for diagnostic questions."
        actions={
          config.mode === "live" && !hasSample ? (
            <Button
              variant="secondary"
              icon={PackageOpen}
              loading={busy === "samples"}
              onClick={() => run("samples", loadSamples)}
              className="text-xs"
            >
              Load Sample Course
            </Button>
          ) : undefined
        }
      />

      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      {/* Upload Zone Card */}
      <Card className="border-[#2A2D26] bg-[#10110F]">
        <CardHeader
          icon={Upload}
          title="Document Ingestion"
          description={`PDF, .txt or .md files up to ${MAX_MB} MB. Text-layer extraction with automatic chunking.`}
        />
        <div className="p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_240px_auto] sm:items-end">
            <Field label="File Attachment" htmlFor="file" hint="Select a local document to process">
              <input
                ref={inputRef}
                id="file"
                type="file"
                accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
                onChange={(e) => pick(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-[#A0A39A] file:mr-3 file:rounded-lg file:border file:border-[#2A2D26] file:bg-[#171915] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#D5FF32] hover:file:bg-[#20221D] file:transition-colors cursor-pointer"
              />
            </Field>

            <Field label="Document Category" htmlFor="kind">
              <select
                id="kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as DocumentKind)}
                className={inputClass}
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>

            <Button
              onClick={upload}
              disabled={!file}
              loading={busy === "upload"}
              icon={Upload}
              className="w-full sm:w-auto h-[38px] text-xs uppercase tracking-wider font-bold"
            >
              {busy === "upload" ? "Extracting…" : "Ingest & Index"}
            </Button>
          </div>

          {!hasSyllabus && (
            <div className="rounded-lg border border-[#D5FF32]/30 bg-[#D5FF32]/10 p-3 text-xs text-[#D5FF32]">
              <strong>Recommendation:</strong> Ingest a course syllabus first. Its numbered chapters and units form the diagnostic knowledge map that subsequent notes are linked to.
            </div>
          )}

          {config.mode === "demo" && (
            <p className="text-[11px] text-[#73776E] border-t border-[#2A2D26] pt-3">
              Demo sandbox: Documents are processed locally in your browser memory. Extracted text is fully indexed, chunked, and searchable by the AI Tutor and Diagnostic engine.
            </p>
          )}
        </div>
      </Card>

      {/* Document Library */}
      <Card className="border-[#2A2D26] bg-[#10110F]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2A2D26] p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#2A2D26] bg-[#171915] text-[#D5FF32]">
              <BookOpen className="h-3.5 w-3.5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-[#F4F5F0]">Document Repository</h2>
              <p className="text-xs text-[#A0A39A]">
                {state.documents.length} document(s) · {state.chunks.length} passages indexed
              </p>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#73776E]" />
              <input
                type="text"
                placeholder="Search documents…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-44 rounded-lg border border-[#2A2D26] bg-[#171915] pl-8 pr-3 py-1.5 text-xs text-[#F4F5F0] placeholder:text-[#73776E] focus:border-[#D5FF32] focus:outline-none"
              />
            </div>
            <select
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value)}
              className="rounded-lg border border-[#2A2D26] bg-[#171915] px-2.5 py-1.5 text-xs text-[#F4F5F0] focus:border-[#D5FF32] focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="syllabus">Syllabus</option>
              <option value="notes">Notes</option>
              <option value="textbook">Textbook</option>
              <option value="question_paper">Exam Paper</option>
            </select>
          </div>
        </div>

        {filteredDocs.length === 0 ? (
          <EmptyState icon={FileText} title="No matching documents found">
            {state.documents.length === 0
              ? "Upload your syllabus and notes above to begin building your knowledge telemetry."
              : "No documents matched your search filter criteria."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-[#2A2D26]">
            {filteredDocs.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                busy={busy === doc.id}
                live={config.mode === "live"}
                onRetry={() => run(doc.id, () => retryDocument(doc.id), "Reprocessing completed.")}
                onDelete={() => {
                  if (window.confirm(`Delete “${doc.name}” and all associated index passages?`)) {
                    void run(doc.id, () => deleteDocument(doc.id), "Document deleted.");
                  }
                }}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatusBadge({ doc }: { doc: StudyDocument }) {
  if (doc.status === "ready") {
    return (
      <Badge tone="green">
        <CheckCircle2 className="h-3 w-3 text-[#34D399]" /> Ready
      </Badge>
    );
  }
  if (doc.status === "failed") {
    return (
      <Badge tone="red">
        <AlertCircle className="h-3 w-3 text-[#F87171]" /> Failed
      </Badge>
    );
  }
  return (
    <Badge tone="blue">
      <Loader2 className="h-3 w-3 animate-spin text-[#38BDF8]" /> Processing
    </Badge>
  );
}

const embeddingLabel: Record<StudyDocument["embeddingStatus"], { text: string; tone: "green" | "slate" | "red" | "blue" }> = {
  complete: { text: "Semantic Search Active", tone: "green" },
  not_configured: { text: "Lexical & BM25 Search", tone: "slate" },
  failed: { text: "Embeddings Fallback", tone: "red" },
  pending: { text: "Embedding Ingest Pending", tone: "blue" },
};

function DocumentRow({
  doc,
  busy,
  live,
  onRetry,
  onDelete,
}: {
  doc: StudyDocument;
  busy: boolean;
  live: boolean;
  onRetry: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const emb = embeddingLabel[doc.embeddingStatus];

  return (
    <li className="p-4 sm:p-5 hover:bg-[#171915]/50 transition-colors">
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#2A2D26] bg-[#171915] text-[#D5FF32]">
          <FileText className="h-4 w-4" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-[#F4F5F0]">{doc.name}</h3>
            <StatusBadge doc={doc} />
            {doc.isSample && <SampleDataBadge />}
          </div>

          <p className="mt-1 text-xs text-[#73776E]">
            <span className="capitalize text-[#A0A39A]">{doc.kind.replace("_", " ")}</span> ·{" "}
            {doc.mimeType === "application/pdf" ? "PDF" : "Text"} · {formatBytes(doc.sizeBytes)} · Ingested{" "}
            {formatDateTime(doc.uploadedAt)}
          </p>

          {doc.status === "ready" && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#A0A39A]">
              <span className="inline-flex items-center gap-1">
                <Database className="h-3 w-3 text-[#73776E]" />
                <strong className="text-[#F4F5F0] tabular-nums font-semibold">{doc.chunkCount}</strong> passages
                {doc.pageCount ? ` · ${doc.pageCount} pages` : ""}
              </span>
              <span>·</span>
              <Badge tone={emb.tone}>{emb.text}</Badge>
            </div>
          )}

          {doc.error && (
            <p className={`mt-2 text-xs ${doc.status === "failed" ? "text-[#F87171]" : "text-[#FBBF24]"}`}>
              {doc.error}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            onClick={() => setOpen(!open)}
            icon={open ? ChevronUp : ChevronDown}
            className="text-xs"
            aria-expanded={open}
          >
            Preview
          </Button>
          {live && doc.status === "failed" && (
            <Button variant="secondary" icon={RotateCcw} loading={busy} onClick={onRetry} className="text-xs">
              Retry
            </Button>
          )}
          <Button
            variant="danger"
            icon={Trash2}
            loading={busy}
            onClick={onDelete}
            aria-label={`Delete ${doc.name}`}
            className="text-xs"
          >
            Delete
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-3 overflow-hidden rounded-lg border border-[#2A2D26] bg-[#080908]">
          <div className="border-b border-[#2A2D26] bg-[#10110F] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#73776E]">
            Extracted Text Stream
          </div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap p-4 text-xs font-mono leading-relaxed text-[#A0A39A]">
            {doc.previewText || "No readable text extracted from document."}
          </pre>
        </div>
      )}
    </li>
  );
}
