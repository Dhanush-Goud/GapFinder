"use client";
import { AlertTriangle, MessageSquareText, Search, Send, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { TutorAnswer } from "@/types/domain";
import { CitationList } from "@/components/domain";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader, inputClass } from "@/components/ui";
import { useAppState } from "@/features/app-state/AppStateProvider";
import { useDerived } from "@/features/app-state/useDerived";

interface Turn {
  question: string;
  topicId: string | null;
  answer?: TutorAnswer;
  error?: string;
}

const retrievalLabel: Record<TutorAnswer["retrieval"], string> = {
  semantic: "Semantic search (pgvector)",
  fulltext: "Full-text search (no embeddings)",
  lexical: "Keyword search (BM25)",
  none: "No passages found",
};

export function TutorView() {
  const params = useSearchParams();
  const { state, config, askTutor } = useAppState();
  const d = useDerived();
  const [question, setQuestion] = useState("");
  const [topicId, setTopicId] = useState<string | null>(params.get("topic"));
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (q.length < 3 || busy) return;
    setBusy(true);
    setQuestion("");
    const turn: Turn = { question: q, topicId };
    setTurns((t) => [turn, ...t]);
    try {
      const answer = await askTutor(q, topicId);
      setTurns((t) => t.map((x) => (x === turn ? { ...x, answer } : x)));
    } catch (err) {
      setTurns((t) => t.map((x) => (x === turn ? { ...x, error: err instanceof Error ? err.message : "Request failed." } : x)));
    } finally {
      setBusy(false);
    }
  }

  const examples = ["Why does BFS find shortest paths in unweighted graphs?", "When should I mark a vertex as visited?", "What is the difference between a base case and a recursive case?"];

  return (
    <>
      <PageHeader
        title="Explain a topic"
        description="Ask about anything in your uploaded material. Answers are built only from retrieved passages and cite them; if your material doesn't cover it, you'll be told instead of getting an unsupported answer."
      />
      <Card className="mb-6">
        <form onSubmit={ask} className="space-y-3 p-5">
          <label htmlFor="q" className="sr-only">Your question</label>
          <textarea id="q" rows={3} maxLength={1000} value={question} onChange={(e) => setQuestion(e.target.value)} className={inputClass} placeholder="e.g. Why does inserting at the front of an array cost O(n)?"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void ask(e); }} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="topic" className="text-sm text-slate-600">Limit to</label>
              <select id="topic" value={topicId ?? ""} onChange={(e) => setTopicId(e.target.value || null)} className={`${inputClass} w-auto`}>
                <option value="">All my material</option>
                {d.topLevel.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <Button type="submit" icon={Send} loading={busy} disabled={question.trim().length < 3}>Ask</Button>
          </div>
          <p className="text-xs text-slate-500">
            {config.mode === "demo" || !config.aiConfigured
              ? "Running without an AI model: the answer is assembled from the most relevant sentences of your material (extractive), found by keyword search."
              : `Answers are written by ${config.aiModel} from passages retrieved for your question, then each citation is checked against the retrieved set.`}
          </p>
        </form>
      </Card>

      {turns.length === 0 ? (
        <Card>
          <EmptyState icon={MessageSquareText} title="Ask your first question">
            {state.chunks.length === 0 ? "Upload notes first so there is something to search." : (
              <span className="mt-2 flex flex-wrap justify-center gap-2">
                {examples.map((x) => (
                  <button key={x} onClick={() => setQuestion(x)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-brand-300 hover:text-brand-700">{x}</button>
                ))}
              </span>
            )}
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-4">
          {turns.map((t, i) => (
            <Card key={i}>
              <CardHeader icon={Search} title={t.question} description={t.topicId ? `Limited to ${d.topicName(t.topicId)}` : "All material"} />
              <div className="space-y-4 px-5 py-4">
                {!t.answer && !t.error && <p className="text-sm text-slate-500">Retrieving passages…</p>}
                {t.error && <Alert tone="error">{t.error}</Alert>}
                {t.answer?.status === "insufficient_evidence" && (
                  <Alert tone="warning" title="Not enough evidence in your material">{t.answer.answer}</Alert>
                )}
                {t.answer?.status === "answered" && (
                  <>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{t.answer.answer}</div>
                    <div>
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Sources</p>
                      <CitationList citations={t.answer.citations} />
                    </div>
                  </>
                )}
                {t.answer && (
                  <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Badge tone="slate">{retrievalLabel[t.answer.retrieval]}</Badge>
                    <Badge tone={t.answer.method === "llm" ? "brand" : "slate"}>
                      {t.answer.method === "llm" ? <><Sparkles className="h-3 w-3" /> AI explanation</> : "Extractive answer (no AI model)"}
                    </Badge>
                    {t.answer.passagesConsidered} passage(s) considered
                    {t.answer.status === "insufficient_evidence" && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden />}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
