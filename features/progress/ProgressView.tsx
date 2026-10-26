"use client";
import { ArrowDownRight, ArrowUpRight, BarChart3, CheckCircle2, LineChart as LineIcon, ListChecks, Target, TrendingUp } from "lucide-react";
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
    const trend = attempts.map((a, i) => ({ label: `#${i + 1}${a.isSample ? "*" : ""}`, score: Math.round((a.score ?? 0) * 100) }));
    const unitIds = new Set(d.assessable.map((t) => t.id));
    // One row per attempt; each unit's value is its snapshot after that attempt (null if not assessed then).
    const masteryRows = attempts.map((a, i) => {
      const row: Record<string, string | number | null> = { label: `#${i + 1}` };
      for (const s of state.masteryHistory.filter((x) => x.attemptId === a.id && unitIds.has(x.topicId))) row[s.topicId] = s.accuracy === null ? null : Math.round(s.accuracy * 100);
      return row;
    });
    const series = d.assessable.filter((t) => state.masteryHistory.some((s) => s.topicId === t.id)).map((t) => ({ key: t.id, name: t.name }));
    const changes = d.assessable
      .map((t) => {
        const snaps = state.masteryHistory.filter((s) => s.topicId === t.id && s.accuracy !== null);
        if (snaps.length === 0) return null;
        return { topic: t, first: snaps[0].accuracy!, latest: snaps[snaps.length - 1].accuracy!, count: snaps.length, level: d.mastery.get(t.id)!.level };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    const allTasks = [...state.taskHistory, ...(state.plan?.tasks ?? [])];
    const doneTasks = allTasks.filter((t) => t.completed);
    return {
      trend,
      masteryRows,
      series,
      changes,
      improved: changes.filter((c) => c.count > 1 && c.latest > c.first).sort((a, b) => b.latest - b.first - (a.latest - a.first)),
      attention: d.bySeverity.filter((t) => ["weak", "medium", "insufficient"].includes(d.mastery.get(t.id)!.level)),
      tasks: { done: doneTasks.length, total: allTasks.length, minutes: doneTasks.reduce((n, t) => n + t.minutes, 0) },
      delta: attempts.length >= 2 ? (attempts.at(-1)!.score ?? 0) - (attempts.at(-2)!.score ?? 0) : null,
    };
  }, [state, d]);

  if (d.completedAttempts.length === 0) {
    return (
      <>
        <PageHeader title="Progress" />
        <Card><EmptyState icon={TrendingUp} title="No progress to show yet" action={<LinkButton href="/quiz" icon={ListChecks}>Take a quiz</LinkButton>}>Charts are drawn only from your completed quizzes and plan tasks.</EmptyState></Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Progress" description="Every chart on this page is computed from your stored quiz attempts, mastery snapshots and plan tasks." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Quizzes completed" value={d.completedAttempts.length} icon={ListChecks} />
        <Stat label="Change vs previous quiz" value={data.delta === null ? "—" : `${data.delta >= 0 ? "+" : ""}${Math.round(data.delta * 100)} pts`} icon={TrendingUp} tone={data.delta !== null && data.delta < 0 ? "red" : "green"} />
        <Stat label="Plan tasks done" value={`${data.tasks.done} / ${data.tasks.total}`} icon={CheckCircle2} tone="green" />
        <Stat label="Revision completed" value={formatMinutes(data.tasks.minutes)} icon={Target} tone="violet" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader icon={LineIcon} title="Quiz accuracy over time" description={d.hasSampleData ? "* = example attempt (sample data)" : "Score of each completed attempt"} />
          <div className="px-3 py-4"><ScoreTrend data={data.trend} /></div>
        </Card>
        <Card>
          <CardHeader icon={BarChart3} title="Improvement by unit" description="Accuracy at first assessment vs latest" />
          <div className="px-3 py-4">
            <FirstVsLatest data={data.changes.map((c) => ({ name: c.topic.name, first: Math.round(c.first * 100), latest: Math.round(c.latest * 100) }))} />
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader icon={TrendingUp} title="Unit mastery over time" description="Recent accuracy per unit after each quiz in which it was assessed" />
          <div className="px-3 py-4"><MasteryOverTime data={data.masteryRows} series={data.series} /></div>
        </Card>
        <Card>
          <CardHeader icon={ArrowUpRight} title="Recently improved" />
          <ul className="divide-y divide-slate-100">
            {data.improved.length === 0 && <li className="px-5 py-6 text-sm text-slate-500">Retest a unit to measure improvement.</li>}
            {data.improved.map((c) => (
              <li key={c.topic.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="font-medium text-slate-800">{c.topic.name}</span>
                <span className="flex items-center gap-2 text-slate-600">{pct(c.first)} → <strong className="text-emerald-700">{pct(c.latest)}</strong> <LevelBadge level={c.level} /></span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader icon={ArrowDownRight} title="Still needs attention" />
          <ul className="divide-y divide-slate-100">
            {data.attention.length === 0 && <li className="px-5 py-6 text-sm text-slate-500">Nothing outstanding — every unit is strong.</li>}
            {data.attention.map((t) => {
              const m = d.mastery.get(t.id)!;
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="font-medium text-slate-800">{t.name}</span>
                  <span className="flex items-center gap-2 text-slate-600">{pct(m.recentAccuracy)} <LevelBadge level={m.level} /></span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
