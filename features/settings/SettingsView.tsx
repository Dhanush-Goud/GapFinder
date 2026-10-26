"use client";
import { BookOpen, CheckCircle2, CircleSlash, Database, FlaskConical, LogOut, Save, Trash2, User } from "lucide-react";
import { useState } from "react";
import type { StudySettings } from "@/types/domain";
import { logoutAction } from "@/app/auth-actions";
import { Alert, Button, Card, CardHeader, Field, LinkButton, PageHeader, inputClass } from "@/components/ui";
import { useAppState } from "@/features/app-state/AppStateProvider";
import { useDerived } from "@/features/app-state/useDerived";
import { addDays, localToday } from "@/lib/revision/dates";

export function SettingsView({ userLabel }: { userLabel: string }) {
  const { state, config, savePlan, clearExampleData, resetWorkspace } = useAppState();
  const d = useDerived();
  const today = localToday();
  const [form, setForm] = useState<StudySettings>(state.settings ?? { examDate: addDays(today, 14), hoursPerDay: 2, preferredSlot: "evening" });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const demo = config.mode === "demo";

  async function run(key: string, fn: () => Promise<void>, ok: string) {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
      setMessage({ tone: "success", text: ok });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Action failed." });
    } finally {
      setBusy(null);
    }
  }

  const Row = ({ ok, label, detail }: { ok: boolean; label: string; detail: string }) => (
    <li className="flex gap-3 py-2.5">
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Active" /> : <CircleSlash className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-label="Not active" />}
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{detail}</p>
      </div>
    </li>
  );

  return (
    <>
      <PageHeader title="Settings" />
      {message && <Alert tone={message.tone} className="mb-6">{message.text}</Alert>}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader icon={User} title="Profile" />
          <div className="space-y-3 p-5 text-sm">
            <p><span className="text-slate-500">Signed in as:</span> <span className="font-medium">{userLabel}</span></p>
            <p className="text-slate-500">{demo ? "Demo session — there is no account; data lives in this browser." : "Your data is stored in Supabase and only visible to your account."}</p>
            <form action={logoutAction}>
              <Button type="submit" variant="secondary" icon={LogOut}>{demo ? "Exit demo" : "Log out"}</Button>
            </form>
          </div>
        </Card>

        <Card>
          <CardHeader icon={Save} title="Study preferences" description="Used to build your revision plan" />
          <form
            className="space-y-4 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void run("prefs", () => savePlan(form), "Preferences saved and your plan was regenerated.");
            }}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Exam date" htmlFor="s-exam"><input id="s-exam" type="date" required min={addDays(today, 1)} value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} className={inputClass} /></Field>
              <Field label="Hours / day" htmlFor="s-hours"><input id="s-hours" type="number" min={0.25} max={12} step={0.25} required value={form.hoursPerDay} onChange={(e) => setForm({ ...form, hoursPerDay: Number(e.target.value) })} className={inputClass} /></Field>
              <Field label="Time of day" htmlFor="s-slot">
                <select id="s-slot" value={form.preferredSlot} onChange={(e) => setForm({ ...form, preferredSlot: e.target.value as StudySettings["preferredSlot"] })} className={inputClass}>
                  <option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option>
                </select>
              </Field>
            </div>
            <Button type="submit" icon={Save} loading={busy === "prefs"}>Save preferences</Button>
          </form>
        </Card>

        <Card>
          <CardHeader icon={BookOpen} title="Document management" />
          <div className="space-y-3 p-5 text-sm text-slate-600">
            <p>{state.documents.length} document(s), {state.chunks.length} indexed passages, {state.topics.length} topics.</p>
            <LinkButton href="/materials" variant="secondary">Manage documents</LinkButton>
          </div>
        </Card>

        <Card>
          <CardHeader icon={Trash2} title="Data deletion" />
          <div className="space-y-4 p-5 text-sm text-slate-600">
            {demo && d.hasSampleData && (
              <div>
                <p>Remove the example attempt from the fictional student so reports show only your own answers.</p>
                <Button className="mt-2" variant="secondary" loading={busy === "sample"} onClick={() => run("sample", clearExampleData, "Example attempt removed. Mastery and plan were recalculated.")}>Remove example data</Button>
              </div>
            )}
            <div>
              <p>{demo ? "Reset the demo workspace to its initial state (sample course + example attempt). Your uploads and quiz history in this browser are deleted." : "Permanently delete all your documents, files, topics, quiz attempts, answers, mastery history and plans. Your login account is kept."}</p>
              <Button
                className="mt-2"
                variant="danger"
                icon={Trash2}
                loading={busy === "reset"}
                onClick={() => {
                  if (window.confirm(demo ? "Reset the demo workspace?" : "Delete ALL your study data? This cannot be undone.")) void run("reset", resetWorkspace, demo ? "Demo workspace reset." : "All study data deleted.");
                }}
              >
                {demo ? "Reset demo workspace" : "Delete all my data"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div id="mode" />
          <CardHeader icon={demo ? FlaskConical : Database} title={demo ? "Demo mode — what is real" : "Live mode — configured services"} />
          <div className="grid gap-x-8 px-5 py-2 sm:grid-cols-2">
            <ul className="divide-y divide-slate-100">
              <Row ok label="Document extraction & chunking" detail="PDF/text extraction, heading-aware chunking with page/section metadata — real in both modes." />
              <Row ok label="Deterministic grading & gap analysis" detail="Server-side answer keys; mastery labels from your answers by fixed thresholds." />
              <Row ok label="Adaptive revision planner" detail="Rule-based, validated against your daily limit, recalculated after every quiz." />
              <Row ok={!demo} label="Authentication" detail={demo ? "Not configured. The demo cookie is not secure authentication." : "Supabase Auth with server-verified sessions and protected routes."} />
            </ul>
            <ul className="divide-y divide-slate-100">
              <Row ok={!demo} label="Database persistence" detail={demo ? "Not configured. Data is stored in this browser's localStorage." : "Supabase Postgres with Row Level Security."} />
              <Row ok={!demo && config.aiConfigured} label="AI question generation & evaluation" detail={!demo && config.aiConfigured ? `Gemini (${config.aiModel}) with schema-validated, citation-checked output.` : "Not active — quizzes use the seeded, source-grounded bank; short answers use a key-point rubric."} />
              <Row ok={!demo && config.aiConfigured} label="Semantic retrieval" detail={!demo && config.aiConfigured ? `${config.embeddingModel} embeddings (768-d) in pgvector.` : "Not active — keyword (BM25 / full-text) retrieval is used and labelled as such."} />
              <Row ok={!demo && config.judgeAccess} label="Judge account login" detail={config.judgeAccess ? "One-click judge sign-in is enabled on the login page." : "Not configured (DEMO_USER_EMAIL / DEMO_USER_PASSWORD)."} />
            </ul>
          </div>
          {config.problems.length > 0 && <Alert tone="warning" className="m-5">{config.problems.join(" ")}</Alert>}
        </Card>
      </div>
    </>
  );
}
