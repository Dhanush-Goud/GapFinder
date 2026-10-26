"use client";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  LineChart as LineIcon,
  ListChecks,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import { FirstVsLatest, MasteryOverTime, ScoreTrend } from "@/components/charts";
import { formatMinutes, LevelBadge, pct } from "@/components/domain";
import { Card, CardHeader, EmptyState, LinkButton, PageHeader, Stat } from "@/components/ui";
import { useAppState } from "@/features/app-state/AppStateProvider";
import { useDerived } from "@/features/app-state/useDerived";

export function ProgressView() {
  const { state } = useAppState();
  const d = useDerived();

  const data = useMemo(() => {
    const attempts = d.completedAttempts;
    const trend = attempts.map((a, i) => ({
      label: `#${i + 1}${a.isSample ? "*" : ""}`,
      score: Math.round((a.score ?? 0) * 100),
    }));
    const unitIds = new Set(d.assessable.map((t) => t.id));

    // One row per attempt; each unit's value is its snapshot after that attempt (null if not assessed then).
    const masteryRows = attempts.map((a, i) => {
      const row: Record<string, string | number | null> = { label: `#${i + 1}` };
      for (const s of state.masteryHistory.filter((x) => x.attemptId === a.id && unitIds.has(x.topicId))) {
        row[s.topicId] = s.accuracy === null ? null : Math.round(s.accuracy * 100);
      }
      return row;
    });

    const series = d.assessable
      .filter((t) => state.masteryHistory.some((s) => s.topicId === t.id))
      .map((t) => ({ key: t.id, name: t.name }));

    const changes = d.assessable
      .map((t) => {
        const snaps = state.masteryHistory.filter((s) => s.topicId === t.id && s.accuracy !== null);
        if (snaps.length === 0) return null;
        return {
          topic: t,
          first: snaps[0].accuracy!,
          latest: snaps[snaps.length - 1].accuracy!,
          count: snaps.length,
          level: d.mastery.get(t.id)!.level,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);

    const allTasks = [...state.taskHistory, ...(state.plan?.tasks ?? [])];
    const doneTasks = allTasks.filter((t) => t.completed);

    return {
      trend,
      masteryRows,
      series,
      changes,
      improved: changes
        .filter((c) => c.count > 1 && c.latest > c.first)
        .sort((a, b) => b.latest - b.first - (a.latest - a.first)),
      attention: d.bySeverity.filter((t) => ["weak", "medium", "insufficient"].includes(d.mastery.get(t.id)!.level)),
      tasks: { done: doneTasks.length, total: allTasks.length, minutes: doneTasks.reduce((n, t) => n + t.minutes, 0) },
      delta: attempts.length >= 2 ? (attempts.at(-1)!.score ?? 0) - (attempts.at(-2)!.score ?? 0) : null,
    };
  }, [state, d]);

  if (d.completedAttempts.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Progress Telemetry" />
        <Card className="border-[#2A2D26] bg-[#10110F]">
          <EmptyState
            icon={TrendingUp}
            title="No longitudinal progress data recorded"
            action={<LinkButton href="/quiz" icon={ListChecks}>Take Initial Evaluation</LinkButton>}
          >
            Progress trajectories are compiled strictly from completed diagnostic evaluations, mastery snapshots, and finished revision tasks.
          </EmptyState>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Progress Telemetry"
        description="Empirical learning curves and unit improvement trajectories computed from stored diagnostic evaluations and verified mastery snapshots."
      />

      {/* Analytical Metric Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Evaluations Completed"
          value={d.completedAttempts.length}
          icon={ListChecks}
          tone="brand"
          hint="Diagnostic attempts stored"
        />
        <Stat
          label="Score Trajectory Delta"
          value={data.delta === null ? "—" : `${data.delta >= 0 ? "+" : ""}${Math.round(data.delta * 100)} pts`}
          icon={TrendingUp}
          tone={data.delta !== null && data.delta < 0 ? "red" : "green"}
          hint="Delta vs previous evaluation"
        />
        <Stat
          label="Revision Tasks Done"
          value={`${data.tasks.done} / ${data.tasks.total}`}
          icon={CheckCircle2}
          tone="green"
          hint="Completed study directives"
        />
        <Stat
          label="Total Study Time"
          value={formatMinutes(data.tasks.minutes)}
          icon={Target}
          tone="violet"
          hint="Recorded study investment"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Quiz Accuracy Over Time */}
        <Card className="border-[#2A2D26] bg-[#10110F]">
          <CardHeader
            icon={LineIcon}
            title="Diagnostic Accuracy Trajectory"
            description={d.hasSampleData ? "Chronological scores (* = sample course baseline)" : "Chronological score of each completed evaluation"}
          />
          <div className="p-4">
            <ScoreTrend data={data.trend} />
          </div>
        </Card>

        {/* Improvement by Unit Bar Chart */}
        <Card className="border-[#2A2D26] bg-[#10110F]">
          <CardHeader
            icon={BarChart3}
            title="Baseline vs Current Mastery"
            description="Comparison of initial diagnostic assessment vs latest measurement"
          />
          <div className="p-4">
            {data.changes.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#73776E]">
                Units will appear here once assessed in diagnostic quizzes.
              </div>
            ) : (
              <FirstVsLatest
                data={data.changes.map((c) => ({
                  name: c.topic.name.length > 18 ? `${c.topic.name.slice(0, 16)}…` : c.topic.name,
                  first: Math.round(c.first * 100),
                  latest: Math.round(c.latest * 100),
                }))}
              />
            )}
          </div>
        </Card>

        {/* Unit Mastery Over Time Multi-line */}
        <Card className="lg:col-span-2 border-[#2A2D26] bg-[#10110F]">
          <CardHeader
            icon={TrendingUp}
            title="Longitudinal Unit Mastery Curves"
            description="Rolling window accuracy per syllabus unit after each quiz in which it was evaluated"
          />
          <div className="p-4">
            {data.masteryRows.length < 2 ? (
              <div className="py-16 text-center text-xs text-[#73776E]">
                Complete multiple diagnostic attempts across syllabus units to render longitudinal trajectories.
              </div>
            ) : (
              <MasteryOverTime data={data.masteryRows} series={data.series} />
            )}
          </div>
        </Card>

        {/* Recently Improved Units */}
        <Card className="border-[#2A2D26] bg-[#10110F]">
          <CardHeader icon={ArrowUpRight} title="Demonstrated Improvements" />
          <ul className="divide-y divide-[#2A2D26]">
            {data.improved.length === 0 && (
              <li className="px-5 py-6 text-xs text-[#73776E] text-center">
                Retest previously weak units to record measured improvement deltas.
              </li>
            )}
            {data.improved.map((c) => (
              <li key={c.topic.id} className="flex items-center justify-between gap-3 px-5 py-3 text-xs hover:bg-[#171915]/50 transition-colors">
                <span className="font-semibold text-[#F4F5F0] truncate">{c.topic.name}</span>
                <span className="flex items-center gap-2 tabular-nums shrink-0">
                  <span className="text-[#73776E]">{pct(c.first)}</span>
                  <span className="text-[#73776E]">→</span>
                  <strong className="text-[#D5FF32] font-bold">{pct(c.latest)}</strong>
                  <LevelBadge level={c.level} />
                </span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Units Still Needing Attention */}
        <Card className="border-[#2A2D26] bg-[#10110F]">
          <CardHeader icon={ArrowDownRight} title="Units Requiring Remediation" />
          <ul className="divide-y divide-[#2A2D26]">
            {data.attention.length === 0 && (
              <li className="px-5 py-6 text-xs text-[#73776E] text-center">
                All assessed units meet or exceed target threshold.
              </li>
            )}
            {data.attention.map((t) => {
              const m = d.mastery.get(t.id)!;
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-xs hover:bg-[#171915]/50 transition-colors">
                  <span className="font-semibold text-[#F4F5F0] truncate">{t.name}</span>
                  <span className="flex items-center gap-2 shrink-0 tabular-nums">
                    <span className="font-semibold text-[#A0A39A]">{pct(m.recentAccuracy)}</span>
                    <LevelBadge level={m.level} />
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
