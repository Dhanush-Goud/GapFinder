// Stage 2 of the RAG pipeline: heading- and paragraph-aware chunking.
// Chunks never cross page boundaries, so every chunk has one precise page citation.
import type { Chunk } from "@/types/domain";
import type { ExtractedPage } from "./extract";
import { splitSentences } from "./text";

export interface ChunkingOptions {
  maxChars: number; // soft upper bound for one chunk
  overlapChars: number; // trailing context repeated at the start of the next chunk in the same section
  minSectionChars: number; // sections smaller than this are merged with the following sub-section
}

export const DEFAULT_CHUNKING: ChunkingOptions = { maxChars: 1400, overlapChars: 200, minSectionChars: 220 };

interface Heading {
  label: string;
  level: number;
}

/** Detects headings in notes, textbooks and syllabi. Returns null for ordinary lines. */
export function detectHeading(line: string): Heading | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 120) return null;
  const md = /^(#{1,6})\s+(.+)$/.exec(trimmed);
  if (md) return { label: md[2].trim(), level: md[1].length };
  const unit = /^(unit|module|chapter|part|section)\s+(\d+|[ivxlc]+)\b/i.exec(trimmed);
  if (unit) return { label: trimmed, level: 1 };
  const numbered = /^(\d+(?:\.\d+){0,3})\.?\s+([A-Z][^]*)$/.exec(trimmed);
  if (numbered && !/[.?!:;,]$/.test(trimmed) && trimmed.split(/\s+/).length <= 16) {
    return { label: trimmed, level: numbered[1].split(".").length };
  }
  return null;
}

interface Section {
  heading: Heading | null;
  page: number | null;
  lines: string[];
}

function splitIntoSections(pages: ExtractedPage[]): Section[] {
  const sections: Section[] = [];
  let currentHeading: Heading | null = null;
  for (const page of pages) {
    let current: Section = { heading: currentHeading, page: page.page, lines: [] };
    for (const line of page.text.split("\n")) {
      const heading = detectHeading(line);
      if (heading) {
        if (current.lines.some((l) => l.trim())) sections.push(current);
        currentHeading = heading;
        current = { heading, page: page.page, lines: [line.trim()] };
      } else {
        current.lines.push(line);
      }
    }
    if (current.lines.some((l) => l.trim())) sections.push(current);
  }
  return sections;
}

/** Merge tiny sections (e.g. syllabus sub-topic lines) into a parent group on the same page. */
function mergeSmallSections(sections: Section[], minChars: number): Section[] {
  const merged: Section[] = [];
  for (const section of sections) {
    const prev = merged[merged.length - 1];
    const prevText = prev ? prev.lines.join("\n") : "";
    const canMerge =
      prev &&
      prev.page === section.page &&
      prevText.length < minChars * 4 &&
      section.heading &&
      prev.heading &&
      section.heading.level > prev.heading.level &&
      section.lines.join("\n").length < minChars;
    if (canMerge) {
      prev.lines.push(...section.lines);
    } else {
      merged.push({ ...section, lines: [...section.lines] });
    }
  }
  return merged;
}

function packParagraphs(text: string, opts: ChunkingOptions): string[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const pieces: string[] = [];
  // Break very long paragraphs into sentence groups first.
  for (const p of paragraphs) {
    if (p.length <= opts.maxChars) {
      pieces.push(p);
      continue;
    }
    let buf = "";
    for (const sentence of splitSentences(p)) {
      if (buf && buf.length + sentence.length + 1 > opts.maxChars) {
        pieces.push(buf);
        buf = "";
      }
      buf = buf ? `${buf} ${sentence}` : sentence;
    }
    if (buf) pieces.push(buf);
  }
  const chunks: string[] = [];
  let buf = "";
  for (const piece of pieces) {
    if (buf && buf.length + piece.length + 2 > opts.maxChars) {
      chunks.push(buf);
      const tail = overlapTail(buf, opts.overlapChars);
      buf = tail ? `${tail}\n\n${piece}` : piece;
    } else {
      buf = buf ? `${buf}\n\n${piece}` : piece;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

function overlapTail(text: string, overlapChars: number): string {
  if (overlapChars <= 0) return "";
  const sentences = splitSentences(text);
  let tail = "";
  for (let i = sentences.length - 1; i >= 0; i--) {
    const next = tail ? `${sentences[i]} ${tail}` : sentences[i];
    if (next.length > overlapChars) break;
    tail = next;
  }
  return tail;
}

export function chunkDocument(
  doc: { id: string; name: string },
  pages: ExtractedPage[],
  opts: ChunkingOptions = DEFAULT_CHUNKING,
  makeId: (ordinal: number) => string = (ordinal) => `${doc.id}:c${ordinal}`
): Chunk[] {
  const sections = mergeSmallSections(splitIntoSections(pages), opts.minSectionChars);
  const chunks: Chunk[] = [];
  for (const section of sections) {
    const text = section.lines.join("\n").trim();
    if (!text) continue;
    for (const piece of packParagraphs(text, opts)) {
      chunks.push({
        id: makeId(chunks.length),
        documentId: doc.id,
        documentName: doc.name,
        ordinal: chunks.length,
        page: section.page,
        section: section.heading?.label.replace(/^#+\s*/, "") ?? null,
        text: piece,
        topicIds: [],
      });
    }
  }
  return chunks;
}

/** Leading section number such as "4.2" from "4.2 Binary search trees", if present. */
export function sectionCode(section: string | null): string | null {
  if (!section) return null;
  const m = /^(\d+(?:\.\d+)*)\b/.exec(section.trim());
  if (m) return m[1];
  const unit = /^(?:unit|module|chapter)\s+(\d+)/i.exec(section.trim());
  return unit ? unit[1] : null;
}
