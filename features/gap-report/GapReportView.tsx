"use client";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Filter,
  History,
  Lightbulb,
  ListChecks,
  Sparkles,
  Target,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { EvaluatedAnswer, Topic, TopicMastery } from "@/types/domain";
import { CitationList, ImportanceBadge, LevelBadge, pct, SampleDataBadge } from "@/components/domain";
import { Alert, Badge, Button, Card, EmptyState, LinkButton, PageHeader, ProgressBar } from "@/components/ui";
import { useAppState } from "@/features/app-state/AppStateProvider";
import { useDerived } from "@/features/app-state/useDerived";
import { DEFAULT_MASTERY_CONFIG } from "@/lib/diagnosis/config";
import { explainMastery, LEVEL_LABEL } from "@/lib/diagnosis/mastery";
import { descendantsOf } from "@/lib/rag/link";

export function GapReportView() {
  const d = useDerived();
  const { state } = useAppState();
  const cfg = DEFAULT_MASTERY_CONFIG;
  const [filterLevel, setFilterLevel] = useState<string>("all");

  const filteredTopics = useMemo(() => {
    if (filterLevel === "all") return d.bySeverity;
    return d.bySeverity.filter((t) => d.mastery.get(t.id)?.level === filterLevel);
  }, [d.bySeverity, d.mastery, filterLevel]);

  if (d.completedAttempts.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Knowledge Gap Diagnosis" />
        <Card className="border-[#2A2D26] bg-[#10110F]">
          <EmptyState
            icon={Target}
            title="No diagnostic evidence collected yet"
            action={<LinkButton href="/quiz" icon={ListChecks}>Launch Initial Evaluation</LinkButton>}
          >
            The gap report is computed deterministically from evaluated quiz answers. Take a diagnostic evaluation to identify your weak units with grounding citations.
          </EmptyState>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Gap Diagnosis"
        description={`Syllabus units evaluated across rolling ${cfg.recentWindow}-question windows: Weak below ${cfg.weakBelow * 100}%, Strong at or above ${cfg.strongAtOrAbove * 100}%, requiring ${cfg.minEvidence} minimum responses for empirical classification.`}
        actions={
          <LinkButton href="/revision-plan" icon={ArrowRight} className="text-xs">
            Adaptive Revision Plan
          </LinkButton>
        }
      />

      {d.hasSampleData && (
        <Alert tone="warning">
          Telemetry includes sample baseline data from course initialization. Your real quiz answers are incorporated into the rolling diagnostic window.
        </Alert>
      )}

      {/* Summary Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["weak", "medium", "strong", "insufficient"] as const).map((l) => {
          const isSelected = filterLevel === l;
          return (
            <button
              key={l}
              onClick={() => setFilterLevel(filterLevel === l ? "all" : l)}
              className={`rounded-xl border p-4 text-left transition-all ${
                isSelected
                  ? "border-[#D5FF32] bg-[#171915] shadow-[0_0_12px_-2px_rgba(213,255,50,0.15)]"
                  : "border-[#2A2D26] bg-[#10110F] hover:border-[#3A3F33] hover:bg-[#171915]/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#73776E]">{LEVEL_LABEL[l]}</p>
                {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-[#D5FF32]" />}
              </div>
              <p
                className={`mt-1.5 text-2xl font-bold tabular-nums tracking-tight ${
                  l === "weak"
                    ? "text-[#EF4444]"
                    : l === "medium"
                    ? "text-[#E5A83B]"
                    : l === "strong"
                    ? "text-[#D5FF32]"
                    : "text-[#73776E]"
                }`}
              >
                {d.counts[l]}
              </p>
            </button>
          );
        })}
      </div>

      {/* Filter reset notice */}
      {filterLevel !== "all" && (
        <div className="flex items-center justify-between text-xs text-[#A0A39A] px-1">
          <span>Filtering by level: <strong className="text-[#F4F5F0] uppercase tracking-wider">{filterLevel}</strong> ({filteredTopics.length} units)</span>
          <button onClick={() => setFilterLevel("all")} className="text-xs text-[#D5FF32] hover:underline font-medium">
            Reset filter (show all)
          </button>
        </div>
      )}

      {/* Topic Diagnosis Breakdown */}
      <div className="space-y-4">
        {filteredTopics.map((t) => (
          <TopicDiagnosis
            key={t.id}
            topic={t}
            mastery={d.mastery.get(t.id)!}
            defaultOpen={d.mastery.get(t.id)!.level === "weak"}
          />
        ))}
      </div>

      <p className="text-center text-[11px] text-[#73776E] pt-2">
        Diagnosis computed from {d.completedAttempts.length} completed diagnostic evaluation(s) and{" "}
        {state.attempts.reduce((n, a) => n + (a.results?.length ?? 0), 0)} item validations.
      </p>
    </div>
  );
}

function nextAction(topic: Topic, m: TopicMastery): { text: string; href: string; cta: string } {
  const quiz = `/quiz?topic=${encodeURIComponent(topic.id)}`;
  switch (m.level) {
    case "weak":
      return {
        text: `Target ${topic.name} in your revision schedule. Review cited text passages before retesting.`,
        href: "/revision-plan",
        cta: "Allocate in Plan",
      };
    case "medium":
      return {
        text: `Address diagnosed misconceptions below, then launch an evaluation to push ${topic.name} to strong mastery.`,
        href: quiz,
        cta: "Retest Unit",
      };
    case "strong":
      return {
        text: `Retention verified. Schedule periodic retesting closer to exam date to confirm recall.`,
        href: quiz,
        cta: "Retest Unit",
      };
    default:
      return {
        text:
          m.windowAttempted === 0
            ? `Unit unassessed. Complete an initial diagnostic evaluation on ${topic.name}.`
            : `Collected ${m.windowAttempted} response(s) — ${DEFAULT_MASTERY_CONFIG.minEvidence - m.windowAttempted} additional answers needed for empirical classification.`,
        href: quiz,
        cta: "Assess Unit",
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
  const tone = m.level === "weak" ? "red" : m.level === "medium" ? "amber" : m.level === "strong" ? "brand" : "slate";

  return (
    <Card as="article" className="border-[#2A2D26] bg-[#10110F] overflow-hidden">
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-[#F4F5F0]">
                {topic.code ? `${topic.code}. ` : ""}
                {topic.name}
              </h2>
              <LevelBadge level={m.level} />
              <ImportanceBadge importance={topic.importance} />
            </div>
            <p className="mt-1 text-xs text-[#A0A39A] leading-relaxed">{explainMastery(m)}</p>
          </div>

          <div className="w-full sm:w-48 text-left sm:text-right shrink-0">
            <p className="text-2xl font-extrabold tabular-nums tracking-tight text-[#F4F5F0]">
              {pct(m.recentAccuracy)}
            </p>
            <div className="my-1">
              <ProgressBar
                value={m.recentAccuracy ?? 0}
                tone={m.level === "weak" ? "red" : m.level === "medium" ? "amber" : "brand"}
                label={`${topic.name} accuracy`}
              />
            </div>
            <p className="text-[10px] text-[#73776E]">
              All-time {pct(m.accuracy)} ({m.correct}/{m.attempted} correct)
            </p>
          </div>
        </div>

        {/* Action Callout */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#2A2D26] bg-[#171915] p-3.5">
          <p className="flex items-start gap-2.5 text-xs text-[#F4F5F0]/90">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#D5FF32]" aria-hidden />
            <span>
              <strong className="text-[#D5FF32] uppercase tracking-wider text-[10px] mr-1">Recommended:</strong>
              {action.text}
            </span>
          </p>
          <LinkButton href={action.href} variant="secondary" className="text-xs shrink-0 py-1.5 px-3">
            {action.cta}
          </LinkButton>
        </div>

        {(evidenceResults.length > 0 || history.length > 0) && (
          <button
            onClick={() => setOpen(!open)}
            className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#D5FF32] hover:underline"
            aria-expanded={open}
          >
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {open ? "Collapse Diagnostic Evidence" : `Expand Diagnostic Evidence (${evidenceResults.length} answers)`}
          </button>
        )}
      </div>

      {open && (
        <div className="space-y-5 border-t border-[#2A2D26] bg-[#171915]/40 px-5 py-4 text-xs">
          {/* Common Misconceptions */}
          {m.misconceptions.length > 0 && (
            <div className="rounded-xl border border-[#3D3017] bg-[#19150B] p-4 text-[#FDE68A]">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#E5A83B] mb-1.5">
                Diagnosed Conceptual Misconceptions
              </h3>
              <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed">
                {m.misconceptions.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Answers Breakdown */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#73776E] mb-2">
              Recent Empirical Answers ({evidenceResults.length})
            </h3>
            <ul className="space-y-2">
              {evidenceResults.map((r, i) => (
                <li
                  key={`${r.questionId}-${i}`}
                  className="flex items-start gap-2.5 rounded-lg border border-[#2A2D26] bg-[#10110F] p-2.5 text-xs text-[#F4F5F0]"
                >
                  {r.isCorrect ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#34D399]" aria-label="Correct" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#F87171]" aria-label="Incorrect" />
                  )}
                  <span className="flex-1 leading-relaxed">
                    {r.prompt}
                    {r.type === "short" && ` (${Math.round(r.score * 100)}% credit)`}
                  </span>
                  {r.sample && <SampleDataBadge />}
                </li>
              ))}
            </ul>
          </section>

          {/* Detailed Error Analysis */}
          {wrong.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#73776E] mb-2">
                Incorrect Item Rationale
              </h3>
              <ul className="space-y-3">
                {wrong.map((r, i) => (
                  <li key={`${r.questionId}-${i}`} className="rounded-xl border border-[#2A2D26] bg-[#10110F] p-3.5 space-y-2">
                    <p className="font-semibold text-xs text-[#F4F5F0]">{r.prompt}</p>
                    {r.type === "mcq" && r.options && (
                      <p className="text-xs text-[#A0A39A]">
                        Candidate selection:{" "}
                        <span className="text-[#F87171] font-semibold">
                          {r.selectedOption !== null ? r.options[r.selectedOption] : "none"}
                        </span>
                        {" · "}
                        Ground truth:{" "}
                        <span className="text-[#34D399] font-semibold">
                          {r.correctOption !== null ? r.options[r.correctOption] : ""}
                        </span>
                      </p>
                    )}
                    <p className="text-xs text-[#A0A39A] leading-relaxed border-l-2 border-[#2A2D26] pl-2.5">
                      {r.explanation}
                    </p>
                    {r.citations.length > 0 && (
                      <div className="pt-1">
                        <CitationList citations={r.citations} compact />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Mastery Progression History */}
          {history.length > 0 && (
            <section>
              <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#73776E] mb-2">
                <History className="h-3 w-3" /> Historical Progression Snapshots
              </h3>
              <ol className="flex flex-wrap items-center gap-2">
                {history.map((s, i) => (
                  <li key={`${s.attemptId}-${i}`} className="flex items-center gap-2">
                    {i > 0 && <ArrowRight className="h-3 w-3 text-[#73776E]" aria-hidden />}
                    <span className="rounded-lg border border-[#2A2D26] bg-[#10110F] px-2.5 py-1 text-xs">
                      <span className="text-[#73776E]">
                        {new Date(s.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>{" "}
                      <span className="font-bold tabular-nums text-[#F4F5F0]">{pct(s.accuracy)}</span>{" "}
                      <LevelBadge level={s.level} />
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Sub-Topics Table */}
          {children.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#73776E] mb-2">
                Constituent Sub-Topic Breakdowns ({children.length})
              </h3>
              <div className="overflow-x-auto rounded-xl border border-[#2A2D26] bg-[#10110F]">
                <table className="w-full min-w-[420px] text-xs">
                  <thead className="border-b border-[#2A2D26] bg-[#171915] text-left text-[10px] font-bold uppercase tracking-wider text-[#73776E]">
                    <tr>
                      <th className="py-2.5 px-3">Sub-Unit</th>
                      <th className="py-2.5 px-3">Answers</th>
                      <th className="py-2.5 px-3">Accuracy</th>
                      <th className="py-2.5 px-3">Classification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A2D26]">
                    {children.map((c) => {
                      const cm = d.mastery.get(c.id)!;
                      return (
                        <tr key={c.id} className="hover:bg-[#171915]/50 transition-colors">
                          <td className="py-2.5 px-3 text-[#F4F5F0] font-medium">
                            {c.code ? `${c.code} ` : ""}
                            {c.name}
                          </td>
                          <td className="py-2.5 px-3 tabular-nums text-[#A0A39A]">{cm.windowAttempted}</td>
                          <td className="py-2.5 px-3 tabular-nums font-semibold text-[#F4F5F0]">
                            {pct(cm.recentAccuracy)}
                          </td>
                          <td className="py-2.5 px-3">
                            <LevelBadge level={cm.level} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </Card>
  );
}
