"use client";
import {
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Info,
  ListChecks,
  MessageSquareText,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
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
  const [form, setForm] = useState<StudySettings>(
    state.settings ?? { examDate: addDays(today, 14), hoursPerDay: 2, preferredSlot: "evening" }
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const plan = state.plan;

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await savePlan(form);
      setMessage({ tone: "success", text: "Revision plan recalculated and persisted from current diagnostic telemetry." });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Could not compile revision plan." });
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
  const daysUntilExam = Math.max(0, Math.round((Date.parse(form.examDate) - Date.parse(today)) / 86400000));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Adaptive Revision Plan"
        description="Deterministic study schedule structured to your exam horizon and daily time capacity. Allocates heaviest revision hours to high-weightage diagnosed knowledge gaps, recalculating dynamically after every diagnostic quiz."
      />

      <PlanShiftNotice />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Study Parameters Card */}
        <Card className="h-fit border-[#2A2D26] bg-[#10110F]">
          <CardHeader icon={CalendarDays} title="Study Horizon Settings" />
          <form onSubmit={generate} className="space-y-4 p-5 text-xs">
            <Field
              label="Target Exam Date"
              htmlFor="examDate"
              hint={`${daysUntilExam} calendar day(s) remaining`}
            >
              <input
                id="examDate"
                type="date"
                required
                min={addDays(today, 1)}
                value={form.examDate}
                onChange={(e) => setForm({ ...form, examDate: e.target.value })}
                className={inputClass}
              />
            </Field>

            <Field
              label="Daily Revision Allocation"
              htmlFor="hours"
              hint="Study capacity between 0.25 and 12.0 hours per day"
            >
              <input
                id="hours"
                type="number"
                required
                min={0.25}
                max={12}
                step={0.25}
                value={form.hoursPerDay}
                onChange={(e) => setForm({ ...form, hoursPerDay: Number(e.target.value) })}
                className={inputClass}
              />
            </Field>

            <Field
              label="Preferred Study Window"
              htmlFor="slot"
              hint="Optimizes reminder timing"
            >
              <select
                id="slot"
                value={form.preferredSlot}
                onChange={(e) => setForm({ ...form, preferredSlot: e.target.value as StudySettings["preferredSlot"] })}
                className={inputClass}
              >
                <option value="morning">Morning (Focus / Concepts)</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening (Review & Retest)</option>
              </select>
            </Field>

            {message && <Alert tone={message.tone}>{message.text}</Alert>}

            <Button
              type="submit"
              icon={Save}
              loading={busy}
              className="w-full text-xs uppercase tracking-wider font-bold"
            >
              {plan ? "Recalculate Schedule" : "Compile Revision Plan"}
            </Button>

            <p className="text-[11px] text-[#73776E] border-t border-[#2A2D26]/60 pt-2">
              Plans are computed using deterministic heuristics that map mastery severity and syllabus weightage, operating reliably with or without external AI services.
            </p>
          </form>
        </Card>

        {/* Schedule Display */}
        <div className="space-y-4 lg:col-span-2">
          {!plan ? (
            <Card className="border-[#2A2D26] bg-[#10110F]">
              <EmptyState
                icon={CalendarCheck}
                title="No active revision plan compiled"
                action={<Button onClick={generate} icon={Sparkles}>Generate Initial Plan</Button>}
              >
                Set your exam date and daily available hours on the left to compile an empirical revision timeline.
                {d.completedAttempts.length === 0 && " Taking an initial diagnostic quiz first will sharpen gap priorities."}
              </EmptyState>
            </Card>
          ) : (
            <>
              {/* Progress Summary Card */}
              <Card className="p-5 border-[#2A2D26] bg-[#10110F]">
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div className="min-w-[200px] flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-[#F4F5F0]">Completion Progress</span>
                      <span className="tabular-nums font-bold text-[#D5FF32]">
                        {formatMinutes(done)} / {formatMinutes(total)} ({total ? Math.round((done / total) * 100) : 0}%)
                      </span>
                    </div>
                    <ProgressBar value={total ? done / total : 0} tone="brand" label="Plan completion" />
                  </div>
                  <div className="text-right text-[11px] text-[#73776E]">
                    <p>
                      Compiled {formatDateTime(plan.createdAt)}
                      {basedOn ? <> · Calibrated after Quiz #{d.completedAttempts.indexOf(basedOn) + 1}</> : ""}
                    </p>
                    <p className="mt-0.5">
                      Daily target: {formatMinutes(cap)} · {plan.settings.preferredSlot} focus
                    </p>
                  </div>
                </div>

                {plan.warnings.map((w) => (
                  <p key={w} className="mt-3 flex items-center gap-2 text-xs text-[#FDE68A] bg-[#19150B] p-2.5 rounded-lg border border-[#3D3017]">
                    <Info className="h-4 w-4 text-[#E5A83B] shrink-0" aria-hidden />
                    {w}
                  </p>
                ))}
              </Card>

              {/* Day-by-Day Agenda */}
              {Array.from(byDay.entries()).map(([day, tasks]) => {
                const minutes = tasks.reduce((n, t) => n + t.minutes, 0);
                const isToday = day === today;
                const allDone = tasks.length > 0 && tasks.every((t) => t.completed);

                return (
                  <Card key={day} className={`border-[#2A2D26] ${isToday ? "bg-[#10110F] ring-1 ring-[#D5FF32]/40" : "bg-[#10110F]"}`}>
                    <div className="flex items-center justify-between border-b border-[#2A2D26] px-5 py-3 bg-[#171915]">
                      <div className="flex items-center gap-2">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-[#F4F5F0]">
                          {isToday ? (
                            <span className="text-[#D5FF32] flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" /> Today ({formatDay(day)})
                            </span>
                          ) : (
                            formatDay(day)
                          )}
                        </h2>
                        {allDone && (
                          <span className="rounded bg-[#10B981]/15 px-1.5 py-0.2 text-[10px] font-bold uppercase text-[#34D399]">
                            Completed
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold tabular-nums text-[#A0A39A]">
                        {formatMinutes(minutes)} of {formatMinutes(cap)}
                      </p>
                    </div>

                    <ul className="divide-y divide-[#2A2D26]">
                      {tasks.map((t) => (
                        <TaskRow
                          key={t.id}
                          task={t}
                          topicName={d.topicName(t.topicId)}
                          onToggle={(c) =>
                            toggleTask(t.id, c).catch((e) => setMessage({ tone: "error", text: e.message }))
                          }
                        />
                      ))}
                    </ul>
                  </Card>
                );
              })}

              {plan.tasks.length === 0 && (
                <Card className="border-[#2A2D26] bg-[#10110F]">
                  <EmptyState icon={CheckCircle2} title="All syllabus units meet target threshold">
                    No urgent remedial tasks pending. Conduct a diagnostic retest closer to exam date to verify retention.
                  </EmptyState>
                </Card>
              )}

              {state.taskHistory.length > 0 && (
                <p className="text-center text-[11px] text-[#73776E] pt-2">
                  {state.taskHistory.length} task(s) completed under previous plan configurations are preserved in historical telemetry.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  topicName,
  onToggle,
}: {
  task: RevisionTask;
  topicName: string;
  onToggle: (completed: boolean) => void;
}) {
  return (
    <li className="flex items-start gap-3.5 px-5 py-3.5 hover:bg-[#171915]/50 transition-colors">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-[#2A2D26] bg-[#10110F] text-[#D5FF32] focus:ring-[#D5FF32] focus:ring-offset-[#10110F]"
        checked={task.completed}
        onChange={(e) => onToggle(e.target.checked)}
        aria-label={`Mark “${task.objective}” ${task.completed ? "incomplete" : "complete"}`}
      />
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-semibold leading-snug ${task.completed ? "text-[#73776E] line-through" : "text-[#F4F5F0]"}`}>
          {task.objective}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#A0A39A]">
          <TaskKindBadge kind={task.kind} />
          <span className="font-semibold text-[#F4F5F0]">{topicName}</span>
          <span>·</span>
          <span className="tabular-nums">{formatMinutes(task.minutes)}</span>
        </p>
        <p className="mt-1 text-[11px] text-[#73776E]">
          Rationale: {task.reason}
        </p>
      </div>

      <div className="shrink-0 flex items-center gap-2">
        {task.kind === "retest" && !task.completed && (
          <LinkButton
            href={`/quiz?topic=${encodeURIComponent(task.topicId)}`}
            variant="secondary"
            className="text-xs py-1.5 px-3"
            icon={ListChecks}
          >
            Retest
          </LinkButton>
        )}
        {task.kind === "study" && !task.completed && (
          <Link
            href={`/tutor?topic=${encodeURIComponent(task.topicId)}`}
            className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-[#D5FF32] hover:underline"
          >
            <MessageSquareText className="h-3 w-3" /> Consult Tutor
          </Link>
        )}
      </div>
    </li>
  );
}
