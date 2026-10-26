"use client";
import { CheckCircle2, CircleDashed, FileSearch, Sparkles, XCircle } from "lucide-react";
import type { EvaluatedAnswer, QuizAttempt } from "@/types/domain";
import { CitationList, DifficultyBadge, formatDateTime, pct, SampleDataBadge } from "@/components/domain";
import { Badge, Card } from "@/components/ui";
import { useDerived } from "@/features/app-state/useDerived";

const evaluatorLabel: Record<EvaluatedAnswer["evaluator"], string> = {
  deterministic: "Graded analytically against ground truth answer key",
  "keyword-heuristic": "Graded by deterministic concept rubric",
  llm: "Graded by verified AI diagnostic evaluator",
};

export function AttemptResults({ attempt }: { attempt: QuizAttempt }) {
  const d = useDerived();
  const results = attempt.results ?? [];
  const correct = results.filter((r) => r.isCorrect).length;

  return (
    <div className="space-y-4">
      {/* Score Summary Banner */}
      <Card className="p-6 border-[#2A2D26] bg-[#10110F]">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="border-r border-[#2A2D26] pr-6">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#73776E]">Diagnostic Score</p>
              <p className="mt-1 text-4xl font-extrabold tabular-nums tracking-tight text-[#D5FF32]">
                {pct(attempt.score)}
              </p>
            </div>
            <div className="text-xs text-[#A0A39A] space-y-1">
              <p className="font-semibold text-[#F4F5F0]">
                {correct} of {results.length} questions answered accurately
              </p>
              <p className="text-[11px] text-[#73776E]">
                {formatDateTime(attempt.completedAt ?? attempt.createdAt)} · {attempt.topicIds.map(d.topicName).join(", ") || "General Assessment"}
              </p>
            </div>
          </div>
          {attempt.isSample && <SampleDataBadge />}
        </div>
      </Card>

      {/* Evaluated Questions List */}
      <ol className="space-y-4">
        {results.map((r, i) => (
          <ResultItem key={r.questionId} r={r} index={i} topicName={d.topicName(r.topicId)} />
        ))}
      </ol>
    </div>
  );
}

function ResultItem({ r, index, topicName }: { r: EvaluatedAnswer; index: number; topicName: string }) {
  const partial = !r.isCorrect && r.score > 0;

  return (
    <li>
      <Card className="p-5 border-[#2A2D26] bg-[#10110F]">
        <div className="flex items-start gap-3.5">
          {r.isCorrect ? (
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#10B981]/15 text-[#34D399]">
              <CheckCircle2 className="h-4 w-4" aria-label="Correct" />
            </span>
          ) : partial ? (
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#E5A83B]/15 text-[#FBBF24]">
              <CircleDashed className="h-4 w-4" aria-label="Partially correct" />
            </span>
          ) : (
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#EF4444]/15 text-[#F87171]">
              <XCircle className="h-4 w-4" aria-label="Incorrect" />
            </span>
          )}

          <div className="min-w-0 flex-1 space-y-3.5">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#73776E]">
                <span>Question {index + 1}</span>
                <span>·</span>
                <span className="font-semibold text-[#F4F5F0]">{topicName}</span>
                <DifficultyBadge difficulty={r.difficulty} />
                {r.type === "short" && (
                  <Badge tone={r.score >= 0.7 ? "green" : r.score > 0 ? "amber" : "red"}>
                    Short answer · {Math.round(r.score * 100)}% credit
                  </Badge>
                )}
              </div>
              <h3 className="mt-1.5 text-sm font-semibold text-[#F4F5F0] leading-snug">{r.prompt}</h3>
            </div>

            {/* MCQ Options Breakdown */}
            {r.type === "mcq" && r.options && (
              <ul className="space-y-2">
                {r.options.map((o, i) => {
                  const isKey = i === r.correctOption;
                  const chosen = i === r.selectedOption;
                  return (
                    <li
                      key={i}
                      className={`flex items-start justify-between rounded-xl border p-3 text-xs transition-colors ${
                        isKey
                          ? "border-[#10B981]/50 bg-[#10B981]/10 text-[#A7F3D0]"
                          : chosen
                          ? "border-[#EF4444]/50 bg-[#EF4444]/10 text-[#FECACA]"
                          : "border-[#2A2D26] bg-[#171915] text-[#A0A39A]"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <strong className="font-bold">{String.fromCharCode(65 + i)}.</strong>
                        <span>{o}</span>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                        {isKey && <span className="text-[#34D399]">✓ Key</span>}
                        {chosen && !isKey && <span className="text-[#F87171]">Selected</span>}
                      </div>
                    </li>
                  );
                })}
                {r.selectedOption === null && (
                  <li className="text-xs font-semibold text-[#F87171]">Unanswered.</li>
                )}
              </ul>
            )}

            {/* Short-Answer Free-Response Comparison */}
            {r.type === "short" && (
              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded-xl border border-[#2A2D26] bg-[#171915] p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#73776E]">Candidate Submission</p>
                  <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-[#F4F5F0]">
                    {r.answerText || <em className="text-[#73776E]">No response provided</em>}
                  </p>
                </div>
                <div className="rounded-xl border border-[#10B981]/30 bg-[#10B981]/10 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#34D399]">Expected Formulation</p>
                  <p className="mt-1.5 leading-relaxed text-[#A7F3D0]">{r.expectedAnswer}</p>
                </div>
                {(r.understood.length > 0 || r.missing.length > 0) && (
                  <div className="sm:col-span-2 space-y-1 text-xs">
                    {r.understood.length > 0 && (
                      <p className="text-[#34D399] font-medium">Conceptually covered: {r.understood.join("; ")}</p>
                    )}
                    {r.missing.length > 0 && (
                      <p className="text-[#FBBF24] font-medium">Missing elements: {r.missing.join("; ")}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Misconception Diagnostic */}
            {r.misconceptions.length > 0 && !r.isCorrect && (
              <div className="rounded-xl border border-[#3D3017] bg-[#19150B] p-3 text-xs text-[#FDE68A]">
                <strong className="text-[#E5A83B] uppercase tracking-wider text-[10px] block mb-1">
                  Diagnosed Misconception
                </strong>
                {r.misconceptions.join("; ")}
              </div>
            )}

            {/* Explanation & Rationale */}
            <div className="rounded-xl border border-[#2A2D26] bg-[#171915] p-3.5 text-xs text-[#F4F5F0]/90 leading-relaxed">
              <strong className="text-[#D5FF32] uppercase tracking-wider text-[10px] block mb-1">
                Diagnostic Explanation
              </strong>
              {r.explanation}
            </div>

            {/* Verifiable Passages Citations */}
            {r.citations.length > 0 && (
              <div className="border-t border-[#2A2D26]/60 pt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#73776E]">
                  Grounding Source Passages
                </p>
                <CitationList citations={r.citations} />
              </div>
            )}

            <p className="text-[10px] text-[#73776E]">{evaluatorLabel[r.evaluator]}</p>
          </div>
        </div>
      </Card>
    </li>
  );
}
