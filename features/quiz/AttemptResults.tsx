"use client";
import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import type { EvaluatedAnswer, QuizAttempt } from "@/types/domain";
import { CitationList, DifficultyBadge, formatDateTime, pct, SampleDataBadge } from "@/components/domain";
import { Badge, Card } from "@/components/ui";
import { useDerived } from "@/features/app-state/useDerived";

const evaluatorLabel: Record<EvaluatedAnswer["evaluator"], string> = {
  deterministic: "Graded against the answer key",
  "keyword-heuristic": "Graded by key-point rubric",
  llm: "Graded by AI evaluator",
};

export function AttemptResults({ attempt }: { attempt: QuizAttempt }) {
  const d = useDerived();
  const results = attempt.results ?? [];
  const correct = results.filter((r) => r.isCorrect).length;
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Score</p>
            <p className="text-3xl font-semibold text-slate-900">{pct(attempt.score)}</p>
          </div>
          <div className="text-sm text-slate-600">
            <p>{correct} of {results.length} answered correctly</p>
            <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(attempt.completedAt ?? attempt.createdAt)} · {attempt.topicIds.map(d.topicName).join(", ")}</p>
          </div>
          {attempt.isSample && <SampleDataBadge />}
        </div>
      </Card>
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
      <Card className="p-5">
        <div className="flex items-start gap-3">
          {r.isCorrect ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-label="Correct" /> : partial ? <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-label="Partly correct" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-label="Incorrect" />}
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                Q{index + 1} · {topicName} <DifficultyBadge difficulty={r.difficulty} />
                {r.type === "short" && <Badge tone="blue">Short answer · {Math.round(r.score * 100)}% credit</Badge>}
              </p>
              <p className="mt-1 font-medium text-slate-900">{r.prompt}</p>
            </div>

            {r.type === "mcq" && r.options && (
              <ul className="space-y-1.5">
                {r.options.map((o, i) => {
                  const isKey = i === r.correctOption;
                  const chosen = i === r.selectedOption;
                  return (
                    <li
                      key={i}
                      className={`rounded-lg border px-3 py-2 text-sm ${isKey ? "border-emerald-300 bg-emerald-50 text-emerald-900" : chosen ? "border-red-300 bg-red-50 text-red-900" : "border-slate-200 text-slate-600"}`}
                    >
                      {o}
                      {isKey && <span className="ml-2 text-xs font-medium">✓ correct answer</span>}
                      {chosen && !isKey && <span className="ml-2 text-xs font-medium">your answer</span>}
                    </li>
                  );
                })}
                {r.selectedOption === null && <li className="text-sm text-red-600">Not answered.</li>}
              </ul>
            )}

            {r.type === "short" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-medium text-slate-500">Your answer</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{r.answerText || <em className="text-slate-400">No answer</em>}</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs font-medium text-emerald-700">Expected answer</p>
                  <p className="mt-1 text-sm text-emerald-900">{r.expectedAnswer}</p>
                </div>
                {(r.understood.length > 0 || r.missing.length > 0) && (
                  <div className="text-sm sm:col-span-2">
                    {r.understood.length > 0 && <p className="text-emerald-700">Covered: {r.understood.join("; ")}</p>}
                    {r.missing.length > 0 && <p className="text-amber-700">Missing: {r.missing.join("; ")}</p>}
                  </div>
                )}
              </div>
            )}

            {r.misconceptions.length > 0 && !r.isCorrect && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <strong>Likely misconception:</strong> {r.misconceptions.join("; ")}
              </p>
            )}
            <p className="text-sm leading-relaxed text-slate-700"><strong className="text-slate-900">Why:</strong> {r.explanation}</p>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Source</p>
              <CitationList citations={r.citations} />
            </div>
            <p className="text-xs text-slate-400">{evaluatorLabel[r.evaluator]}</p>
          </div>
        </div>
      </Card>
    </li>
  );
}
