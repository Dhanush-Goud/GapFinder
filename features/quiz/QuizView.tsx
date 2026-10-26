"use client";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock,
  History,
  ListChecks,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Target,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Difficulty } from "@/types/domain";
import { DifficultyBadge, formatDateTime, LevelBadge, pct, SampleDataBadge } from "@/components/domain";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Field, LinkButton, PageHeader, ProgressBar, inputClass } from "@/components/ui";
import { ApiError, useAppState, type QuizSession } from "@/features/app-state/AppStateProvider";
import { useDerived } from "@/features/app-state/useDerived";
import { AttemptResults } from "./AttemptResults";
import { PlanShiftNotice } from "@/features/revision/PlanShiftNotice";

type Answers = Record<string, { selectedOption?: number | null; text?: string | null }>;

export function QuizView() {
  const params = useSearchParams();
  const router = useRouter();
  const { state } = useAppState();
  const attemptId = params.get("attempt");
  const viewing = attemptId ? state.attempts.find((a) => a.id === attemptId) : undefined;
  const [session, setSession] = useState<QuizSession | null>(null);

  if (viewing?.status === "completed") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Diagnostic Evaluation Results"
          description="Every response is evaluated against grounded passages. Review misconceptions, explanation rationale, and verifiable source citations below."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" icon={ArrowLeft} onClick={() => router.push("/quiz")} className="text-xs">
                New Quiz Setup
              </Button>
              <LinkButton href="/gap-report" icon={Target} className="text-xs">
                View Gap Report
              </LinkButton>
            </div>
          }
        />
        <PlanShiftNotice />
        <AttemptResults attempt={viewing} />
      </div>
    );
  }

  if (session) {
    return (
      <TakeQuiz
        session={session}
        onCancel={() => setSession(null)}
        onDone={(id) => {
          setSession(null);
          router.push(`/quiz?attempt=${encodeURIComponent(id)}`);
        }}
      />
    );
  }

  return <QuizSetup preselect={params.get("topic")} onStart={setSession} />;
}

function QuizSetup({ preselect, onStart }: { preselect: string | null; onStart: (s: QuizSession) => void }) {
  const { state, config, startQuiz } = useAppState();
  const d = useDerived();
  const [selected, setSelected] = useState<string[]>([]);
  const [count, setCount] = useState(6);
  const [difficulty, setDifficulty] = useState<Difficulty | "mixed">("mixed");
  const [includeShort, setIncludeShort] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preselect && d.assessable.some((t) => t.id === preselect)) {
      setSelected([preselect]);
    } else if (selected.length === 0 && d.bySeverity.length) {
      setSelected(d.bySeverity.slice(0, 2).map((t) => t.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect]);

  const history = useMemo(() => [...d.completedAttempts].reverse(), [d.completedAttempts]);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      onStart(await startQuiz({ topicIds: selected, count, difficulty, includeShortAnswer: includeShort }));
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "insufficient_evidence"
          ? `Insufficient grounding material: ${err.message}`
          : err instanceof Error
          ? err.message
          : "Could not initialize quiz session."
      );
    } finally {
      setBusy(false);
    }
  }

  if (d.assessable.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Diagnostic Quiz" />
        <Card className="border-[#2A2D26] bg-[#10110F]">
          <EmptyState
            icon={ListChecks}
            title="No topics ready for diagnostic evaluation"
            action={<LinkButton href="/materials">Go to Materials</LinkButton>}
          >
            {config.mode === "live"
              ? "Ingest a syllabus and lecture notes (or load sample course data) to generate authentic grounded questions."
              : "Reset the demo workspace in Settings to restore the baseline sample course."}
          </EmptyState>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Diagnostic Quiz"
        description="Select syllabus units for targeted knowledge evaluation. Questions are grounded strictly in your course passages; answer keys remain securely isolated on the server until submission."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Step 1: Select Topics */}
        <Card className="lg:col-span-2 border-[#2A2D26] bg-[#10110F]">
          <CardHeader
            icon={Target}
            title="1. Select Syllabus Units"
            description="Units ranked by diagnostic urgency (weakest units listed first)"
            action={
              <Button
                variant="ghost"
                onClick={() => setSelected(selected.length === d.assessable.length ? [] : d.assessable.map((t) => t.id))}
                className="text-xs"
              >
                {selected.length === d.assessable.length ? "Clear Selection" : "Select All Units"}
              </Button>
            }
          />
          <fieldset className="grid gap-2.5 p-5 sm:grid-cols-2">
            <legend className="sr-only">Topics to assess</legend>
            {d.bySeverity.map((t) => {
              const m = d.mastery.get(t.id)!;
              const checked = selected.includes(t.id);
              return (
                <label
                  key={t.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all duration-150 ${
                    checked
                      ? "border-[#D5FF32] bg-[#171915] shadow-[0_0_12px_-2px_rgba(213,255,50,0.15)]"
                      : "border-[#2A2D26] bg-[#10110F] hover:border-[#3A3F33] hover:bg-[#171915]/60"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-[#2A2D26] bg-[#10110F] text-[#D5FF32] focus:ring-[#D5FF32] focus:ring-offset-[#10110F]"
                    checked={checked}
                    onChange={(e) =>
                      setSelected(e.target.checked ? [...selected, t.id] : selected.filter((x) => x !== t.id))
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[#F4F5F0]">
                      {t.name} <LevelBadge level={m.level} />
                    </span>
                    <span className="mt-1 block text-[11px] text-[#73776E]">
                      {m.windowAttempted
                        ? `${pct(m.recentAccuracy)} on last ${m.windowAttempted} Qs`
                        : "No diagnostic answers yet"}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        </Card>

        {/* Step 2: Evaluation Settings */}
        <Card className="border-[#2A2D26] bg-[#10110F]">
          <CardHeader icon={ListChecks} title="2. Evaluation Parameters" />
          <div className="space-y-4 p-5 text-xs">
            <Field
              label={`Question Quota: ${count} questions`}
              htmlFor="count"
              hint="3+ questions per unit provides statistically reliable mastery diagnosis."
            >
              <input
                id="count"
                type="range"
                min={3}
                max={15}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full accent-[#D5FF32] cursor-pointer"
              />
            </Field>

            <Field label="Cognitive Difficulty" htmlFor="difficulty">
              <select
                id="difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty | "mixed")}
                className={inputClass}
              >
                <option value="mixed">Mixed Complexity</option>
                <option value="easy">Foundational (Easy)</option>
                <option value="medium">Intermediate (Medium)</option>
                <option value="hard">Advanced (Hard)</option>
              </select>
            </Field>

            <label className="flex items-center gap-2.5 text-xs text-[#A0A39A] cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={includeShort}
                onChange={(e) => setIncludeShort(e.target.checked)}
                className="h-4 w-4 rounded border-[#2A2D26] bg-[#10110F] text-[#D5FF32] focus:ring-[#D5FF32] focus:ring-offset-[#10110F]"
              />
              Include conceptual short-answer items
            </label>

            {error && <Alert tone="error">{error}</Alert>}

            <Button
              className="w-full text-xs uppercase tracking-wider font-bold py-2.5"
              icon={Play}
              onClick={start}
              loading={busy}
              disabled={selected.length === 0}
            >
              {busy
                ? config.mode === "live" && config.aiConfigured
                  ? "Grounding & Synthesizing…"
                  : "Compiling Questions…"
                : `Launch Evaluation (${selected.length} units)`}
            </Button>
          </div>
        </Card>
      </div>

      {/* History */}
      <Card className="border-[#2A2D26] bg-[#10110F]">
        <CardHeader icon={History} title="Diagnostic Attempt History" />
        {history.length === 0 ? (
          <p className="px-5 py-6 text-xs text-[#A0A39A] text-center">No completed diagnostic attempts recorded.</p>
        ) : (
          <ul className="divide-y divide-[#2A2D26]">
            {history.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/quiz?attempt=${encodeURIComponent(a.id)}`}
                  className="flex flex-wrap items-center gap-4 px-5 py-3.5 hover:bg-[#171915] transition-colors"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-[#F4F5F0]">
                      {a.topicIds.map(d.topicName).join(", ") || "General Assessment"}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-[#73776E]">
                      <span>{formatDateTime(a.completedAt ?? a.createdAt)}</span>
                      <span>·</span>
                      <span>{a.questions.length} questions</span>
                      <span>·</span>
                      <span className="capitalize">{a.difficulty}</span>
                      {a.isSample && <SampleDataBadge />}
                    </span>
                  </span>
                  <span className="w-24 shrink-0">
                    <ProgressBar value={a.score ?? 0} label="Diagnostic score" />
                  </span>
                  <span className="w-12 text-right text-xs font-bold tabular-nums text-[#D5FF32]">
                    {pct(a.score)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {state.attempts.some((a) => a.status === "in_progress") && (
        <p className="text-xs text-[#73776E] text-center">
          Incomplete attempts are excluded from mastery analytics until submitted.
        </p>
      )}
    </div>
  );
}

function TakeQuiz({
  session,
  onCancel,
  onDone,
}: {
  session: QuizSession;
  onCancel: () => void;
  onDone: (attemptId: string) => void;
}) {
  const { submitQuiz } = useAppState();
  const d = useDerived();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = session.questions[index];
  const answeredCount = session.questions.filter((x) =>
    x.type === "mcq" ? typeof answers[x.id]?.selectedOption === "number" : !!answers[x.id]?.text?.trim()
  ).length;

  async function submit() {
    if (submitting) return;
    const unanswered = session.questions.length - answeredCount;
    if (
      unanswered > 0 &&
      !window.confirm(`${unanswered} question(s) are unanswered and will receive zero credit. Submit anyway?`)
    )
      return;
    setSubmitting(true);
    setError(null);
    try {
      const attempt = await submitQuiz(
        session,
        session.questions.map((x) => ({ questionId: x.id, ...answers[x.id] }))
      );
      onDone(attempt.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed. Answers are preserved; try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          icon={ArrowLeft}
          onClick={() => window.confirm("Abandon current diagnostic evaluation? Responses will be discarded.") && onCancel()}
          className="text-xs text-[#A0A39A]"
        >
          Abort Quiz
        </Button>
        <span className="text-xs font-semibold tabular-nums text-[#D5FF32]">
          {answeredCount} of {session.questions.length} answered
        </span>
      </div>

      {session.notes.map((n) => (
        <Alert key={n} tone="info">
          {n}
        </Alert>
      ))}

      <ProgressBar value={(index + 1) / session.questions.length} label="Quiz progress" />

      {/* Active Question Card */}
      <Card className="p-6 border-[#2A2D26] bg-[#10110F]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2A2D26] pb-3 text-xs text-[#73776E]">
          <span className="font-semibold text-[#F4F5F0]">
            Item {index + 1} of {session.questions.length} · {d.topicName(q.topicId)}
          </span>
          <DifficultyBadge difficulty={q.difficulty} />
        </div>

        <h2 className="mt-4 text-base sm:text-lg font-semibold leading-snug text-[#F4F5F0]">{q.prompt}</h2>

        {q.type === "mcq" && q.options ? (
          <fieldset className="mt-6 space-y-2.5">
            <legend className="sr-only">Answer options</legend>
            {q.options.map((o, i) => {
              const checked = answers[q.id]?.selectedOption === i;
              return (
                <label
                  key={i}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-xs sm:text-sm transition-all duration-150 ${
                    checked
                      ? "border-[#D5FF32] bg-[#171915] text-[#F4F5F0] shadow-[0_0_12px_-2px_rgba(213,255,50,0.15)]"
                      : "border-[#2A2D26] bg-[#10110F] text-[#A0A39A] hover:border-[#3A3F33] hover:bg-[#171915]/60 hover:text-[#F4F5F0]"
                  }`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    className="mt-0.5 h-4 w-4 border-[#2A2D26] bg-[#10110F] text-[#D5FF32] focus:ring-[#D5FF32] focus:ring-offset-[#10110F]"
                    checked={checked}
                    onChange={() => setAnswers({ ...answers, [q.id]: { selectedOption: i } })}
                  />
                  <span>
                    <strong className={`mr-2.5 font-bold ${checked ? "text-[#D5FF32]" : "text-[#73776E]"}`}>
                      {String.fromCharCode(65 + i)}.
                    </strong>
                    {o}
                  </span>
                </label>
              );
            })}
          </fieldset>
        ) : (
          <div className="mt-6 space-y-2">
            <label htmlFor={`a-${q.id}`} className="text-xs font-semibold uppercase tracking-wider text-[#A0A39A]">
              Free-response formulation:
            </label>
            <textarea
              id={`a-${q.id}`}
              rows={5}
              maxLength={2000}
              value={answers[q.id]?.text ?? ""}
              onChange={(e) => setAnswers({ ...answers, [q.id]: { text: e.target.value } })}
              className={`${inputClass} font-sans leading-relaxed text-xs`}
              placeholder="State your technical answer referencing course principles…"
            />
            <p className="text-[11px] text-[#73776E]">
              Graded analytically against core key concepts extracted from your syllabus notes.
            </p>
          </div>
        )}
      </Card>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          variant="secondary"
          icon={ArrowLeft}
          disabled={index === 0}
          onClick={() => setIndex(index - 1)}
          className="text-xs"
        >
          Previous
        </Button>
        {index < session.questions.length - 1 ? (
          <Button onClick={() => setIndex(index + 1)} className="text-xs font-bold uppercase tracking-wider">
            Next Item <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            icon={Send}
            onClick={submit}
            loading={submitting}
            className="text-xs font-bold uppercase tracking-wider bg-[#D5FF32] text-[#080908]"
          >
            {submitting ? "Evaluating Telemetry…" : "Submit Diagnostic Answers"}
          </Button>
        )}
      </div>

      {/* Jump Navigator */}
      <nav className="flex flex-wrap justify-center gap-1.5 pt-4" aria-label="Question selector">
        {session.questions.map((x, i) => {
          const done =
            x.type === "mcq" ? typeof answers[x.id]?.selectedOption === "number" : !!answers[x.id]?.text?.trim();
          return (
            <button
              key={x.id}
              onClick={() => setIndex(i)}
              aria-label={`Question ${i + 1}${done ? " (answered)" : ""}`}
              aria-current={i === index ? "step" : undefined}
              className={`h-8 w-8 rounded-lg text-xs font-bold transition-all duration-150 tabular-nums ${
                i === index
                  ? "bg-[#D5FF32] text-[#080908] ring-2 ring-[#D5FF32]/50"
                  : done
                  ? "border border-[#D5FF32]/40 bg-[#171915] text-[#D5FF32]"
                  : "border border-[#2A2D26] bg-[#10110F] text-[#73776E] hover:border-[#3A3F33] hover:text-[#F4F5F0]"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </nav>

      <p className="text-center text-[11px] text-[#73776E] pt-2">
        <CalendarCheck className="mr-1 inline h-3 w-3 text-[#D5FF32]" />
        Submitting evaluates your responses, updates mastery coefficients, and adapts your revision plan.
      </p>
    </div>
  );
}
