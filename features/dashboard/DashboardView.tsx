"use client";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
  Gauge,
  Layers,
  ListChecks,
  Network,
  RotateCw,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ActivityHeatmap, ScoreTrend } from "@/components/charts";
import { formatBytes, formatDateTime, formatMinutes, LevelBadge, pct, SampleDataBadge, TaskKindBadge } from "@/components/domain";
import { Alert, Badge, Button, Card, CardHeader, CircularProgress, EmptyState, LinkButton, ProgressBar, Stat } from "@/components/ui";
import { useAppState } from "@/features/app-state/AppStateProvider";
import { useDerived } from "@/features/app-state/useDerived";
import { explainMastery } from "@/lib/diagnosis/mastery";
import { addDays, formatDay, localToday } from "@/lib/revision/dates";

export function DashboardView() {
  const { state, config, toggleTask } = useAppState();
  const d = useDerived();
  const [taskError, setTaskError] = useState<string | null>(null);
  const today = localToday();

  // Compute dated activity events for the heatmap from actual data
  const activityEvents = useMemo(() => {
    const dates: Record<string, number> = {};
    const addDate = (dStr?: string | null) => {
      if (!dStr) return;
      const key = dStr.slice(0, 10);
      dates[key] = (dates[key] ?? 0) + 1;
    };

    // Quiz attempts
    for (const a of state.attempts) {
      if (a.completedAt) addDate(a.completedAt);
      else if (a.createdAt) addDate(a.createdAt);
    }
    // Completed plan tasks
    for (const t of state.plan?.tasks ?? []) {
      if (t.completed) addDate(t.day);
    }
    for (const th of state.taskHistory) {
      if (th.completed) addDate(th.day);
    }
    // Uploaded documents
    for (const doc of state.documents) {
      addDate(doc.uploadedAt);
    }

    return Object.entries(dates).map(([date, count]) => ({ date, count }));
  }, [state.attempts, state.plan, state.taskHistory, state.documents]);

  // Knowledge Coverage metrics derived from syllabus topics & supporting notes
  const coverageMetrics = useMemo(() => {
    const syllabusIds = new Set(state.documents.filter((x) => x.kind === "syllabus").map((x) => x.id));
    const nonSyllabusChunks = state.chunks.filter((c) => !syllabusIds.has(c.documentId));

    let fullyCovered = 0;
    let partiallyCovered = 0;
    let uncovered = 0;
    let assessedCount = 0;

    for (const t of d.topLevel) {
      const m = d.mastery.get(t.id);
      if (m && m.windowAttempted > 0) assessedCount++;

      const supportCount = nonSyllabusChunks.filter((c) => c.topicIds.includes(t.id)).length;
      if (supportCount >= 2 || (m && m.level === "strong")) {
        fullyCovered++;
      } else if (supportCount === 1 || (m && m.level === "medium")) {
        partiallyCovered++;
      } else {
        uncovered++;
      }
    }

    const totalTopics = d.topLevel.length;
    return {
      totalTopics,
      fullyCovered,
      partiallyCovered,
      uncovered,
      assessedCount,
      coveragePct: totalTopics ? Math.round(((fullyCovered + partiallyCovered * 0.5) / totalTopics) * 100) : 0,
      assessedPct: totalTopics ? Math.round((assessedCount / totalTopics) * 100) : 0,
    };
  }, [state.documents, state.chunks, d.topLevel, d.mastery]);

  if (state.documents.length === 0) {
    return (
      <div className="space-y-6">
        <Header state={state} d={d} />
        {/* Onboarding Lime Highlight Panel */}
        <div className="rounded-xl border border-[#D5FF32]/60 bg-[#D5FF32] p-6 text-[#080908] shadow-[0_0_24px_-4px_rgba(213,255,50,0.35)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#080908] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#D5FF32]">
                <Sparkles className="h-3 w-3" /> Initial Setup Required
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-[#080908]">
                Initialize Your Learning Intelligence Workspace
              </h2>
              <p className="text-xs sm:text-sm font-medium text-[#171915]/90 leading-relaxed">
                GapFinder builds your diagnostic knowledge model directly from your course syllabus and study notes. Upload your syllabus to generate an authentic topic tree without fabricated prerequisites.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <LinkButton
                href="/materials"
                variant="dark"
                className="px-5 py-2.5 text-xs uppercase tracking-wider"
                icon={Upload}
              >
                Import Study Material
              </LinkButton>
            </div>
          </div>
        </div>

        <Card>
          <EmptyState
            icon={Upload}
            title="Upload your study material to begin"
            action={<LinkButton href="/materials" icon={Upload}>Go to materials</LinkButton>}
          >
            Start with your syllabus — it defines the authentic topic map. Then add notes or textbook chapters so diagnostic questions can be grounded with verifiable citations.
            {config.mode === "live" && " Or load the sample Data Structures course from the Materials page."}
          </EmptyState>
        </Card>
      </div>
    );
  }

  const needsRevision = d.bySeverity.filter((t) => ["weak", "insufficient", "medium"].includes(d.mastery.get(t.id)!.level)).slice(0, 5);
  const primaryWeakTopic = needsRevision.find((t) => d.mastery.get(t.id)!.level === "weak") ?? needsRevision[0];
  const primaryWeakMastery = primaryWeakTopic ? d.mastery.get(primaryWeakTopic.id) : null;

  const pendingTasks = (state.plan?.tasks ?? []).filter((t) => !t.completed && t.day >= today).slice(0, 5);
  const weekEnd = addDays(today, 7);
  const plannedWeek = (state.plan?.tasks ?? []).filter((t) => t.day >= today && t.day < weekEnd).reduce((n, t) => n + t.minutes, 0);
  const completedMinutes = [...state.taskHistory, ...(state.plan?.tasks ?? [])].filter((t) => t.completed).reduce((n, t) => n + t.minutes, 0);
  const todayMinutes = (state.plan?.tasks ?? []).filter((t) => t.day === today).reduce((n, t) => n + t.minutes, 0);

  const recentAttempts = [...d.completedAttempts].reverse().slice(0, 4);
  const trend = d.completedAttempts.map((a, i) => ({
    label: `#${i + 1}`,
    score: Math.round((a.score ?? 0) * 100),
    sample: a.isSample,
  }));

  const docs = {
    ready: state.documents.filter((x) => x.status === "ready").length,
    failed: state.documents.filter((x) => x.status === "failed").length,
    processing: state.documents.filter((x) => x.status === "processing").length,
  };

  return (
    <div className="space-y-6">
      <Header state={state} d={d} />

      {/* Signature Lime Highlight Panel */}
      <div className="relative overflow-hidden rounded-xl border border-[#D5FF32]/70 bg-[#D5FF32] p-6 text-[#080908] shadow-[0_0_28px_-6px_rgba(213,255,50,0.3)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#080908] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#D5FF32]">
                <Compass className="h-3 w-3" /> Diagnostic Directive
              </span>
              {d.hasSampleData && (
                <span className="rounded-full bg-[#080908]/15 px-2 py-0.5 text-[10px] font-semibold text-[#080908]">
                  Includes Sample Baseline
                </span>
              )}
            </div>

            {primaryWeakTopic ? (
              <>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#080908]">
                  Focus on {primaryWeakTopic.name}
                </h2>
                <p className="text-xs sm:text-sm font-medium text-[#10110F]/90 leading-relaxed">
                  {primaryWeakMastery && primaryWeakMastery.level === "weak"
                    ? `Diagnosed weak at ${pct(primaryWeakMastery.recentAccuracy)} recent accuracy (${primaryWeakMastery.windowAttempted} question window). Immediate revision recommended before exam.`
                    : primaryWeakMastery && primaryWeakMastery.level === "insufficient"
                    ? `Unit has not yet been assessed with diagnostic questions. Complete an initial evaluation to identify gaps.`
                    : `Developing mastery at ${pct(primaryWeakMastery?.recentAccuracy)}. Review key misconceptions and retest.`}
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#080908]">
                  Knowledge Base Stable
                </h2>
                <p className="text-xs sm:text-sm font-medium text-[#10110F]/90 leading-relaxed">
                  All assessed syllabus units meet or exceed target threshold ({pct(d.overall)} overall accuracy). Run a comprehensive quiz to verify retention.
                </p>
              </>
            )}

            <div className="pt-2 flex flex-wrap items-center gap-3">
              {primaryWeakTopic ? (
                <>
                  <LinkButton
                    href={`/quiz?topic=${encodeURIComponent(primaryWeakTopic.id)}`}
                    variant="dark"
                    className="px-4 py-2 text-xs uppercase tracking-wider"
                    icon={ListChecks}
                  >
                    Quiz {primaryWeakTopic.name}
                  </LinkButton>
                  <LinkButton
                    href={`/tutor?topic=${encodeURIComponent(primaryWeakTopic.id)}`}
                    variant="dark-outline"
                    className="px-4 py-2 text-xs uppercase tracking-wider"
                  >
                    Explain Topic Concepts
                  </LinkButton>
                </>
              ) : (
                <LinkButton
                  href="/quiz"
                  variant="dark"
                  className="px-4 py-2 text-xs uppercase tracking-wider"
                  icon={ListChecks}
                >
                  Start Diagnostic Quiz
                </LinkButton>
              )}
            </div>
          </div>

          {/* Real data circular progress indicator in panel */}
          <div className="flex shrink-0 items-center justify-center gap-4 rounded-xl border border-[#080908]/15 bg-[#080908]/5 p-4">
            <CircularProgress
              value={d.overall !== null ? Math.round(d.overall * 100) : coverageMetrics.assessedPct}
              size={76}
              strokeWidth={7}
              tone="dark"
              label="Overall diagnostic score or syllabus coverage"
            >
              <div className="text-center">
                <span className="text-base font-extrabold text-[#080908]">
                  {d.overall !== null ? pct(d.overall) : `${coverageMetrics.assessedPct}%`}
                </span>
              </div>
            </CircularProgress>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#080908]/70">
                {d.overall !== null ? "Mastery Index" : "Syllabus Evaluated"}
              </p>
              <p className="text-xs font-semibold text-[#080908]">
                {d.overall !== null
                  ? `${d.counts.strong} strong / ${d.counts.weak} weak`
                  : `${coverageMetrics.assessedCount} of ${coverageMetrics.totalTopics} units`}
              </p>
              <p className="text-[10px] text-[#080908]/75 mt-0.5">
                {d.overall !== null ? "Rolling window score" : "Needs initial quiz"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Analytical Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Overall Mastery"
          value={pct(d.overall)}
          icon={Gauge}
          tone="brand"
          hint={d.overall === null ? "Take a quiz to compute index" : "Average accuracy across assessed units"}
        />
        <Stat
          label="Weak Topics"
          value={d.counts.weak}
          icon={AlertTriangle}
          tone="red"
          hint="Below 50% recent accuracy threshold"
        />
        <Stat
          label="Developing"
          value={d.counts.medium}
          icon={TrendingUp}
          tone="amber"
          hint="50–79% recent accuracy range"
        />
        <Stat
          label="Mastered / Unassessed"
          value={`${d.counts.strong} / ${d.counts.insufficient}`}
          icon={CheckCircle2}
          tone="green"
          hint={`${d.counts.strong} verified strong · ${d.counts.insufficient} unassessed`}
        />
      </div>

      {/* Main Analytical Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Card 1: Knowledge Coverage Breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader
            icon={Layers}
            title="Knowledge & Material Coverage"
            description="Comparison between syllabus scope, uploaded supporting notes, and assessed mastery"
            action={
              <LinkButton href="/topics" variant="ghost">
                Knowledge map <ArrowRight className="h-3.5 w-3.5" />
              </LinkButton>
            }
          />
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-[#2A2D26] bg-[#171915] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#73776E]">Fully Covered</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-[#D5FF32]">{coverageMetrics.fullyCovered}</p>
                <p className="text-[10px] text-[#A0A39A] mt-0.5">≥ 2 notes or strong</p>
              </div>
              <div className="rounded-lg border border-[#2A2D26] bg-[#171915] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#73776E]">Partially Covered</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-[#E5A83B]">{coverageMetrics.partiallyCovered}</p>
                <p className="text-[10px] text-[#A0A39A] mt-0.5">1 supporting note</p>
              </div>
              <div className="rounded-lg border border-[#2A2D26] bg-[#171915] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#73776E]">Uncovered</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-[#73776E]">{coverageMetrics.uncovered}</p>
                <p className="text-[10px] text-[#A0A39A] mt-0.5">No notes indexed yet</p>
              </div>
              <div className="rounded-lg border border-[#2A2D26] bg-[#171915] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#73776E]">Assessed Units</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-[#38BDF8]">{coverageMetrics.assessedCount}</p>
                <p className="text-[10px] text-[#A0A39A] mt-0.5">Tested via diagnostic</p>
              </div>
            </div>

            {/* Visual ratio bar */}
            <div>
              <div className="flex justify-between text-xs text-[#A0A39A] mb-1.5 font-medium">
                <span>Syllabus Material Coverage</span>
                <span className="tabular-nums text-[#F4F5F0] font-semibold">{coverageMetrics.coveragePct}% supported</span>
              </div>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-[#171915] border border-[#2A2D26]">
                <div
                  className="bg-[#D5FF32] transition-all"
                  style={{ width: `${coverageMetrics.totalTopics ? (coverageMetrics.fullyCovered / coverageMetrics.totalTopics) * 100 : 0}%` }}
                  title={`Fully covered: ${coverageMetrics.fullyCovered}`}
                />
                <div
                  className="bg-[#E5A83B] transition-all"
                  style={{ width: `${coverageMetrics.totalTopics ? (coverageMetrics.partiallyCovered / coverageMetrics.totalTopics) * 100 : 0}%` }}
                  title={`Partially covered: ${coverageMetrics.partiallyCovered}`}
                />
                <div
                  className="bg-[#2A2D26] transition-all"
                  style={{ width: `${coverageMetrics.totalTopics ? (coverageMetrics.uncovered / coverageMetrics.totalTopics) * 100 : 0}%` }}
                  title={`Uncovered: ${coverageMetrics.uncovered}`}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Card 2: Study Time & Plan Status */}
        <Card>
          <CardHeader icon={Clock} title="Revision Schedule" />
          <dl className="space-y-3 px-5 py-4 text-xs">
            <div className="flex items-center justify-between border-b border-[#2A2D26]/40 pb-2">
              <dt className="text-[#A0A39A]">Planned Today</dt>
              <dd className="font-bold tabular-nums text-[#F4F5F0]">{formatMinutes(todayMinutes)}</dd>
            </div>
            <div className="flex items-center justify-between border-b border-[#2A2D26]/40 pb-2">
              <dt className="text-[#A0A39A]">Next 7 Days</dt>
              <dd className="font-bold tabular-nums text-[#F4F5F0]">{formatMinutes(plannedWeek)}</dd>
            </div>
            <div className="flex items-center justify-between border-b border-[#2A2D26]/40 pb-2">
              <dt className="text-[#A0A39A]">Completed So Far</dt>
              <dd className="font-bold tabular-nums text-[#D5FF32]">{formatMinutes(completedMinutes)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[#A0A39A]">Target Exam Date</dt>
              <dd className="font-bold text-[#F4F5F0]">
                {state.settings ? formatDay(state.settings.examDate) : <span className="text-[#73776E]">Not configured</span>}
              </dd>
            </div>
          </dl>
          <div className="border-t border-[#2A2D26] px-5 py-3 bg-[#171915]/40">
            <LinkButton href="/revision-plan" variant="secondary" className="w-full text-xs" icon={CalendarCheck}>
              Adjust Study Allocation
            </LinkButton>
          </div>
        </Card>

        {/* Card 3: Priority Topics Needing Revision */}
        <Card className="lg:col-span-2">
          <CardHeader
            icon={Target}
            title="Priority Topics for Revision"
            description="Ranked by diagnostic gap severity and syllabus importance weightage"
            action={
              <LinkButton href="/gap-report" variant="ghost">
                Full Gap Report <ArrowRight className="h-3.5 w-3.5" />
              </LinkButton>
            }
          />
          <ul className="divide-y divide-[#2A2D26]">
            {needsRevision.length === 0 && (
              <li className="px-5 py-6 text-xs text-[#A0A39A] text-center">
                All assessed syllabus units meet target mastery. Retest periodically to protect retention.
              </li>
            )}
            {needsRevision.map((t) => {
              const m = d.mastery.get(t.id)!;
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5 hover:bg-[#171915]/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-xs text-[#F4F5F0] truncate">{t.name}</p>
                      <LevelBadge level={m.level} />
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#A0A39A] truncate">{explainMastery(m)}</p>
                  </div>
                  <div className="w-24 shrink-0">
                    <div className="flex justify-between text-[10px] text-[#73776E] mb-1">
                      <span>Accuracy</span>
                      <span className="font-semibold tabular-nums text-[#F4F5F0]">{pct(m.recentAccuracy)}</span>
                    </div>
                    <ProgressBar
                      value={m.recentAccuracy ?? 0}
                      tone={m.level === "weak" ? "red" : m.level === "medium" ? "amber" : "slate"}
                      label={`${t.name} accuracy`}
                    />
                  </div>
                  <LinkButton href={`/quiz?topic=${encodeURIComponent(t.id)}`} variant="secondary" className="text-xs shrink-0 py-1.5 px-3">
                    {m.level === "insufficient" ? "Assess" : "Retest"}
                  </LinkButton>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Card 4: Study Activity Heatmap */}
        <Card>
          <CardHeader icon={TrendingUp} title="Learning Activity Matrix" />
          <div className="p-5 space-y-4">
            <ActivityHeatmap events={activityEvents} weeks={12} />
            <div className="border-t border-[#2A2D26]/60 pt-3 text-[11px] text-[#A0A39A] flex items-center justify-between">
              <span>Total Recorded Events:</span>
              <span className="font-bold tabular-nums text-[#D5FF32]">
                {activityEvents.reduce((acc, curr) => acc + curr.count, 0)}
              </span>
            </div>
          </div>
        </Card>

        {/* Card 5: Diagnostic Quiz Performance Trend */}
        <Card className="lg:col-span-2">
          <CardHeader
            icon={TrendingUp}
            title="Diagnostic Performance Trajectory"
            description="Chronological score progression across completed quiz evaluations"
          />
          <div className="px-4 py-4">
            {trend.length < 2 ? (
              <div className="py-12 text-center">
                <p className="text-xs text-[#A0A39A]">
                  Complete at least two diagnostic attempts to render historical trend trajectory.
                </p>
                <LinkButton href="/quiz" variant="secondary" className="mt-3 text-xs" icon={ListChecks}>
                  Take First Evaluation
                </LinkButton>
              </div>
            ) : (
              <ScoreTrend data={trend} />
            )}
          </div>
        </Card>

        {/* Card 6: Recent Materials & Indexing Status */}
        <Card>
          <CardHeader
            icon={FileText}
            title="Study Materials"
            action={<LinkButton href="/materials" variant="ghost">Manage</LinkButton>}
          />
          <dl className="space-y-3 px-5 py-4 text-xs">
            <div className="flex justify-between border-b border-[#2A2D26]/40 pb-2">
              <dt className="text-[#A0A39A]">Ready & Indexed</dt>
              <dd className="font-bold tabular-nums text-[#D5FF32]">{docs.ready}</dd>
            </div>
            <div className="flex justify-between border-b border-[#2A2D26]/40 pb-2">
              <dt className="text-[#A0A39A]">Processing</dt>
              <dd className="font-bold tabular-nums text-[#F4F5F0]">{docs.processing}</dd>
            </div>
            <div className="flex justify-between border-b border-[#2A2D26]/40 pb-2">
              <dt className="text-[#A0A39A]">Failed</dt>
              <dd className={docs.failed ? "font-bold tabular-nums text-[#EF4444]" : "font-bold tabular-nums text-[#73776E]"}>
                {docs.failed}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#A0A39A]">Indexed Passages (Chunks)</dt>
              <dd className="font-bold tabular-nums text-[#F4F5F0]">{state.chunks.length}</dd>
            </div>
          </dl>
          <div className="border-t border-[#2A2D26] px-5 py-3 bg-[#171915]/40">
            <LinkButton href="/materials" variant="secondary" className="w-full text-xs" icon={Upload}>
              Upload Document
            </LinkButton>
          </div>
        </Card>

        {/* Card 7: Upcoming Revision Tasks */}
        <Card className="lg:col-span-2">
          <CardHeader
            icon={CalendarCheck}
            title="Immediate Revision Directives"
            action={
              <LinkButton href="/revision-plan" variant="ghost">
                View Full Agenda <ArrowRight className="h-3.5 w-3.5" />
              </LinkButton>
            }
          />
          {taskError && <Alert tone="error" className="mx-5 mt-3">{taskError}</Alert>}
          {!state.plan ? (
            <div className="p-6 text-center">
              <p className="text-xs text-[#A0A39A] mb-3">No adaptive schedule generated yet.</p>
              <LinkButton href="/revision-plan" icon={CalendarCheck}>
                Configure Revision Plan
              </LinkButton>
            </div>
          ) : pendingTasks.length === 0 ? (
            <p className="px-5 py-6 text-xs text-[#A0A39A] text-center">
              All scheduled tasks completed for today. Take a diagnostic retest to recalibrate.
            </p>
          ) : (
            <ul className="divide-y divide-[#2A2D26]">
              {pendingTasks.map((t) => (
                <li key={t.id} className="flex items-start gap-3 px-5 py-3 hover:bg-[#171915]/50 transition-colors">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-[#2A2D26] bg-[#10110F] text-[#D5FF32] focus:ring-[#D5FF32] focus:ring-offset-[#10110F]"
                    aria-label={`Mark “${t.objective}” complete`}
                    checked={t.completed}
                    onChange={(e) => toggleTask(t.id, e.target.checked).catch((err) => setTaskError(err.message))}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#F4F5F0]">{t.objective}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#A0A39A]">
                      <TaskKindBadge kind={t.kind} />
                      <span className="text-[#F4F5F0] font-medium">{d.topicName(t.topicId)}</span>
                      <span>·</span>
                      <span>{formatDay(t.day)}</span>
                      <span>·</span>
                      <span>{formatMinutes(t.minutes)}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Card 8: Recent Diagnostic Attempts */}
        <Card>
          <CardHeader icon={BookOpen} title="Evaluation History" />
          <ul className="divide-y divide-[#2A2D26]">
            {recentAttempts.length === 0 && (
              <li className="px-5 py-6 text-xs text-[#A0A39A] text-center">No completed evaluations.</li>
            )}
            {recentAttempts.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/quiz?attempt=${encodeURIComponent(a.id)}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-[#171915] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#F4F5F0]">
                      {a.topicIds.map(d.topicName).join(", ") || "General Evaluation"}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#73776E]">
                      <span>{formatDateTime(a.completedAt ?? a.createdAt)}</span>
                      <span>·</span>
                      <span>{a.questions.length} questions</span>
                      {a.isSample && <SampleDataBadge />}
                    </p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-[#D5FF32]">{pct(a.score)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Header({ state, d }: { state: any; d: any }) {
  const assessableCount = d.assessable.length;
  const docCount = state.documents.length;
  const weakCount = d.counts.weak;

  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#2A2D26]/70 pb-5">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-[#F4F5F0]">Learning Intelligence</h1>
          <span className="rounded-md border border-[#2A2D26] bg-[#171915] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#D5FF32]">
            Telemetry Active
          </span>
        </div>
        <p className="mt-1 text-xs text-[#A0A39A]">
          {docCount === 0
            ? "Connect study materials to initialize knowledge diagnosis"
            : `Tracking ${assessableCount} syllabus units across ${docCount} documents · ${
                weakCount > 0 ? `${weakCount} high-priority gap(s) diagnosed` : "All assessed units within tolerance"
              }`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <LinkButton href="/quiz" icon={ListChecks}>
          Launch Diagnostic Quiz
        </LinkButton>
      </div>
    </div>
  );
}
