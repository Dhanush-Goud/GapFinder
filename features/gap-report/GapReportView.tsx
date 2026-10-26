"use client";
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, History, Lightbulb, ListChecks, Target, XCircle } from "lucide-react";
import { useState } from "react";
import type { EvaluatedAnswer, Topic, TopicMastery } from "@/types/domain";
import { CitationList, ImportanceBadge, LevelBadge, pct, SampleDataBadge } from "@/components/domain";
import { Alert, Card, EmptyState, LinkButton, PageHeader, ProgressBar } from "@/components/ui";
import { useAppState } from "@/features/app-state/AppStateProvider";
import { useDerived } from "@/features/app-state/useDerived";
import { DEFAULT_MASTERY_CONFIG } from "@/lib/diagnosis/config";
import { explainMastery, LEVEL_LABEL } from "@/lib/diagnosis/mastery";
import { descendantsOf } from "@/lib/rag/link";

export function GapReportView() {
  const d = useDerived();
  const { state } = useAppState();
  const cfg = DEFAULT_MASTERY_CONFIG;
  if (d.completedAttempts.length === 0) {
    return (
      <>
        <PageHeader title="Gap report" />
        <Card>
          <EmptyState icon={Target} title="No evidence yet" action={<LinkButton href="/quiz" icon={ListChecks}>Take a diagnostic quiz</LinkButton>}>
            The gap report is built only from your quiz answers. Take a diagnostic quiz to see which topics are weak and why.
          </EmptyState>
        </Card>
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="Gap report"
        description={`Each unit is labelled from your most recent ${cfg.recentWindow} answers on it: weak below ${cfg.weakBelow * 100}%, strong from ${cfg.strongAtOrAbove * 100}%, and no label until at least ${cfg.minEvidence} answers exist. These thresholds are starting heuristics, not validated cut-offs.`}
        actions={<LinkButton href="/revision-plan" icon={ArrowRight}>Revision plan</LinkButton>}
      />
      {d.hasSampleData && (
        <Alert tone="warning" className="mb-6">This report includes one example attempt from a fictional student (marked <strong>Example data</strong>). Your own quiz answers are counted alongside it.</Alert>
      )}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["weak", "medium", "strong", "insufficient"] as const).map((l) => (
          <Card key={l} className="px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{LEVEL_LABEL[l]}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{d.counts[l]}</p>
          </Card>
        ))}
      </div>
      <div className="space-y-4">
        {d.bySeverity.map((t) => (
          <TopicDiagnosis key={t.id} topic={t} mastery={d.mastery.get(t.id)!} defaultOpen={d.mastery.get(t.id)!.level === "weak"} />
        ))}
      </div>
      <p className="mt-6 text-xs text-slate-500">Based on {d.completedAttempts.length} completed quiz(zes) and {state.attempts.reduce((n, a) => n + (a.results?.length ?? 0), 0)} evaluated answers.</p>
    </>
  );
}

function nextAction(topic: Topic, m: TopicMastery): { text: string; href: string; cta: string } {
  const quiz = `/quiz?topic=${encodeURIComponent(topic.id)}`;
  switch (m.level) {
    case "weak":
      return { text: `Re-learn ${topic.name} from the cited sections below, then retest. This topic gets the most time in your plan.`, href: "/revision-plan", cta: "See plan" };
    case "medium":
      return { text: `Practise the specific mistakes listed below, then retest to move ${topic.name} into the strong range.`, href: quiz, cta: "Retest" };
    case "strong":
      return { text: `Keep it fresh with a short review; retest closer to the exam to confirm it holds.`, href: quiz, cta: "Retest" };
    default:
      return {
        text: m.windowAttempted === 0 ? `Not assessed yet. Take a short quiz on ${topic.name}.` : `Only ${m.windowAttempted} answer(s) so far — ${DEFAULT_MASTERY_CONFIG.minEvidence - m.windowAttempted} more needed before a label is assigned.`,
        href: quiz,
        cta: "Assess",
      };
  }
}

function TopicDiagnosis({ topic, mastery: m, defaultOpen }: { topic: Topic; mastery: TopicMastery; defaultOpen: boolean }) {
  const { state } = useAppState();
  const d = useDerived();
  const [open, setOpen] = useState(defaultOpen);
  const action = nextAction(topic, m);
  const scope = new Set([topic.id, ...descendantsOf(topic.id, state.topics)]);
  const evidenceResults: (EvaluatedAnswer & { sample: boolean })[] = m.evidence
    .map((e) => {
      const a = state.attempts.find((x) => x.id === e.attemptId);
      const r = a?.results?.find((x) => x.questionId === e.questionId);
      return r ? { ...r, sample: !!a?.isSample } : null;
    })
    .filter((r): r is EvaluatedAnswer & { sample: boolean } => !!r);
  const wrong = evidenceResults.filter((r) => !r.isCorrect);
  const history = state.masteryHistory.filter((s) => s.topicId === topic.id);
  const children = d.childrenOf(topic.id);
  const tone = m.level === "weak" ? "red" : m.level === "medium" ? "amber" : m.level === "strong" ? "green" : "slate";

  return (
    <Card as="article">
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">{topic.name}</h2>
              <LevelBadge level={m.level} />
              <ImportanceBadge importance={topic.importance} />
            </div>
            <p className="mt-1 text-sm text-slate-600">{explainMastery(m)}</p>
          </div>
          <div className="w-full max-w-[220px] text-right">
            <p className="text-2xl font-semibold text-slate-900">{pct(m.recentAccuracy)}</p>
            <ProgressBar value={m.recentAccuracy ?? 0} tone={tone} label={`${topic.name} recent accuracy`} />
            <p className="mt-1 text-xs text-slate-500">All-time {pct(m.accuracy)} · {m.correct} / {m.attempted} correct</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
          <p className="flex items-start gap-2 text-sm text-slate-700">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
            <span><strong>Next:</strong> {action.text}</span>
          </p>
          <LinkButton href={action.href} variant="secondary">{action.cta}</LinkButton>
        </div>
        {(evidenceResults.length > 0 || history.length > 0) && (
          <button onClick={() => setOpen(!open)} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline" aria-expanded={open}>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />} {open ? "Hide" : "Show"} evidence
          </button>
        )}
      </div>
      {open && (
        <div className="space-y-5 border-t border-slate-100 px-5 py-4">
          {m.misconceptions.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Common misconceptions</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
                {m.misconceptions.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </section>
          )}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Answers behind this rating</h3>
            <ul className="mt-2 space-y-1.5">
              {evidenceResults.map((r, i) => (
                <li key={`${r.questionId}-${i}`} className="flex items-start gap-2 text-sm text-slate-700">
                  {r.isCorrect ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Correct" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-label="Incorrect" />}
                  <span className="flex-1">{r.prompt}{r.type === "short" && ` (${Math.round(r.score * 100)}% credit)`}</span>
                  {r.sample && <SampleDataBadge />}
                </li>
              ))}
            </ul>
          </section>
          {wrong.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why the incorrect answers were wrong</h3>
              <ul className="mt-2 space-y-3">
                {wrong.map((r, i) => (
                  <li key={`${r.questionId}-${i}`} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-sm font-medium text-slate-900">{r.prompt}</p>
                    {r.type === "mcq" && r.options && (
                      <p className="mt-1 text-sm text-slate-600">
                        You chose <span className="text-red-700">{r.selectedOption !== null ? r.options[r.selectedOption] : "no answer"}</span>; correct: <span className="text-emerald-700">{r.correctOption !== null ? r.options[r.correctOption] : ""}</span>
                      </p>
                    )}
                    <p className="mt-1 text-sm text-slate-700">{r.explanation}</p>
                    <div className="mt-2"><CitationList citations={r.citations} compact /></div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {history.length > 0 && (
            <section>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><History className="h-3.5 w-3.5" /> Mastery history</h3>
              <ol className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                {history.map((s, i) => (
                  <li key={`${s.attemptId}-${i}`} className="flex items-center gap-2">
                    {i > 0 && <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-hidden />}
                    <span className="rounded-lg border border-slate-200 px-2.5 py-1">
                      <span className="text-xs text-slate-500">{new Date(s.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>{" "}
                      <span className="font-medium">{pct(s.accuracy)}</span> <LevelBadge level={s.level} />
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {children.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sub-topics</h3>
              <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[420px] text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr><th className="py-1 font-medium">Sub-topic</th><th className="py-1 font-medium">Answers</th><th className="py-1 font-medium">Accuracy</th><th className="py-1 font-medium">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {children.map((c) => {
                    const cm = d.mastery.get(c.id)!;
                    return (
                      <tr key={c.id}>
                        <td className="py-1.5 pr-2 text-slate-800">{c.code ? `${c.code} ` : ""}{c.name}</td>
                        <td className="py-1.5 text-slate-600">{cm.windowAttempted}</td>
                        <td className="py-1.5 text-slate-600">{pct(cm.recentAccuracy)}</td>
                        <td className="py-1.5"><LevelBadge level={cm.level} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
              {scope.size > 1 && <p className="mt-1 text-xs text-slate-500">Sub-topics usually have fewer answers, so many show “Not enough evidence” until you retest.</p>}
            </section>
          )}
        </div>
      )}
    </Card>
  );
}
