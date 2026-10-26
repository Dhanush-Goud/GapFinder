// Builds the sample DSA workspace from the files in /sample-materials. SERVER-ONLY.
// Runs the same extraction → chunking → topic parsing → linking code used for real uploads.
import fs from "node:fs";
import path from "node:path";
import type { Chunk, FullQuestion, QuizAttempt, StudyDocument, SubmittedAnswer, Topic } from "@/types/domain";
import { chunkDocument, sectionCode } from "@/lib/rag/chunk";
import { citationFromChunk } from "@/lib/rag/citations";
import { linkChunksToTopics } from "@/lib/rag/link";
import { normalizeWhitespace } from "@/lib/rag/text";
import { parseSyllabus } from "@/lib/syllabus/parse";
import { attemptScore, gradeDeterministic } from "@/lib/evaluation/grade";
import { QUESTION_BANK, type BankQuestion } from "./bank";
import { shuffleOptions } from "@/lib/quiz/shuffle";

export const SAMPLE_FILES = [
  { id: "sample-syllabus", file: "dsa-syllabus.txt", name: "DSA Syllabus (sample).txt", kind: "syllabus" as const },
  { id: "sample-notes", file: "dsa-notes.txt", name: "DSA Study Notes (sample).txt", kind: "notes" as const },
];

export function readSampleFile(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), "sample-materials", file), "utf8");
}

export interface SampleWorkspace {
  documents: StudyDocument[];
  chunks: Chunk[];
  topics: Topic[];
}

let cached: SampleWorkspace | null = null;

export function loadSampleWorkspace(): SampleWorkspace {
  if (cached) return cached;
  const now = new Date().toISOString();
  const documents: StudyDocument[] = [];
  let chunks: Chunk[] = [];
  let topics: Topic[] = [];
  for (const f of SAMPLE_FILES) {
    const text = readSampleFile(f.file);
    const pages = [{ page: null, text: normalizeWhitespace(text) }];
    const docChunks = chunkDocument({ id: f.id, name: f.name }, pages);
    if (f.kind === "syllabus") {
      topics = parseSyllabus(pages, { id: f.id, name: f.name }).topics.map((t) => ({ ...t, origin: "sample" as const }));
    }
    chunks = chunks.concat(docChunks);
    documents.push({
      id: f.id,
      name: f.name,
      kind: f.kind,
      mimeType: "text/plain",
      sizeBytes: Buffer.byteLength(text),
      uploadedAt: now,
      status: "ready",
      error: null,
      pageCount: null,
      chunkCount: docChunks.length,
      embeddingStatus: "not_configured",
      isSample: true,
      previewText: text.slice(0, 1200),
    });
  }
  chunks = linkChunksToTopics(chunks, topics);
  cached = { documents, chunks, topics };
  return cached;
}

/** Resolves bank questions against stored chunks/topics. Throws if any citation cannot be resolved. */
export function resolveBankQuestions(
  chunks: Chunk[],
  topicIdForCode: (code: string) => string | undefined,
  questionIdFor: (q: BankQuestion) => string = (q) => q.id,
  notesDocumentId = "sample-notes"
): FullQuestion[] {
  return QUESTION_BANK.map((q) => {
    const chunk = chunks.find((c) => c.documentId === notesDocumentId && sectionCode(c.section) === q.sectionCode);
    const topicId = topicIdForCode(q.topicCode);
    if (!chunk || !topicId) throw new Error(`Bank question ${q.id} cannot be resolved (section ${q.sectionCode}).`);
    const id = questionIdFor(q);
    const focus = q.type === "mcq" ? `${q.prompt} ${q.options![q.correctOption!]}` : q.expectedAnswer!;
    return shuffleOptions({
      id,
      topicId,
      type: q.type,
      difficulty: q.difficulty,
      prompt: q.prompt,
      options: q.options ?? null,
      citations: [citationFromChunk(chunk, focus)],
      key: {
        questionId: id,
        correctOption: q.correctOption ?? null,
        expectedAnswer: q.expectedAnswer ?? null,
        keyPoints: q.keyPoints ?? [],
        explanation: q.explanation,
        optionRationales: Object.fromEntries(Object.entries(q.rationales ?? {}).map(([k, v]) => [String(k), v])),
      },
    }, q.id); // seeded by the bank ID so positions are stable across demo and live
  });
}

let bankCache: FullQuestion[] | null = null;
export function demoQuestionBank(): FullQuestion[] {
  if (bankCache) return bankCache;
  const ws = loadSampleWorkspace();
  bankCache = resolveBankQuestions(ws.chunks, (code) => ws.topics.find((t) => t.code === code)?.id);
  return bankCache;
}

/**
 * An example attempt by a fictional student, graded by the real grader. Always flagged isSample
 * and labelled "Example data" in the UI; users can clear it in Settings.
 */
export function buildSampleAttempt(): QuizAttempt {
  const bank = demoQuestionBank();
  const plan: Record<string, "right" | "wrong"> = {
    "q-arr-1": "right", "q-arr-2": "right", "q-arr-3": "right", "q-arr-4": "right",
    "q-ll-1": "right", "q-ll-2": "wrong", "q-ll-3": "right", "q-ll-5": "wrong",
    "q-tr-1": "right", "q-tr-2": "wrong", "q-tr-3": "right", "q-tr-4": "wrong", "q-tr-5": "right",
    "q-gr-1": "right", "q-gr-2": "wrong", "q-gr-3": "wrong", "q-gr-4": "wrong",
    "q-rc-1": "right", "q-rc-2": "wrong", "q-rc-4": "wrong",
    "q-sq-1": "right",
  };
  const questions = bank.filter((q) => plan[q.id]);
  const answers: SubmittedAnswer[] = questions.map((q) => ({
    questionId: q.id,
    selectedOption: plan[q.id] === "right" ? q.key.correctOption : (q.key.correctOption! + 1) % 4, // a deterministic wrong choice
  }));
  const results = questions.map((q) => gradeDeterministic(q, answers.find((a) => a.questionId === q.id)));
  const completedAt = new Date(Date.now() - 2 * 86_400_000).toISOString();
  return {
    id: "sample-attempt-1",
    createdAt: completedAt,
    completedAt,
    topicIds: Array.from(new Set(questions.map((q) => q.topicId))),
    difficulty: "mixed",
    status: "completed",
    questions: questions.map(({ id, topicId, type, difficulty, prompt, options }) => ({ id, topicId, type, difficulty, prompt, options })),
    results,
    score: attemptScore(results),
    isSample: true,
  };
}
