"use client";
import { ArrowLeft, ArrowRight, CalendarCheck, History, ListChecks, Play, Send, Target } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Difficulty } from "@/types/domain";
import { DifficultyBadge, formatDateTime, LevelBadge, pct, SampleDataBadge } from "@/components/domain";
import { Alert, Button, Card, CardHeader, EmptyState, Field, LinkButton, PageHeader, ProgressBar, inputClass } from "@/components/ui";
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
      <>
        <PageHeader
          title="Quiz results"
          description="Every answer is explained and linked to the source passage it was generated from."
          actions={
            <>
              <Button variant="secondary" icon={ArrowLeft} onClick={() => router.push("/quiz")}>New quiz</Button>
              <LinkButton href="/gap-report" icon={Target}>View gap report</LinkButton>
            </>
          }
        />
        <PlanShiftNotice />
        <AttemptResults attempt={viewing} />
      </>
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
    if (preselect && d.assessable.some((t) => t.id === preselect)) setSelected([preselect]);
    else if (selected.length === 0 && d.bySeverity.length) setSelected(d.bySeverity.slice(0, 2).map((t) => t.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect]);

  const history = useMemo(() => [...d.completedAttempts].reverse(), [d.completedAttempts]);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      onStart(await startQuiz({ topicIds: selected, count, difficulty, includeShortAnswer: includeShort }));
    } catch (err) {
      setError(err instanceof ApiError && err.code === "insufficient_evidence" ? `Not enough evidence: ${err.message}` : err instanceof Error ? err.message : "Could not start the quiz.");
    } finally {
      setBusy(false);
    }
  }

  if (d.assessable.length === 0) {
    return (
      <>
        <PageHeader title="Diagnostic quiz" />
        <Card>
          <EmptyState icon={ListChecks} title="No topics to assess yet" action={<LinkButton href="/materials">Go to materials</LinkButton>}>
            {config.mode === "live" ? "Upload a syllabus and notes (or load the sample course) so questions can be generated from your material." : "Reset the demo workspace in Settings to restore the sample course."}
          </EmptyState>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Diagnostic quiz" description="Pick the units to test. Questions come from your material and every answer is checked against a stored key — the correct answers are never sent to your browser before you submit." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader icon={Target} title="1. Choose topics" description="Weakest units are listed first" action={<Button variant="ghost" onClick={() => setSelected(selected.length === d.assessable.length ? [] : d.assessable.map((t) => t.id))}>{selected.length === d.assessable.length ? "Clear" : "Select all"}</Button>} />
          <fieldset className="grid gap-2 p-4 sm:grid-cols-2">
            <legend className="sr-only">Topics</legend>
            {d.bySeverity.map((t) => {
              const m = d.mastery.get(t.id)!;
              const checked = selected.includes(t.id);
              return (
                <label key={t.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${checked ? "border-brand-400 bg-brand-50" : "border-slate-200 hover:border-slate-300"}`}>
                  <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" checked={checked} onChange={(e) => setSelected(e.target.checked ? [...selected, t.id] : selected.filter((x) => x !== t.id))} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">{t.name} <LevelBadge level={m.level} /></span>
                    <span className="mt-0.5 block text-xs text-slate-500">{m.windowAttempted ? `${pct(m.recentAccuracy)} on last ${m.windowAttempted} answers` : "Not assessed yet"}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        </Card>

        <Card>
          <CardHeader icon={ListChecks} title="2. Settings" />
          <div className="space-y-4 p-5">
            <Field label={`Number of questions: ${count}`} htmlFor="count" hint="3 or more per topic gives a reliable label.">
              <input id="count" type="range" min={3} max={15} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full accent-brand-600" />
            </Field>
            <Field label="Difficulty" htmlFor="difficulty">
              <select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty | "mixed")} className={inputClass}>
                <option value="mixed">Mixed</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={includeShort} onChange={(e) => setIncludeShort(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
              Include short-answer questions
            </label>
            {error && <Alert tone="error">{error}</Alert>}
            <Button className="w-full" icon={Play} onClick={start} loading={busy} disabled={selected.length === 0}>
              {busy ? (config.mode === "live" && config.aiConfigured ? "Retrieving sources & generating…" : "Preparing…") : "Start quiz"}
            </Button>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader icon={History} title="Quiz history" />
        {history.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">No completed quizzes yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((a) => (
              <li key={a.id}>
                <Link href={`/quiz?attempt=${encodeURIComponent(a.id)}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-slate-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">{a.topicIds.map(d.topicName).join(", ")}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">{formatDateTime(a.completedAt ?? a.createdAt)} · {a.questions.length} questions · {a.difficulty} {a.isSample && <SampleDataBadge />}</span>
                  </span>
                  <span className="w-24"><ProgressBar value={a.score ?? 0} label="score" /></span>
                  <span className="w-12 text-right text-sm font-semibold text-slate-900">{pct(a.score)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {state.attempts.some((a) => a.status === "in_progress") && <p className="mt-3 text-xs text-slate-500">Unsubmitted quizzes are not counted towards mastery.</p>}
    </>
  );
}

function TakeQuiz({ session, onCancel, onDone }: { session: QuizSession; onCancel: () => void; onDone: (attemptId: string) => void }) {
  const { submitQuiz } = useAppState();
  const d = useDerived();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = session.questions[index];
  const answeredCount = session.questions.filter((x) => (x.type === "mcq" ? typeof answers[x.id]?.selectedOption === "number" : !!answers[x.id]?.text?.trim())).length;

  async function submit() {
    if (submitting) return; // prevents double submission
    const unanswered = session.questions.length - answeredCount;
    if (unanswered > 0 && !window.confirm(`${unanswered} question(s) are unanswered and will be marked incorrect. Submit anyway?`)) return;
    setSubmitting(true);
    setError(null);
    try {
      const attempt = await submitQuiz(session, session.questions.map((x) => ({ questionId: x.id, ...answers[x.id] })));
      onDone(attempt.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed. Your answers are still here — try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Button variant="ghost" icon={ArrowLeft} onClick={() => window.confirm("Leave this quiz? Your answers will be discarded.") && onCancel()}>Leave quiz</Button>
        <p className="text-sm text-slate-500">{answeredCount} of {session.questions.length} answered</p>
      </div>
      {session.notes.map((n) => (
        <Alert key={n} tone="info" className="mb-4">{n}</Alert>
      ))}
      <ProgressBar value={(index + 1) / session.questions.length} label="Quiz progress" />
      <Card className="mt-4 p-6">
        <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          Question {index + 1} of {session.questions.length} · {d.topicName(q.topicId)} <DifficultyBadge difficulty={q.difficulty} />
        </p>
        <h2 className="mt-2 text-lg font-medium leading-snug text-slate-900">{q.prompt}</h2>
        {q.type === "mcq" && q.options ? (
          <fieldset className="mt-5 space-y-2">
            <legend className="sr-only">Answer options</legend>
            {q.options.map((o, i) => {
              const checked = answers[q.id]?.selectedOption === i;
              return (
                <label key={i} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 text-sm transition-colors ${checked ? "border-brand-500 bg-brand-50 text-brand-900" : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"}`}>
                  <input type="radio" name={q.id} className="mt-0.5 h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-500" checked={checked} onChange={() => setAnswers({ ...answers, [q.id]: { selectedOption: i } })} />
                  <span><span className="mr-2 font-semibold text-slate-400">{String.fromCharCode(65 + i)}</span>{o}</span>
                </label>
              );
            })}
          </fieldset>
        ) : (
          <div className="mt-5">
            <label htmlFor={`a-${q.id}`} className="text-sm font-medium text-slate-700">Your answer</label>
            <textarea id={`a-${q.id}`} rows={5} maxLength={2000} value={answers[q.id]?.text ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: { text: e.target.value } })} className={`${inputClass} mt-1.5`} placeholder="Explain in a few sentences…" />
            <p className="mt-1 text-xs text-slate-500">Graded on whether you cover the key ideas from your notes, with partial credit.</p>
          </div>
        )}
      </Card>
      {error && <Alert tone="error" className="mt-4">{error}</Alert>}
      <div className="mt-4 flex items-center justify-between gap-3">
        <Button variant="secondary" icon={ArrowLeft} disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous</Button>
        {index < session.questions.length - 1 ? (
          <Button onClick={() => setIndex(index + 1)}>Next <ArrowRight className="h-4 w-4" /></Button>
        ) : (
          <Button icon={Send} onClick={submit} loading={submitting}>{submitting ? "Grading…" : "Submit answers"}</Button>
        )}
      </div>
      <nav className="mt-6 flex flex-wrap justify-center gap-1.5" aria-label="Jump to question">
        {session.questions.map((x, i) => {
          const done = x.type === "mcq" ? typeof answers[x.id]?.selectedOption === "number" : !!answers[x.id]?.text?.trim();
          return (
            <button key={x.id} onClick={() => setIndex(i)} aria-label={`Question ${i + 1}${done ? " (answered)" : ""}`} aria-current={i === index ? "step" : undefined}
              className={`h-8 w-8 rounded-md text-xs font-medium ${i === index ? "bg-brand-600 text-white" : done ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
              {i + 1}
            </button>
          );
        })}
      </nav>
      <p className="mt-6 text-center text-xs text-slate-400"><CalendarCheck className="mr-1 inline h-3.5 w-3.5" />Submitting updates your mastery and recalculates your revision plan.</p>
    </div>
  );
}
