// Answer evaluation. MCQs are graded deterministically. Short answers use a keyword rubric
// unless an LLM evaluator result is supplied (see lib/ai/evaluate.ts). Evaluation is kept separate
// from mastery calculation: this module only scores individual answers.
import type { EvaluatedAnswer, FullQuestion, SubmittedAnswer } from "@/types/domain";
import { DEFAULT_MASTERY_CONFIG } from "@/lib/diagnosis/config";
import { contentTokens } from "@/lib/rag/text";

export function gradeMcq(question: FullQuestion, answer: SubmittedAnswer | undefined): EvaluatedAnswer {
  const selected = typeof answer?.selectedOption === "number" ? answer.selectedOption : null;
  const correctIdx = question.key.correctOption;
  if (correctIdx === null || !question.options) throw new Error(`Question ${question.id} has no MCQ answer key`);
  const valid = selected !== null && Number.isInteger(selected) && selected >= 0 && selected < question.options.length;
  const isCorrect = valid && selected === correctIdx;
  const misconception = !isCorrect && valid ? question.key.optionRationales[String(selected)] : undefined;
  return {
    ...baseResult(question),
    selectedOption: valid ? selected : null,
    answerText: null,
    score: isCorrect ? 1 : 0,
    isCorrect,
    understood: isCorrect ? [question.options[correctIdx]] : [],
    missing: isCorrect ? [] : [question.options[correctIdx]],
    misconceptions: misconception ? [misconception] : !valid ? ["Question left unanswered"] : [],
    evaluator: "deterministic",
  };
}

/**
 * Keyword rubric for short answers: each key point is a set of alternative phrasings
 * separated by "|"; a key point counts as covered when all content words of any alternative appear.
 * Transparent and injection-proof, but cruder than an LLM evaluator — the UI labels it.
 */
export function gradeShortHeuristic(question: FullQuestion, answer: SubmittedAnswer | undefined): EvaluatedAnswer {
  const text = (answer?.text ?? "").slice(0, 2000);
  const answerTokens = new Set(contentTokens(text));
  const understood: string[] = [];
  const missing: string[] = [];
  for (const point of question.key.keyPoints) {
    const alternatives = point.split("|").map((a) => a.trim()).filter(Boolean);
    const covered = alternatives.some((alt) => {
      const toks = contentTokens(alt);
      return toks.length > 0 && toks.every((t) => answerTokens.has(t));
    });
    (covered ? understood : missing).push(alternatives[0]);
  }
  const total = question.key.keyPoints.length || 1;
  const score = text.trim() ? Math.round((understood.length / total) * 100) / 100 : 0;
  return {
    ...baseResult(question),
    selectedOption: null,
    answerText: text || null,
    score,
    isCorrect: score >= DEFAULT_MASTERY_CONFIG.correctThreshold,
    understood,
    missing,
    misconceptions: !text.trim() ? ["Question left unanswered"] : [],
    evaluator: "keyword-heuristic",
  };
}

export function gradeDeterministic(question: FullQuestion, answer: SubmittedAnswer | undefined): EvaluatedAnswer {
  return question.type === "mcq" ? gradeMcq(question, answer) : gradeShortHeuristic(question, answer);
}

export function baseResult(q: FullQuestion) {
  return {
    questionId: q.id,
    topicId: q.topicId,
    type: q.type,
    difficulty: q.difficulty,
    prompt: q.prompt,
    options: q.options,
    correctOption: q.key.correctOption,
    expectedAnswer: q.key.expectedAnswer,
    explanation: q.key.explanation,
    citations: q.citations,
  };
}

export function attemptScore(results: EvaluatedAnswer[]): number {
  if (results.length === 0) return 0;
  return Math.round((results.reduce((n, r) => n + r.score, 0) / results.length) * 10000) / 10000;
}

/** Rejects submissions that reference questions outside the attempt, or answer one twice. */
export function checkSubmission(questionIds: string[], answers: SubmittedAnswer[]): string | null {
  const allowed = new Set(questionIds);
  const seen = new Set<string>();
  for (const a of answers) {
    if (!allowed.has(a.questionId)) return `Answer references a question that is not part of this quiz.`;
    if (seen.has(a.questionId)) return `Question answered more than once.`;
    seen.add(a.questionId);
  }
  return null;
}
