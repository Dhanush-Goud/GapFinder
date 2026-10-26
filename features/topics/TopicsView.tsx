"use client";
import { AlertTriangle, ChevronDown, ChevronRight, FileText, ListChecks, Network, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Topic } from "@/types/domain";
import { ImportanceBadge, LevelBadge, pct } from "@/components/domain";
import { Alert, Badge, Button, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { useAppState } from "@/features/app-state/AppStateProvider";
import { useDerived } from "@/features/app-state/useDerived";
import { descendantsOf } from "@/lib/rag/link";

export function TopicsView() {
  const { state, config, extractTopics } = useAppState();
  const d = useDerived();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const syllabusIds = new Set(state.documents.filter((x) => x.kind === "syllabus").map((x) => x.id));

  /** Supporting passages = non-syllabus chunks linked to the topic (or its sub-topics). */
  const supporting = (t: Topic) => {
    const scope = new Set([t.id, ...descendantsOf(t.id, state.topics)]);
    return state.chunks.filter((c) => !syllabusIds.has(c.documentId) && c.topicIds.some((id) => scope.has(id)));
  };

  async function rebuild() {
    if (state.topics.length && !window.confirm("Rebuilding replaces your topic map. Quiz results, mastery history and plan tasks linked to the old topics will be removed. Continue?")) return;
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ tone: "success", text: await extractTopics() });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Topic extraction failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Topic map"
        description="Built from your syllabus — topics are never invented. Each unit shows its mastery, its syllabus source and how much of your material supports it."
        actions={config.mode === "live" ? <Button variant="secondary" icon={RefreshCw} loading={busy} onClick={rebuild}>{state.topics.length ? "Rebuild from syllabus" : "Build from syllabus"}</Button> : undefined}
      />
      {message && <Alert tone={message.tone} className="mb-6">{message.text}</Alert>}
      {d.topLevel.length === 0 ? (
        <Card>
          <EmptyState icon={Network} title="No topic map yet" action={<LinkButton href="/materials">Upload a syllabus</LinkButton>}>
            Upload a document of type “Syllabus”. Numbered units such as “Unit 2: Linked Lists” and “2.1 Singly linked lists” are recognised automatically{config.aiConfigured ? "; other formats are interpreted by the AI and verified against the syllabus text" : ""}.
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-4">
          {d.topLevel.map((t) => (
            <TopicCard key={t.id} topic={t} supportCount={supporting(t).length} childSupport={(c) => supporting(c).length} assessable={d.assessable.some((a) => a.id === t.id)} />
          ))}
        </div>
      )}
    </>
  );
}

function TopicCard({ topic, supportCount, childSupport, assessable }: { topic: Topic; supportCount: number; childSupport: (t: Topic) => number; assessable: boolean }) {
  const d = useDerived();
  const { state } = useAppState();
  const [open, setOpen] = useState(false);
  const m = d.mastery.get(topic.id)!;
  const children = d.childrenOf(topic.id);
  const sections = Array.from(
    new Set(
      state.chunks
        .filter((c) => c.topicIds.includes(topic.id) && state.documents.find((x) => x.id === c.documentId)?.kind !== "syllabus")
        .map((c) => `${c.documentName}${c.section ? ` · §${c.section}` : ""}${c.page ? ` · p.${c.page}` : ""}`)
    )
  );
  return (
    <Card>
      <div className="flex flex-wrap items-start gap-4 px-5 py-4">
        <button onClick={() => setOpen(!open)} className="mt-0.5 rounded p-0.5 text-slate-400 hover:text-slate-700" aria-expanded={open} aria-label={open ? `Collapse ${topic.name}` : `Expand ${topic.name}`}>
          {open ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-slate-900">{topic.code ? `${topic.code}. ` : ""}{topic.name}</h2>
            <LevelBadge level={m.level} />
            <ImportanceBadge importance={topic.importance} />
            {topic.origin === "ai" && <Badge tone="blue">AI-extracted, source-verified</Badge>}
          </div>
          <p className="mt-1 text-sm text-slate-600">{topic.description}</p>
          <p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>Recent accuracy {pct(m.recentAccuracy)} ({m.windowAttempted} answers)</span>
            <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {supportCount} supporting passage(s)</span>
            {topic.sourceRefs[0] && <span>Syllabus: “{topic.sourceRefs[0].section}”{topic.sourceRefs[0].page ? ` (p.${topic.sourceRefs[0].page})` : ""}</span>}
          </p>
          {supportCount === 0 && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" /> Insufficient material: no notes or textbook passages cover this topic yet.
            </p>
          )}
        </div>
        {assessable ? (
          <LinkButton href={`/quiz?topic=${encodeURIComponent(topic.id)}`} variant="secondary" icon={ListChecks}>Quiz this topic</LinkButton>
        ) : (
          <Badge tone="slate">Quiz needs live AI</Badge>
        )}
      </div>
      {open && (
        <div className="border-t border-slate-100 px-5 py-4 sm:pl-14">
          {children.length > 0 && (
            <ul className="space-y-2">
              {children.map((c) => {
                const cm = d.mastery.get(c.id)!;
                const n = childSupport(c);
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-800">{c.code ? `${c.code} ` : ""}{c.name}</span>
                    <span className="text-slate-500">{c.description !== c.name ? c.description : ""}</span>
                    <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                      {cm.windowAttempted > 0 && <span>{pct(cm.recentAccuracy)} of {cm.windowAttempted}</span>}
                      <LevelBadge level={cm.level} />
                      {n === 0 ? <Badge tone="amber">No supporting material</Badge> : <span>{n} passage(s)</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {sections.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Linked sources</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {sections.slice(0, 12).map((s) => (
                  <li key={s}><Badge tone="slate">{s}</Badge></li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-4 text-xs text-slate-500">
            Mastery rolls sub-topic answers up into the unit. See the <Link href="/gap-report" className="font-medium text-brand-600 hover:underline">gap report</Link> for the evidence.
          </p>
        </div>
      )}
    </Card>
  );
}
