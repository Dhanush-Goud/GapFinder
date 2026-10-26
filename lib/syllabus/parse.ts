// Deterministic syllabus parser. Recognises "Unit 3: Title (Weightage: High)" style units and
// "3.2 Sub-topic - description" lines. It never invents topics: everything comes from syllabus lines.
import type { SourceRef, Topic } from "@/types/domain";
import type { ExtractedPage } from "@/lib/rag/extract";

const UNIT_RE = /^(?:unit|module|chapter|part)\s+(\d+)\s*[:.\-–—]?\s*(.+)$/i;
const SUB_RE = /^(\d+)\.(\d+)\.?\s+(.+)$/;
const WEIGHT_RE = /\((?:weightage|weight|importance|priority)\s*[:\-]?\s*(high|medium|low)\)/i;

function importanceFrom(text: string): 1 | 2 | 3 | null {
  const m = WEIGHT_RE.exec(text);
  if (!m) return null;
  return m[1].toLowerCase() === "high" ? 3 : m[1].toLowerCase() === "medium" ? 2 : 1;
}

function splitTitle(raw: string): { name: string; description: string } {
  const cleaned = raw.replace(WEIGHT_RE, "").trim();
  const parts = cleaned.split(/\s+[-–—:]\s+/);
  const name = parts[0].trim().replace(/[.;]$/, "");
  const description = parts.slice(1).join(" - ").trim();
  return { name, description };
}

export interface ParsedSyllabus {
  topics: Topic[];
  /** Number of syllabus lines that were recognised. Used to decide whether parsing succeeded. */
  recognisedLines: number;
}

export function parseSyllabus(
  pages: ExtractedPage[],
  doc: { id: string; name: string },
  makeId: (code: string) => string = (code) => `u${code}`
): ParsedSyllabus {
  const topics: Topic[] = [];
  const unitByNumber = new Map<string, Topic>();
  let currentUnit: Topic | null = null;
  let recognisedLines = 0;

  for (const page of pages) {
    for (const rawLine of page.text.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      const ref: SourceRef = { documentId: doc.id, documentName: doc.name, section: line.slice(0, 80), page: page.page };
      const unit = UNIT_RE.exec(line);
      if (unit) {
        const { name, description } = splitTitle(unit[2]);
        const topic: Topic = {
          id: makeId(unit[1]),
          code: unit[1],
          name,
          description, // filled from sub-topics below when the unit line has none
          parentId: null,
          importance: importanceFrom(line),
          sourceRefs: [ref],
          origin: "parsed",
        };
        if (!unitByNumber.has(unit[1])) {
          topics.push(topic);
          unitByNumber.set(unit[1], topic);
        }
        currentUnit = unitByNumber.get(unit[1])!;
        recognisedLines++;
        continue;
      }
      const sub = SUB_RE.exec(line);
      if (sub) {
        const parent = unitByNumber.get(sub[1]) ?? currentUnit;
        if (!parent) continue; // a numbered line with no unit above it is not trusted as structure
        const code = `${sub[1]}.${sub[2]}`;
        if (topics.some((t) => t.code === code)) continue;
        const { name, description } = splitTitle(sub[3]);
        topics.push({
          id: makeId(code),
          code,
          name,
          description: description || name,
          parentId: parent.id,
          importance: importanceFrom(line) ?? parent.importance,
          sourceRefs: [ref],
          origin: "parsed",
        });
        recognisedLines++;
      }
    }
  }
  // A unit without its own description is described by its listed sub-topics (still syllabus text).
  for (const t of topics) {
    if (t.parentId === null && !t.description) {
      const subs = topics.filter((c) => c.parentId === t.id).map((c) => c.name.toLowerCase());
      t.description = subs.length ? `${subs.join(", ")}` : t.name;
    }
  }
  return { topics, recognisedLines };
}

export function isUsableTopicMap(parsed: ParsedSyllabus): boolean {
  return parsed.topics.filter((t) => t.parentId === null).length >= 2;
}
