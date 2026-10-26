import { describe, expect, it } from "vitest";
import { loadSampleWorkspace, demoQuestionBank, buildSampleAttempt } from "@/lib/demo/sample";
import { QUESTION_BANK } from "@/lib/demo/bank";
import { isClaimSupported } from "@/lib/rag/citations";

describe("sample workspace (real pipeline over sample files)", () => {
  const ws = loadSampleWorkspace();

  it("parses the syllabus into 6 units with 18 sub-topics", () => {
    expect(ws.topics.filter((t) => t.parentId === null).map((t) => t.name)).toEqual([
      "Arrays", "Linked Lists", "Stacks and Queues", "Trees", "Graphs", "Recursion",
    ]);
    expect(ws.topics.filter((t) => t.parentId !== null)).toHaveLength(18);
    expect(ws.topics.find((t) => t.code === "1")?.importance).toBe(3);
  });

  it("chunks the notes one section per chunk, linked to the matching topic and its unit", () => {
    const notes = ws.chunks.filter((c) => c.documentId === "sample-notes");
    expect(notes.length).toBeGreaterThanOrEqual(18);
    const bst = notes.find((c) => c.section?.startsWith("4.2"));
    expect(bst?.topicIds.sort()).toEqual(["u4", "u4.2"]);
  });

  it("every bank question resolves to a real chunk citation", () => {
    const bank = demoQuestionBank();
    expect(bank).toHaveLength(QUESTION_BANK.length);
    const ids = new Set(ws.chunks.map((c) => c.id));
    for (const q of bank) {
      expect(q.citations.length).toBe(1);
      expect(ids.has(q.citations[0].chunkId)).toBe(true);
    }
  });

  it("every bank answer is supported by its cited passage (grounding check)", () => {
    const bank = demoQuestionBank();
    const unsupported = bank.filter((q) => {
      const chunk = ws.chunks.find((c) => c.id === q.citations[0].chunkId)!;
      const claim = q.type === "mcq" ? `${q.prompt} ${q.options![q.key.correctOption!]}` : q.key.expectedAnswer!;
      return !isClaimSupported(claim, chunk.text);
    });
    expect(unsupported.map((q) => q.id)).toEqual([]);
  });

  it("builds an example attempt graded by the real grader and flagged as sample", () => {
    const a = buildSampleAttempt();
    expect(a.isSample).toBe(true);
    expect(a.results).toHaveLength(21);
    expect(a.results!.filter((r) => r.isCorrect)).toHaveLength(12);
  });
});
