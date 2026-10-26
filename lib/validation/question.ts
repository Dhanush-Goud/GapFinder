// Validation of AI-generated questions before they are stored. Anything malformed, ambiguous,
// uncited, or not supported by its cited passages is rejected with a reason.
import { z } from "zod";
import type { Chunk, FullQuestion } from "@/types/domain";
import { isClaimSupported, validateCitations } from "@/lib/rag/citations";
import { contentTokens } from "@/lib/rag/text";
import { shuffleOptions } from "@/lib/quiz/shuffle";

export const generatedQuestionSchema = z.object({
  topicId: z.string().min(1),
  type: z.enum(["mcq", "short"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  prompt: z.string().min(15).max(500),
  options: z.array(z.string().min(1).max(200)).length(4).nullable().optional(),
  correctOption: z.number().int().min(0).max(3).nullable().optional(),
  expectedAnswer: z.string().max(600).nullable().optional(),
  keyPoints: z.array(z.string().min(2).max(120)).max(6).optional(),
  explanation: z.string().min(10).max(800),
  optionRationales: z.record(z.string(), z.string().max(300)).optional(),
  sourceChunkIds: z.array(z.string().min(1)).min(1).max(4),
});
export const generatedQuestionsSchema = z.object({ questions: z.array(z.unknown()).max(20) });
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

export interface RejectedQuestion {
  index: number;
  prompt: string;
  reasons: string[];
}

const AMBIGUOUS_OPTIONS = /^(all|none|both|neither) of (the )?(above|these)|^(a|b|c|d) and (a|b|c|d)$/i;

function normalizePrompt(p: string): string {
  return contentTokens(p).sort().join(" ");
}

export function validateGeneratedQuestions(
  raw: unknown[],
  ctx: { allowedTopicIds: string[]; retrieved: Chunk[]; existingPrompts: string[]; makeId: () => string }
): { accepted: FullQuestion[]; rejected: RejectedQuestion[] } {
  const accepted: FullQuestion[] = [];
  const rejected: RejectedQuestion[] = [];
  const seenPrompts = new Set(ctx.existingPrompts.map(normalizePrompt));

  raw.forEach((item, index) => {
    const parsed = generatedQuestionSchema.safeParse(item);
    if (!parsed.success) {
      rejected.push({
        index,
        prompt: typeof (item as { prompt?: unknown })?.prompt === "string" ? String((item as { prompt: string }).prompt) : "(unparseable)",
        reasons: parsed.error.issues.slice(0, 3).map((i) => `Schema: ${i.path.join(".") || "item"} ${i.message}`),
      });
      return;
    }
    const q = parsed.data;
    const reasons: string[] = [];
    if (!ctx.allowedTopicIds.includes(q.topicId)) reasons.push(`Unknown topic ID "${q.topicId}".`);

    const { citations, invalidIds } = validateCitations(q.sourceChunkIds, ctx.retrieved, q.prompt);
    if (invalidIds.length) reasons.push(`Cites passages that were not retrieved: ${invalidIds.join(", ")}.`);
    if (citations.length === 0) reasons.push("No valid source citation.");
    const evidence = ctx.retrieved.filter((c) => citations.some((ci) => ci.chunkId === c.id)).map((c) => c.text).join("\n");

    let claim = "";
    if (q.type === "mcq") {
      const options = q.options ?? [];
      if (options.length !== 4) reasons.push("Multiple-choice questions need exactly 4 options.");
      if (q.correctOption === null || q.correctOption === undefined) reasons.push("Missing correct option.");
      const normalized = options.map((o) => o.trim().toLowerCase());
      if (new Set(normalized).size !== normalized.length) reasons.push("Duplicate answer options.");
      if (options.some((o) => AMBIGUOUS_OPTIONS.test(o.trim()))) reasons.push('Ambiguous option such as "all of the above".');
      // The claim checked against the evidence is the question plus its keyed answer.
      if (q.correctOption !== null && q.correctOption !== undefined) claim = `${q.prompt} ${options[q.correctOption] ?? ""}`;
    } else {
      if (!q.expectedAnswer || q.expectedAnswer.length < 10) reasons.push("Short-answer question needs an expected answer.");
      if (!q.keyPoints || q.keyPoints.length < 2) reasons.push("Short-answer question needs at least 2 key points for grading.");
      claim = q.expectedAnswer ?? "";
    }
    if (claim && evidence && !isClaimSupported(claim, evidence, 0.6)) {
      reasons.push("The correct answer is not supported by the cited passages.");
    }
    const norm = normalizePrompt(q.prompt);
    if (seenPrompts.has(norm)) reasons.push("Duplicate of another question.");

    if (reasons.length) {
      rejected.push({ index, prompt: q.prompt, reasons });
      return;
    }
    seenPrompts.add(norm);
    const id = ctx.makeId();
    accepted.push(shuffleOptions({
      id,
      topicId: q.topicId,
      type: q.type,
      difficulty: q.difficulty,
      prompt: q.prompt.trim(),
      options: q.type === "mcq" ? (q.options ?? []).map((o) => o.trim()) : null,
      citations,
      key: {
        questionId: id,
        correctOption: q.type === "mcq" ? (q.correctOption ?? null) : null,
        expectedAnswer: q.type === "short" ? (q.expectedAnswer ?? null) : null,
        keyPoints: q.keyPoints ?? [],
        explanation: q.explanation.trim(),
        optionRationales: q.optionRationales ?? {},
      },
    }));
  });
  return { accepted, rejected };
}
