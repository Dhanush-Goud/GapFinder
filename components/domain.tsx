// Domain-specific presentational components (mastery badges, citations, data labels).
import { BookMarked, FileText, FlaskConical } from "lucide-react";
import type { Citation, Difficulty, MasteryLevel, TaskKind } from "@/types/domain";
import { LEVEL_LABEL } from "@/lib/diagnosis/mastery";
import { Badge } from "./ui";

export const levelTone: Record<MasteryLevel, "red" | "amber" | "green" | "slate"> = { weak: "red", medium: "amber", strong: "green", insufficient: "slate" };

export function LevelBadge({ level }: { level: MasteryLevel }) {
  return <Badge tone={levelTone[level]}>{LEVEL_LABEL[level]}</Badge>;
}

export function ImportanceBadge({ importance }: { importance: 1 | 2 | 3 | null }) {
  if (!importance) return null;
  const label = importance === 3 ? "High weightage" : importance === 2 ? "Medium weightage" : "Low weightage";
  return <Badge tone={importance === 3 ? "violet" : "slate"}>{label}</Badge>;
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return <Badge tone={difficulty === "hard" ? "violet" : difficulty === "medium" ? "blue" : "slate"}>{difficulty}</Badge>;
}

export const taskKindLabel: Record<TaskKind, string> = { study: "Study", practice: "Practice", retest: "Retest", review: "Review" };
export function TaskKindBadge({ kind }: { kind: TaskKind }) {
  const tone = kind === "retest" ? "brand" : kind === "practice" ? "blue" : kind === "review" ? "green" : "slate";
  return <Badge tone={tone}>{taskKindLabel[kind]}</Badge>;
}

export function SampleDataBadge() {
  return (
    <Badge tone="amber">
      <FlaskConical className="h-3 w-3" aria-hidden /> Example data
    </Badge>
  );
}

export function CitationList({ citations, compact }: { citations: Citation[]; compact?: boolean }) {
  if (!citations.length) return null;
  return (
    <ul className="space-y-2">
      {citations.map((c) => (
        <li key={c.chunkId} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-600">
            <FileText className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            <span>{c.documentName}</span>
            {c.section && (
              <span className="inline-flex items-center gap-1 text-slate-500">
                <BookMarked className="h-3 w-3" aria-hidden /> §{c.section}
              </span>
            )}
            {c.page && <span className="text-slate-500">p. {c.page}</span>}
          </p>
          {!compact && <p className="mt-1 text-sm leading-relaxed text-slate-700">“{c.excerpt}”</p>}
        </li>
      ))}
    </ul>
  );
}

export function pct(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : `${Math.round(n * 100)}%`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
