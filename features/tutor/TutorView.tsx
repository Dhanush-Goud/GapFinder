"use client";
import {
  AlertTriangle,
  Bot,
  BrainCircuit,
  CornerDownLeft,
  FileSearch,
  MessageSquareText,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
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
  semantic: "Semantic Retrieval (pgvector)",
  fulltext: "Full-Text Index (Postgres)",
  lexical: "Keyword Retrieval (BM25)",
  none: "No Passages Found",
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
      setTurns((t) =>
        t.map((x) => (x === turn ? { ...x, error: err instanceof Error ? err.message : "Request failed." } : x))
      );
    } finally {
      setBusy(false);
    }
  }

  const examples = [
    "Why does BFS find shortest paths in unweighted graphs?",
    "When should I mark a vertex as visited?",
    "What is the difference between a base case and a recursive case?",
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Tutor & Explanation Lab"
        description="Ask conceptual questions about your course materials. Every explanation is strictly grounded in retrieved passages with verifiable citations; if notes do not support the claim, an insufficient-evidence state is reported."
      />

      {/* Question Input Card */}
      <Card className="border-[#2A2D26] bg-[#10110F]">
        <form onSubmit={ask} className="space-y-3 p-5">
          <label htmlFor="q" className="sr-only">
            Your question
          </label>
          <div className="relative">
            <textarea
              id="q"
              rows={3}
              maxLength={1000}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className={`${inputClass} resize-none font-sans text-xs leading-relaxed`}
              placeholder="Inquire regarding any concept or problem (e.g. How does amortized constant time apply to dynamic array resizing?)"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void ask(e);
              }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <label htmlFor="topic" className="text-xs font-semibold uppercase tracking-wider text-[#73776E]">
                Scope:
              </label>
              <select
                id="topic"
                value={topicId ?? ""}
                onChange={(e) => setTopicId(e.target.value || null)}
                className="rounded-lg border border-[#2A2D26] bg-[#171915] px-2.5 py-1.5 text-xs text-[#F4F5F0] focus:border-[#D5FF32] focus:outline-none"
              >
                <option value="">All Uploaded Materials</option>
                {d.topLevel.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="submit"
              icon={Send}
              loading={busy}
              disabled={question.trim().length < 3}
              className="text-xs uppercase tracking-wider font-bold"
            >
              Consult Tutor
            </Button>
          </div>

          <p className="text-[11px] text-[#73776E] border-t border-[#2A2D26]/60 pt-2 flex items-center justify-between">
            <span>
              {config.mode === "demo" || !config.aiConfigured
                ? "Running deterministic extractive mode: synthesizes verified sentences from retrieved material."
                : `Augmented synthesis via ${config.aiModel} with citation verification against stored chunks.`}
            </span>
            <span className="hidden sm:inline font-mono text-[10px]">⌘+Enter to submit</span>
          </p>
        </form>
      </Card>

      {/* Answer Stream */}
      {turns.length === 0 ? (
        <Card className="border-[#2A2D26] bg-[#10110F]">
          <EmptyState icon={MessageSquareText} title="Consult the diagnostic study assistant">
            {state.chunks.length === 0 ? (
              <p>Upload lecture notes or textbook chapters in Materials to begin asking grounded questions.</p>
            ) : (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-[#73776E]">Suggested technical queries from course materials:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {examples.map((x) => (
                    <button
                      key={x}
                      onClick={() => setQuestion(x)}
                      className="rounded-lg border border-[#2A2D26] bg-[#171915] px-3 py-1.5 text-xs text-[#A0A39A] transition-colors hover:border-[#D5FF32]/50 hover:text-[#D5FF32]"
                    >
                      {x}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-4">
          {turns.map((t, i) => (
            <Card key={i} className="border-[#2A2D26] bg-[#10110F]">
              <CardHeader
                icon={Search}
                title={t.question}
                description={t.topicId ? `Constrained to unit: ${d.topicName(t.topicId)}` : "Entire repository search"}
              />
              <div className="space-y-4 p-5">
                {!t.answer && !t.error && (
                  <div className="flex items-center gap-2 text-xs text-[#A0A39A]">
                    <span className="h-2 w-2 rounded-full bg-[#D5FF32] animate-pulse" />
                    Searching stored index & analyzing passages…
                  </div>
                )}

                {t.error && <Alert tone="error">{t.error}</Alert>}

                {t.answer?.status === "insufficient_evidence" && (
                  <Alert tone="warning" title="Insufficient Source Evidence">
                    {t.answer.answer}
                  </Alert>
                )}

                {t.answer?.status === "answered" && (
                  <>
                    <div className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed text-[#F4F5F0] bg-[#171915] border border-[#2A2D26] p-4 rounded-xl">
                      {t.answer.answer}
                    </div>

                    {t.answer.citations.length > 0 && (
                      <div className="border-t border-[#2A2D26]/70 pt-3">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#73776E]">
                          Grounding Passages & Citations ({t.answer.citations.length})
                        </p>
                        <CitationList citations={t.answer.citations} />
                      </div>
                    )}
                  </>
                )}

                {t.answer && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-[#2A2D26]/70 pt-3 text-[11px] text-[#73776E]">
                    <Badge tone="slate">{retrievalLabel[t.answer.retrieval]}</Badge>
                    <Badge tone={t.answer.method === "llm" ? "brand" : "slate"}>
                      {t.answer.method === "llm" ? (
                        <>
                          <Sparkles className="h-3 w-3 text-[#D5FF32]" /> AI Synthesis
                        </>
                      ) : (
                        "Extractive Grounded"
                      )}
                    </Badge>
                    <span>·</span>
                    <span>{t.answer.passagesConsidered} passage(s) evaluated</span>
                    {t.answer.status === "insufficient_evidence" && (
                      <span className="text-[#E5A83B] flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Material gap flagged
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
