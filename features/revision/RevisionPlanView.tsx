"use client";
import { CalendarCheck, CalendarDays, CheckCircle2, Info, ListChecks, Save } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { RevisionTask, StudySettings } from "@/types/domain";
import { formatDateTime, formatMinutes, TaskKindBadge } from "@/components/domain";
import { Alert, Button, Card, CardHeader, EmptyState, Field, LinkButton, PageHeader, ProgressBar, inputClass } from "@/components/ui";
import { useAppState } from "@/features/app-state/AppStateProvider";
import { useDerived } from "@/features/app-state/useDerived";
import { addDays, formatDay, localToday } from "@/lib/revision/dates";
import { PlanShiftNotice } from "./PlanShiftNotice";

export function RevisionPlanView() {
  const { state, savePlan, toggleTask } = useAppState();
  const d = useDerived();
  const today = localToday();
  const [form, setForm] = useState<StudySettings>(state.settings ?? { examDate: addDays(today, 14), hoursPerDay: 2, preferredSlot: "evening" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const plan = state.plan;

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await savePlan(form);
      setMessage({ tone: "success", text: "Plan generated from your current mastery." });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Could not generate the plan." });
    } finally {
      setBusy(false);
    }
  }

  const byDay = new Map<string, RevisionTask[]>();
  for (const t of plan?.tasks ?? []) byDay.set(t.day, [...(byDay.get(t.day) ?? []), t]);
  const cap = Math.round((plan?.settings.hoursPerDay ?? form.hoursPerDay) * 60);
  const total = plan?.tasks.reduce((n, t) => n + t.minutes, 0) ?? 0;
  const done = plan?.tasks.filter((t) => t.completed).reduce((n, t) => n + t.minutes, 0) ?? 0;
  const basedOn = plan?.basedOnAttemptId ? state.attempts.find((a) => a.id === plan.basedOnAttemptId) : null;

  return (
    <>
      <PageHeader title="Revision plan" description="A day-by-day schedule that fits your daily hours, puts the weakest and most heavily weighted units first, and is recalculated after every quiz." />
      <PlanShiftNotice />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="h-fit">
          <CardHeader icon={CalendarDays} title="Study settings" />
          <form onSubmit={generate} className="space-y-4 p-5">
            <Field label="Exam date" htmlFor="examDate" hint={`${Math.max(0, Math.round((Date.parse(form.examDate) - Date.parse(today)) / 86400000))} day(s) away`}>
              <input id="examDate" type="date" required min={addDays(today, 1)} value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Study hours per day" htmlFor="hours" hint="Between 0.25 and 12 hours.">
              <input id="hours" type="number" required min={0.25} max={12} step={0.25} value={form.hoursPerDay} onChange={(e) => setForm({ ...form, hoursPerDay: Number(e.target.value) })} className={inputClass} />
            </Field>
            <Field label="Preferred time" htmlFor="slot" hint="Shown on your schedule as a reminder.">
              <select id="slot" value={form.preferredSlot} onChange={(e) => setForm({ ...form, preferredSlot: e.target.value as StudySettings["preferredSlot"] })} className={inputClass}>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
              </select>
            </Field>
            {message && <Alert tone={message.tone}>{message.text}</Alert>}
            <Button type="submit" icon={Save} loading={busy} className="w-full">{plan ? "Update plan" : "Generate plan"}</Button>
            <p className="text-xs text-slate-500">Plans are computed by deterministic rules from your mastery data, so they work without any AI service.</p>
          </form>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {!plan ? (
            <Card>
              <EmptyState icon={CalendarCheck} title="No plan yet">Set your exam date and daily hours, then generate a plan. {d.completedAttempts.length === 0 && "Taking a diagnostic quiz first makes it much more targeted."}</EmptyState>
            </Card>
          ) : (
            <>
              <Card className="p-5">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="min-w-[180px] flex-1">
                    <p className="text-sm font-medium text-slate-700">{formatMinutes(done)} of {formatMinutes(total)} completed</p>
                    <div className="mt-2"><ProgressBar value={total ? done / total : 0} tone="green" label="Plan completion" /></div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Generated {formatDateTime(plan.createdAt)}
                    {basedOn ? <> after the quiz of {formatDateTime(basedOn.completedAt ?? basedOn.createdAt)}</> : ""} · up to {formatMinutes(cap)}/day · {plan.settings.preferredSlot} sessions
                  </p>
                </div>
                {plan.warnings.map((w) => (
                  <p key={w} className="mt-3 flex gap-2 text-sm text-amber-800"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{w}</p>
                ))}
              </Card>
              {Array.from(byDay.entries()).map(([day, tasks]) => {
                const minutes = tasks.reduce((n, t) => n + t.minutes, 0);
                return (
                  <Card key={day}>
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                      <h2 className="text-sm font-semibold text-slate-900">{day === today ? "Today" : formatDay(day)}</h2>
                      <p className="text-xs text-slate-500">{formatMinutes(minutes)} of {formatMinutes(cap)}</p>
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {tasks.map((t) => (
                        <TaskRow key={t.id} task={t} topicName={d.topicName(t.topicId)} onToggle={(c) => toggleTask(t.id, c).catch((e) => setMessage({ tone: "error", text: e.message }))} />
                      ))}
                    </ul>
                  </Card>
                );
              })}
              {plan.tasks.length === 0 && (
                <Card><EmptyState icon={CheckCircle2} title="Nothing to schedule">All assessed units are strong. Retest before the exam to confirm.</EmptyState></Card>
              )}
              {state.taskHistory.length > 0 && (
                <p className="text-xs text-slate-500">{state.taskHistory.length} task(s) completed under earlier plans are kept in your progress history.</p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function TaskRow({ task, topicName, onToggle }: { task: RevisionTask; topicName: string; onToggle: (completed: boolean) => void }) {
  return (
    <li className="flex items-start gap-3 px-5 py-3.5">
      <input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" checked={task.completed} onChange={(e) => onToggle(e.target.checked)} aria-label={`Mark “${task.objective}” ${task.completed ? "not done" : "done"}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${task.completed ? "text-slate-400 line-through" : "text-slate-800"}`}>{task.objective}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <TaskKindBadge kind={task.kind} /> <span className="font-medium text-slate-700">{topicName}</span> · {formatMinutes(task.minutes)}
        </p>
        <p className="mt-1 text-xs text-slate-500">Why: {task.reason}</p>
      </div>
      {task.kind === "retest" && !task.completed && (
        <LinkButton href={`/quiz?topic=${encodeURIComponent(task.topicId)}`} variant="secondary" icon={ListChecks}>Retest</LinkButton>
      )}
      {task.kind === "study" && !task.completed && (
        <Link href={`/tutor?topic=${encodeURIComponent(task.topicId)}`} className="hidden text-xs font-medium text-brand-600 hover:underline sm:block">Ask tutor</Link>
      )}
    </li>
  );
}
