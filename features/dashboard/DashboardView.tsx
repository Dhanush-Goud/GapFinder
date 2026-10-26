"use client";
import { AlertTriangle, ArrowRight, BookOpen, CalendarCheck, CheckCircle2, Clock, FileText, Gauge, ListChecks, Target, TrendingUp, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ScoreTrend } from "@/components/charts";
import { formatDateTime, formatMinutes, LevelBadge, pct, SampleDataBadge, TaskKindBadge } from "@/components/domain";
import { Alert, Card, CardHeader, EmptyState, LinkButton, ProgressBar, Stat } from "@/components/ui";
import { useAppState } from "@/features/app-state/AppStateProvider";
import { useDerived } from "@/features/app-state/useDerived";
import { explainMastery } from "@/lib/diagnosis/mastery";
import { addDays, formatDay, localToday } from "@/lib/revision/dates";

export function DashboardView() {
  const { state, config, toggleTask } = useAppState();
  const d = useDerived();
  const [taskError, setTaskError] = useState<string | null>(null);
  const today = localToday();

  if (state.documents.length === 0) {
    return (
      <>
        <Header />
        <Card>
          <EmptyState icon={Upload} title="Upload your study material to begin" action={<LinkButton href="/materials" icon={Upload}>Go to materials</LinkButton>}>
            Start with your syllabus — it defines the topic map. Then add notes or textbook chapters so questions can be generated from them.
            {config.mode === "live" && " Or load the sample Data Structures course from the Materials page."}
          </EmptyState>
        </Card>
      </>
    );
  }

  const needsRevision = d.bySeverity.filter((t) => ["weak", "insufficient", "medium"].includes(d.mastery.get(t.id)!.level)).slice(0, 4);
  const pending = (state.plan?.tasks ?? []).filter((t) => !t.completed && t.day >= today).slice(0, 5);
  const weekEnd = addDays(today, 7);
  const plannedWeek = (state.plan?.tasks ?? []).filter((t) => t.day >= today && t.day < weekEnd).reduce((n, t) => n + t.minutes, 0);
  const completedMinutes = [...state.taskHistory, ...(state.plan?.tasks ?? [])].filter((t) => t.completed).reduce((n, t) => n + t.minutes, 0);
  const todayMinutes = (state.plan?.tasks ?? []).filter((t) => t.day === today).reduce((n, t) => n + t.minutes, 0);
  const recent = [...d.completedAttempts].reverse().slice(0, 4);
  const trend = d.completedAttempts.map((a, i) => ({ label: `#${i + 1}`, score: Math.round((a.score ?? 0) * 100), sample: a.isSample }));
  const docs = { ready: state.documents.filter((x) => x.status === "ready").length, failed: state.documents.filter((x) => x.status === "failed").length, processing: state.documents.filter((x) => x.status === "processing").length };

  return (
    <>
      <Header />
      {d.hasSampleData && (
        <Alert tone="warning" className="mb-6" title="Includes example data">
          One completed quiz from a fictional student (marked <strong>Example data</strong>) is pre-loaded so every report has content. Your own quizzes are added alongside it. You can remove it in{" "}
          <Link href="/settings" className="font-medium underline">Settings</Link>.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Overall mastery" value={pct(d.overall)} icon={Gauge} hint={d.overall === null ? "Take a quiz to measure it" : "Average recent accuracy across assessed units"} />
        <Stat label="Weak topics" value={d.counts.weak} icon={AlertTriangle} tone="red" hint="Below 50% recent accuracy" />
        <Stat label="Developing" value={d.counts.medium} icon={TrendingUp} tone="amber" hint="50–79% recent accuracy" />
        <Stat label="Strong" value={d.counts.strong} icon={CheckCircle2} tone="green" hint={`${d.counts.insufficient} unit(s) not yet assessed`} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader icon={Target} title="Topics needing revision" description="Ranked by severity, then syllabus weightage" action={<LinkButton href="/gap-report" variant="ghost">Full gap report <ArrowRight className="h-4 w-4" /></LinkButton>} />
          <ul className="divide-y divide-slate-100">
            {needsRevision.length === 0 && <li className="px-5 py-6 text-sm text-slate-500">Every assessed unit is strong. Retest to confirm it holds.</li>}
            {needsRevision.map((t) => {
              const m = d.mastery.get(t.id)!;
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900">{t.name}</p>
                      <LevelBadge level={m.level} />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{explainMastery(m)}</p>
                  </div>
                  <div className="w-28">
                    <ProgressBar value={m.recentAccuracy ?? 0} tone={m.level === "weak" ? "red" : m.level === "medium" ? "amber" : "slate"} label={`${t.name} accuracy`} />
                  </div>
                  <LinkButton href={`/quiz?topic=${encodeURIComponent(t.id)}`} variant="secondary">
                    {m.level === "insufficient" ? "Assess" : "Retest"}
                  </LinkButton>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader icon={Clock} title="Study time" />
          <dl className="space-y-3 px-5 py-4 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Planned today</dt><dd className="font-medium">{formatMinutes(todayMinutes)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Planned next 7 days</dt><dd className="font-medium">{formatMinutes(plannedWeek)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Completed so far</dt><dd className="font-medium text-emerald-700">{formatMinutes(completedMinutes)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Exam date</dt><dd className="font-medium">{state.settings ? formatDay(state.settings.examDate) : "Not set"}</dd></div>
          </dl>
          <div className="border-t border-slate-100 px-5 py-3">
            <LinkButton href="/quiz" className="w-full" icon={ListChecks}>Start diagnostic quiz</LinkButton>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader icon={CalendarCheck} title="Upcoming revision tasks" action={<LinkButton href="/revision-plan" variant="ghost">Open plan <ArrowRight className="h-4 w-4" /></LinkButton>} />
          {taskError && <Alert tone="error" className="mx-5 mt-3">{taskError}</Alert>}
          {!state.plan ? (
            <EmptyState icon={CalendarCheck} title="No revision plan yet" action={<LinkButton href="/revision-plan">Create a plan</LinkButton>}>Set your exam date and daily study hours to get a prioritised schedule.</EmptyState>
          ) : pending.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">No pending tasks. Retest to update your plan.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pending.map((t) => (
                <li key={t.id} className="flex items-start gap-3 px-5 py-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    aria-label={`Mark “${t.objective}” complete`}
                    checked={t.completed}
                    onChange={(e) => toggleTask(t.id, e.target.checked).catch((err) => setTaskError(err.message))}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800">{t.objective}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <TaskKindBadge kind={t.kind} /> {d.topicName(t.topicId)} · {formatDay(t.day)} · {formatMinutes(t.minutes)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader icon={FileText} title="Documents" action={<LinkButton href="/materials" variant="ghost">Manage</LinkButton>} />
          <dl className="space-y-3 px-5 py-4 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Ready</dt><dd className="font-medium">{docs.ready}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Processing</dt><dd className="font-medium">{docs.processing}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Failed</dt><dd className={docs.failed ? "font-medium text-red-600" : "font-medium"}>{docs.failed}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Indexed passages</dt><dd className="font-medium">{state.chunks.length}</dd></div>
          </dl>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader icon={TrendingUp} title="Quiz score trend" description="Every completed diagnostic attempt, in order" />
          <div className="px-3 py-4">
            {trend.length < 2 ? (
              <p className="px-2 py-8 text-center text-sm text-slate-500">Complete at least two quizzes to see a trend.</p>
            ) : (
              <ScoreTrend data={trend} />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader icon={BookOpen} title="Recent attempts" />
          <ul className="divide-y divide-slate-100">
            {recent.length === 0 && <li className="px-5 py-6 text-sm text-slate-500">No quizzes yet.</li>}
            {recent.map((a) => (
              <li key={a.id}>
                <Link href={`/quiz?attempt=${encodeURIComponent(a.id)}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{a.topicIds.map(d.topicName).join(", ")}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      {formatDateTime(a.completedAt ?? a.createdAt)} · {a.questions.length} questions {a.isSample && <SampleDataBadge />}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{pct(a.score)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

function Header() {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Where you stand, what is weak, and what to study next.</p>
      </div>
      <LinkButton href="/quiz" icon={ListChecks}>Start diagnostic quiz</LinkButton>
    </div>
  );
}
