"use client";
import {
  AlertTriangle,
  ArrowRight,
  BookMarked,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Compass,
  FileSearch,
  FileText,
  Filter,
  Layers,
  ListChecks,
  MessageSquareText,
  Network,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Topic } from "@/types/domain";
import { ImportanceBadge, LevelBadge, pct } from "@/components/domain";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LinkButton, PageHeader, inputClass } from "@/components/ui";
import { useAppState } from "@/features/app-state/AppStateProvider";
import { useDerived } from "@/features/app-state/useDerived";
import { explainMastery } from "@/lib/diagnosis/mastery";
import { descendantsOf } from "@/lib/rag/link";

export function TopicsView() {
  const { state, config, extractTopics } = useAppState();
  const d = useDerived();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "weak" | "uncovered" | "covered">("all");

  const syllabusIds = useMemo(
    () => new Set(state.documents.filter((x) => x.kind === "syllabus").map((x) => x.id)),
    [state.documents]
  );

  /** Supporting passages = non-syllabus chunks linked to topic or sub-topics */
  const supporting = (t: Topic) => {
    const scope = new Set([t.id, ...descendantsOf(t.id, state.topics)]);
    return state.chunks.filter((c) => !syllabusIds.has(c.documentId) && c.topicIds.some((id) => scope.has(id)));
  };

  const getCoverageStatus = (t: Topic) => {
    const passCount = supporting(t).length;
    const m = d.mastery.get(t.id);
    if (passCount >= 2 || (m && m.level === "strong")) return "covered";
    if (passCount === 1 || (m && m.level === "medium")) return "partial";
    return "uncovered";
  };

  async function rebuild() {
    if (
      state.topics.length &&
      !window.confirm(
        "Rebuilding replaces your topic map. Quiz results, mastery history and plan tasks linked to the old topics will be removed. Continue?"
      )
    )
      return;
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

  // Filter top-level topics
  const filteredTopics = useMemo(() => {
    return d.topLevel.filter((t) => {
      const matchSearch =
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.code && t.code.toLowerCase().includes(search.toLowerCase())) ||
        t.description.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;

      const m = d.mastery.get(t.id);
      const cov = getCoverageStatus(t);

      if (filterMode === "weak") return m?.level === "weak";
      if (filterMode === "uncovered") return cov === "uncovered";
      if (filterMode === "covered") return cov === "covered";
      return true;
    });
  }, [d.topLevel, search, filterMode, d.mastery, state.chunks]);

  // Selected topic resolution
  const activeTopic = useMemo(() => {
    if (selectedTopicId) {
      return state.topics.find((t) => t.id === selectedTopicId) ?? d.topLevel[0] ?? null;
    }
    return d.topLevel[0] ?? null;
  }, [selectedTopicId, state.topics, d.topLevel]);

  const activeMastery = activeTopic ? d.mastery.get(activeTopic.id) : null;
  const activeChildren = activeTopic ? d.childrenOf(activeTopic.id) : [];
  const activeSupporting = activeTopic ? supporting(activeTopic) : [];
  const activeCoverage = activeTopic ? getCoverageStatus(activeTopic) : "uncovered";
  const assessable = activeTopic ? d.assessable.some((a) => a.id === activeTopic.id) : false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Map"
        description="Hierarchical syllabus topology mapped to your uploaded study materials. Visualizes unit coverage, diagnostic mastery, and verifiable source citations without fabricated prerequisites."
        actions={
          config.mode === "live" ? (
            <Button variant="secondary" icon={RefreshCw} loading={busy} onClick={rebuild} className="text-xs">
              {state.topics.length ? "Rebuild from Syllabus" : "Build from Syllabus"}
            </Button>
          ) : undefined
        }
      />

      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      {d.topLevel.length === 0 ? (
        <Card>
          <EmptyState icon={Network} title="No knowledge map compiled yet" action={<LinkButton href="/materials">Upload a Syllabus</LinkButton>}>
            Upload a syllabus document. Formal units (e.g., “Unit 1: Graph Algorithms”) and numbered sub-topics are structured deterministically into a verifiable topic hierarchy.
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#2A2D26] bg-[#10110F] p-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#73776E]" />
              <input
                type="text"
                placeholder="Filter topics by name, code or keyword…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-[#2A2D26] bg-[#171915] pl-9 pr-3 py-1.5 text-xs text-[#F4F5F0] placeholder:text-[#73776E] focus:border-[#D5FF32] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 text-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#73776E] mr-1 hidden sm:inline">
                Coverage:
              </span>
              {(["all", "weak", "uncovered", "covered"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFilterMode(mode)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors capitalize ${
                    filterMode === mode
                      ? "bg-[#D5FF32] text-[#080908] font-bold"
                      : "text-[#A0A39A] hover:bg-[#171915] hover:text-[#F4F5F0]"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Split Hierarchy & Inspector View */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Syllabus Tree List */}
            <div className="lg:col-span-7 space-y-3">
              {filteredTopics.map((topic) => {
                const isSelected = activeTopic?.id === topic.id;
                const m = d.mastery.get(topic.id)!;
                const cov = getCoverageStatus(topic);
                const children = d.childrenOf(topic.id);
                const supportCount = supporting(topic).length;

                return (
                  <div
                    key={topic.id}
                    onClick={() => setSelectedTopicId(topic.id)}
                    className={`group cursor-pointer rounded-xl border p-4 transition-all duration-150 ${
                      isSelected
                        ? "border-[#D5FF32] bg-[#171915] shadow-[0_0_16px_-4px_rgba(213,255,50,0.15)]"
                        : "border-[#2A2D26] bg-[#10110F] hover:border-[#3A3F33] hover:bg-[#171915]/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Coverage indicator dot */}
                          <span
                            className={`h-2 w-2 rounded-full ${
                              cov === "covered"
                                ? "bg-[#D5FF32]"
                                : cov === "partial"
                                ? "bg-[#E5A83B]"
                                : "bg-[#73776E]"
                            }`}
                            title={`Coverage: ${cov}`}
                          />
                          <h3
                            className={`text-sm font-semibold tracking-tight transition-colors ${
                              isSelected ? "text-[#D5FF32]" : "text-[#F4F5F0] group-hover:text-[#F4F5F0]"
                            }`}
                          >
                            {topic.code ? `${topic.code}. ` : ""}
                            {topic.name}
                          </h3>
                          <LevelBadge level={m.level} />
                          <ImportanceBadge importance={topic.importance} />
                        </div>

                        <p className="mt-1 text-xs text-[#A0A39A] line-clamp-2 leading-relaxed">
                          {topic.description}
                        </p>

                        <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] text-[#73776E]">
                          <span>
                            Accuracy:{" "}
                            <strong className="text-[#F4F5F0] tabular-nums font-semibold">
                              {pct(m.recentAccuracy)}
                            </strong>{" "}
                            ({m.windowAttempted} Qs)
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3 text-[#A0A39A]" /> {supportCount} passage(s)
                          </span>
                          {children.length > 0 && (
                            <>
                              <span>·</span>
                              <span>{children.length} sub-units</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {cov === "uncovered" && (
                          <span
                            className="hidden sm:inline-flex items-center gap-1 rounded bg-[#EF4444]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#F87171]"
                            title="No notes indexed for this unit"
                          >
                            <AlertTriangle className="h-3 w-3" /> Uncovered
                          </span>
                        )}
                        <ChevronRight
                          className={`h-4 w-4 transition-transform ${
                            isSelected ? "text-[#D5FF32] translate-x-0.5" : "text-[#73776E]"
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: Knowledge Inspector Drawer / Card */}
            <div className="lg:col-span-5 sticky top-20">
              {activeTopic ? (
                <Card className="border-[#2A2D26] bg-[#10110F] overflow-hidden">
                  <div className="border-b border-[#2A2D26] bg-[#171915] p-5">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#D5FF32]">
                        Unit Telemetry
                      </span>
                      {activeTopic.origin === "ai" ? (
                        <Badge tone="blue">AI Extracted</Badge>
                      ) : activeTopic.origin === "sample" ? (
                        <Badge tone="amber">Course Baseline</Badge>
                      ) : (
                        <Badge tone="slate">Syllabus Grounded</Badge>
                      )}
                    </div>
                    <h2 className="text-lg font-bold tracking-tight text-[#F4F5F0]">
                      {activeTopic.code ? `${activeTopic.code}. ` : ""}
                      {activeTopic.name}
                    </h2>
                    <p className="mt-1 text-xs text-[#A0A39A] leading-relaxed">
                      {activeTopic.description}
                    </p>
                  </div>

                  <div className="p-5 space-y-5 text-xs">
                    {/* Diagnostic Metrics */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-[#2A2D26] bg-[#171915] p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#73776E]">
                          Mastery State
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <LevelBadge level={activeMastery?.level ?? "insufficient"} />
                        </div>
                        <p className="mt-1 text-[11px] text-[#A0A39A]">
                          {pct(activeMastery?.recentAccuracy)} accuracy
                        </p>
                      </div>

                      <div className="rounded-lg border border-[#2A2D26] bg-[#171915] p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#73776E]">
                          Material Scope
                        </p>
                        <p className="mt-1 text-sm font-bold tabular-nums text-[#F4F5F0]">
                          {activeSupporting.length} passages
                        </p>
                        <p className="text-[10px] text-[#A0A39A] capitalize">
                          Coverage: <span className={activeCoverage === "covered" ? "text-[#D5FF32]" : activeCoverage === "partial" ? "text-[#E5A83B]" : "text-[#73776E]"}>{activeCoverage}</span>
                        </p>
                      </div>
                    </div>

                    {/* Insufficient notes warning */}
                    {activeSupporting.length === 0 && (
                      <div className="rounded-lg border border-[#3D3017] bg-[#19150B] p-3 text-[#FDE68A]">
                        <p className="flex items-center gap-1.5 font-semibold text-xs">
                          <AlertTriangle className="h-4 w-4 text-[#E5A83B] shrink-0" /> No Supporting Notes Indexed
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                          This unit exists in the syllabus but has no matching excerpts from your notes or textbook chapters. Upload additional materials covering this subject.
                        </p>
                      </div>
                    )}

                    {/* Sub-topics list */}
                    {activeChildren.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#73776E] mb-2">
                          Constituent Sub-Topics ({activeChildren.length})
                        </p>
                        <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {activeChildren.map((child) => {
                            const cm = d.mastery.get(child.id);
                            return (
                              <li
                                key={child.id}
                                className="flex items-center justify-between rounded-lg border border-[#2A2D26] bg-[#171915] px-3 py-2 text-xs"
                              >
                                <span className="text-[#F4F5F0] truncate font-medium">
                                  {child.code ? `${child.code} ` : ""}
                                  {child.name}
                                </span>
                                {cm && <LevelBadge level={cm.level} />}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {/* Syllabus Source Citation */}
                    {activeTopic.sourceRefs.length > 0 && (
                      <div className="border-t border-[#2A2D26]/70 pt-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#73776E] mb-1.5">
                          Syllabus Grounding
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-[#A0A39A]">
                          <BookMarked className="h-3.5 w-3.5 text-[#D5FF32]" />
                          <span>{activeTopic.sourceRefs[0].documentName}</span>
                          {activeTopic.sourceRefs[0].section && <span>· §{activeTopic.sourceRefs[0].section}</span>}
                          {activeTopic.sourceRefs[0].page && <span>· p. {activeTopic.sourceRefs[0].page}</span>}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="pt-2 flex flex-col gap-2">
                      {assessable ? (
                        <LinkButton
                          href={`/quiz?topic=${encodeURIComponent(activeTopic.id)}`}
                          icon={ListChecks}
                          className="w-full text-xs justify-center"
                        >
                          Launch Diagnostic Quiz for this Unit
                        </LinkButton>
                      ) : (
                        <div className="rounded-lg border border-[#2A2D26] bg-[#171915] p-2.5 text-center text-xs text-[#73776E]">
                          Quiz requires live AI extraction or demo syllabus
                        </div>
                      )}

                      <LinkButton
                        href={`/tutor?topic=${encodeURIComponent(activeTopic.id)}`}
                        variant="secondary"
                        icon={MessageSquareText}
                        className="w-full text-xs justify-center"
                      >
                        Ask AI Tutor About this Topic
                      </LinkButton>
                    </div>
                  </div>
                </Card>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
