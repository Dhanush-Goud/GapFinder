import { describe, expect, it } from "vitest";
import type { Chunk } from "@/types/domain";
import { chunkDocument, detectHeading } from "@/lib/rag/chunk";
import { extractText, ExtractionError, validateUpload } from "@/lib/rag/extract";
import { citationFromChunk, isClaimSupported, validateCitations } from "@/lib/rag/citations";
import { bm25Search, isEvidenceSufficient } from "@/lib/rag/lexical";
import { extractiveAnswer } from "@/lib/rag/tutor";
import { loadSampleWorkspace } from "@/lib/demo/sample";
import { parseSyllabus } from "@/lib/syllabus/parse";

const chunk = (id: string, text: string, section = "5.2 Breadth-first search"): Chunk => ({ id, documentId: "d1", documentName: "Notes", ordinal: 0, page: 3, section, text, topicIds: [] });

describe("extraction", () => {
  it("validates type and size", () => {
    expect(() => validateUpload("a.docx", "application/vnd.openxmlformats", 10)).toThrow(ExtractionError);
    expect(() => validateUpload("a.pdf", "application/pdf", 5 * 1024 * 1024)).toThrow(/limit/);
    expect(() => validateUpload("a.txt", "text/plain", 100)).not.toThrow();
  });
  it("reports empty documents instead of treating them as success", async () => {
    await expect(extractText(new TextEncoder().encode("   \n  "), "text/plain", "blank.txt")).rejects.toThrow(/too little text/);
  });
  it("rejects a corrupt PDF with a clear message", async () => {
    await expect(extractText(new TextEncoder().encode("%PDF-1.4 not really a pdf"), "application/pdf", "bad.pdf")).rejects.toThrow(ExtractionError);
  });
});

describe("chunking", () => {
  it("detects markdown, unit and numbered headings but not sentences", () => {
    expect(detectHeading("## 2.1 Singly linked lists")?.label).toBe("2.1 Singly linked lists");
    expect(detectHeading("Unit 3: Stacks and Queues (Weightage: Medium)")?.level).toBe(1);
    expect(detectHeading("4.2 Binary search trees")?.level).toBe(2);
    expect(detectHeading("A stack is a collection that follows LIFO order.")).toBeNull();
  });
  it("keeps page numbers and never crosses pages", () => {
    const chunks = chunkDocument({ id: "d", name: "Book" }, [
      { page: 1, text: "# 1 Intro\nPage one text about arrays and memory." },
      { page: 2, text: "Page two text continues the arrays discussion with indexing." },
    ]);
    expect(chunks.map((c) => c.page)).toEqual([1, 2]);
    expect(chunks[1].section).toBe("1 Intro"); // heading carries across the page break
  });
  it("splits long sections with overlap", () => {
    const sentence = "Linked lists store nodes connected by references to the next node. ";
    const chunks = chunkDocument({ id: "d", name: "N" }, [{ page: null, text: `## 2.1 Lists\n${sentence.repeat(60)}` }], { maxChars: 600, overlapChars: 120, minSectionChars: 100 });
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.every((c) => c.text.length <= 800)).toBe(true);
    expect(chunks[1].text.startsWith("Linked lists store")).toBe(true);
  });
});

describe("syllabus parsing", () => {
  it("does not invent topics from text without structure", () => {
    const parsed = parseSyllabus([{ page: null, text: "This course is about many interesting things.\nWe will learn a lot." }], { id: "s", name: "S" });
    expect(parsed.topics).toEqual([]);
  });
  it("ignores numbered lines that have no unit above them", () => {
    const parsed = parseSyllabus([{ page: null, text: "1.1 Orphan line" }], { id: "s", name: "S" });
    expect(parsed.topics).toEqual([]);
  });
});

describe("citation validation", () => {
  const retrieved = [chunk("c1", "BFS uses a queue and marks vertices visited when they are enqueued."), chunk("c2", "DFS uses a stack.")];
  it("accepts only chunk IDs from the retrieved set", () => {
    const v = validateCitations(["c1", "made-up-id", "c1"], retrieved);
    expect(v.citations.map((c) => c.chunkId)).toEqual(["c1"]);
    expect(v.invalidIds).toEqual(["made-up-id"]);
  });
  it("builds citations from stored metadata, not model text", () => {
    expect(citationFromChunk(retrieved[0])).toMatchObject({ documentName: "Notes", page: 3, section: "5.2 Breadth-first search" });
  });
  it("detects claims the evidence does not support", () => {
    expect(isClaimSupported("BFS marks vertices visited when enqueued", retrieved[0].text)).toBe(true);
    expect(isClaimSupported("Dijkstra relaxes weighted edges with a priority heap", retrieved[0].text)).toBe(false);
  });
});

describe("retrieval and insufficient evidence", () => {
  const ws = loadSampleWorkspace();
  const notes = ws.chunks.filter((c) => c.documentId === "sample-notes");
  it("retrieves the relevant section for a question", () => {
    const top = bm25Search("why does inserting at the front of an array cost O(n) shifting", notes, 3);
    expect(top[0].chunk.section).toMatch(/^1\.2/);
  });
  it("answers from sources with citations when evidence is sufficient", () => {
    const q = "When should BFS mark a vertex as visited?";
    const ans = extractiveAnswer(q, bm25Search(q, notes, 5));
    expect(ans.status).toBe("answered");
    expect(ans.citations[0].section).toMatch(/^5\.2/);
    expect(ans.answer).toMatch(/enqueued/);
  });
  it("refuses when the material does not cover the question", () => {
    const q = "Explain photosynthesis in chloroplasts";
    const passages = bm25Search(q, notes, 5);
    expect(isEvidenceSufficient(q, passages)).toBe(false);
    expect(extractiveAnswer(q, passages).status).toBe("insufficient_evidence");
  });
});
