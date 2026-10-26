"use client";
import {
  BookOpen,
  CheckCircle2,
  CircleSlash,
  Database,
  FlaskConical,
  LogOut,
  Save,
  ShieldCheck,
  Trash2,
  User,
} from "lucide-react";
import { useState } from "react";
import type { StudySettings } from "@/types/domain";
import { logoutAction } from "@/app/auth-actions";
import { Alert, Badge, Button, Card, CardHeader, Field, LinkButton, PageHeader, inputClass } from "@/components/ui";
import { useAppState } from "@/features/app-state/AppStateProvider";
import { useDerived } from "@/features/app-state/useDerived";
import { addDays, localToday } from "@/lib/revision/dates";

export function SettingsView({ userLabel }: { userLabel: string }) {
  const { state, config, savePlan, clearExampleData, resetWorkspace } = useAppState();
  const d = useDerived();
  const today = localToday();
  const [form, setForm] = useState<StudySettings>(
    state.settings ?? { examDate: addDays(today, 14), hoursPerDay: 2, preferredSlot: "evening" }
  );
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
    <li className="flex gap-3 py-3 border-b border-[#2A2D26]/50 last:border-b-0">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#D5FF32]" aria-label="Active" />
      ) : (
        <CircleSlash className="mt-0.5 h-4 w-4 shrink-0 text-[#73776E]" aria-label="Not active" />
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[#F4F5F0]">{label}</p>
        <p className="mt-0.5 text-[11px] text-[#A0A39A] leading-relaxed">{detail}</p>
      </div>
    </li>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Workspace Configuration"
        description="Manage your learning session profile, calibrate revision parameters, and inspect architectural telemetry and data persistence boundaries."
      />

      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Profile Card */}
        <Card className="border-[#2A2D26] bg-[#10110F]">
          <CardHeader icon={User} title="Session Identity" />
          <div className="space-y-4 p-5 text-xs">
            <div className="rounded-xl border border-[#2A2D26] bg-[#171915] p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#73776E]">Authenticated Identity</p>
              <p className="mt-1 text-sm font-semibold text-[#F4F5F0]">{userLabel}</p>
              <p className="mt-1 text-[11px] text-[#A0A39A]">
                {demo
                  ? "Local demo sandbox — isolated to this browser instance; no remote credentials transmitted."
                  : "Authenticated account with Row-Level Security isolation in Supabase PostgreSQL."}
              </p>
            </div>
            <form action={logoutAction}>
              <Button type="submit" variant="secondary" icon={LogOut} className="text-xs">
                {demo ? "Terminate Demo Session" : "Log out"}
              </Button>
            </form>
          </div>
        </Card>

        {/* Study Preferences Card */}
        <Card className="border-[#2A2D26] bg-[#10110F]">
          <CardHeader icon={Save} title="Revision Calibration" description="Parameters used to calculate your adaptive study plan" />
          <form
            className="space-y-4 p-5 text-xs"
            onSubmit={(e) => {
              e.preventDefault();
              void run("prefs", () => savePlan(form), "Preferences saved and your adaptive plan was regenerated.");
            }}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Target Exam" htmlFor="s-exam">
                <input
                  id="s-exam"
                  type="date"
                  required
                  min={addDays(today, 1)}
                  value={form.examDate}
                  onChange={(e) => setForm({ ...form, examDate: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Hours / Day" htmlFor="s-hours">
                <input
                  id="s-hours"
                  type="number"
                  min={0.25}
                  max={12}
                  step={0.25}
                  required
                  value={form.hoursPerDay}
                  onChange={(e) => setForm({ ...form, hoursPerDay: Number(e.target.value) })}
                  className={inputClass}
                />
              </Field>
              <Field label="Daily Slot" htmlFor="s-slot">
                <select
                  id="s-slot"
                  value={form.preferredSlot}
                  onChange={(e) => setForm({ ...form, preferredSlot: e.target.value as StudySettings["preferredSlot"] })}
                  className={inputClass}
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                </select>
              </Field>
            </div>
            <Button type="submit" icon={Save} loading={busy === "prefs"} className="text-xs uppercase tracking-wider font-bold">
              Save & Recalculate
            </Button>
          </form>
        </Card>

        {/* Repository Scope */}
        <Card className="border-[#2A2D26] bg-[#10110F]">
          <CardHeader icon={BookOpen} title="Workspace Scope" />
          <div className="space-y-4 p-5 text-xs text-[#A0A39A]">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-[#2A2D26] bg-[#171915] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#73776E]">Documents</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-[#D5FF32]">{state.documents.length}</p>
              </div>
              <div className="rounded-xl border border-[#2A2D26] bg-[#171915] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#73776E]">Passages</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-[#F4F5F0]">{state.chunks.length}</p>
              </div>
              <div className="rounded-xl border border-[#2A2D26] bg-[#171915] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#73776E]">Syllabus Units</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-[#F4F5F0]">{state.topics.length}</p>
              </div>
            </div>
            <LinkButton href="/materials" variant="secondary" className="text-xs">
              Open Document Repository
            </LinkButton>
          </div>
        </Card>

        {/* Data Lifecycle */}
        <Card className="border-[#2A2D26] bg-[#10110F]">
          <CardHeader icon={Trash2} title="Data Lifecycle & Sanitation" />
          <div className="space-y-4 p-5 text-xs text-[#A0A39A]">
            {demo && d.hasSampleData && (
              <div className="rounded-xl border border-[#2A2D26] bg-[#171915] p-3.5 space-y-2">
                <p className="text-xs text-[#F4F5F0]">
                  Purge the pre-loaded example baseline attempt so all diagnostic reports reflect exclusively your live answers.
                </p>
                <Button
                  variant="secondary"
                  loading={busy === "sample"}
                  onClick={() =>
                    run("sample", clearExampleData, "Example attempt purged. Mastery telemetry recalibrated.")
                  }
                  className="text-xs"
                >
                  Purge Baseline Data
                </Button>
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xs text-[#A0A39A]">
                {demo
                  ? "Reset your browser demo workspace to default state (sample course + baseline attempt). Custom uploads are cleared."
                  : "Permanently delete all indexed documents, diagnostic questions, mastery snapshots, and revision plans from the database. Account remains intact."}
              </p>
              <Button
                variant="danger"
                icon={Trash2}
                loading={busy === "reset"}
                onClick={() => {
                  if (
                    window.confirm(
                      demo
                        ? "Reset the demo workspace?"
                        : "Permanently delete ALL indexed study data and attempts? This action cannot be reversed."
                    )
                  ) {
                    void run("reset", resetWorkspace, demo ? "Demo workspace reinitialized." : "All study data cleared.");
                  }
                }}
                className="text-xs"
              >
                {demo ? "Reinitialize Demo Workspace" : "Purge All Workspace Data"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Mode Architecture Inspection */}
        <Card className="lg:col-span-2 border-[#2A2D26] bg-[#10110F]">
          <div id="mode" />
          <CardHeader
            icon={demo ? FlaskConical : Database}
            title={demo ? "Demo Sandbox Architecture" : "Production Architecture Subsystems"}
            badge={
              demo ? (
                <Badge tone="amber">Client-Side Persistence</Badge>
              ) : (
                <Badge tone="brand">Supabase Verified</Badge>
              )
            }
          />
          <div className="grid gap-x-8 px-5 py-3 sm:grid-cols-2 text-xs">
            <ul>
              <Row
                ok
                label="Text Extraction & Chunking"
                detail="PDF and markdown extraction with heading-aware chunking and section metadata — fully real in both modes."
              />
              <Row
                ok
                label="Deterministic Diagnostic Analysis"
                detail="Server-isolated answer keys; mastery classifications computed by explainable rolling thresholds."
              />
              <Row
                ok
                label="Adaptive Revision Planner"
                detail="Rule-based scheduler respecting daily capacity limits and recalculating after every evaluation."
              />
              <Row
                ok={!demo}
                label="Cryptographic Authentication"
                detail={
                  demo
                    ? "Demo cookie session (not for production use)."
                    : "Supabase Auth with cryptographically verified SSR sessions."
                }
              />
            </ul>
            <ul>
              <Row
                ok={!demo}
                label="Database Persistence & RLS"
                detail={
                  demo
                    ? "Stored in browser localStorage."
                    : "Supabase PostgreSQL with strict Row Level Security policies per user."
                }
              />
              <Row
                ok={!demo && config.aiConfigured}
                label="Grounded AI Generation"
                detail={
                  !demo && config.aiConfigured
                    ? `${config.aiModel} with schema validation and citation verification.`
                    : "Seeded question bank with deterministic key-concept rubric."
                }
              />
              <Row
                ok={!demo && config.aiConfigured}
                label="Vector Semantic Search"
                detail={
                  !demo && config.aiConfigured
                    ? `${config.embeddingModel} embeddings (768-d) via pgvector.`
                    : "Deterministic keyword retrieval (BM25 / fulltext index)."
                }
              />
              <Row
                ok={!demo && config.judgeAccess}
                label="Judge Demo Credentials"
                detail={
                  config.judgeAccess
                    ? "One-click judge evaluation credentials available on login screen."
                    : "Configured via DEMO_USER_EMAIL / DEMO_USER_PASSWORD."
                }
              />
            </ul>
          </div>
          {config.problems.length > 0 && (
            <div className="p-5 border-t border-[#2A2D26]">
              <Alert tone="warning">{config.problems.join(" ")}</Alert>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
