// Row ↔ domain mapping for the Supabase schema.
import type {
  Chunk, Citation, EvaluatedAnswer, MasterySnapshot, PublicQuestion, QuizAttempt, RevisionTask, StudyDocument, Topic,
} from "@/types/domain";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export const toDocument = (r: Row): StudyDocument => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  mimeType: r.mime_type,
  sizeBytes: r.size_bytes,
  uploadedAt: r.created_at,
  status: r.status,
  error: r.error,
  pageCount: r.page_count,
  chunkCount: r.chunk_count,
  embeddingStatus: r.embedding_status,
  isSample: r.is_sample,
  previewText: r.preview_text ?? "",
});

export const toChunk = (r: Row): Chunk => ({
  id: r.id,
  documentId: r.document_id,
  documentName: r.document_name,
  ordinal: r.ordinal,
  page: r.page,
  section: r.section,
  text: r.content,
  topicIds: r.topic_ids ?? [],
});

export const toTopic = (r: Row): Topic => ({
  id: r.id,
  code: r.code,
  name: r.name,
  description: r.description,
  parentId: r.parent_id,
  importance: r.importance,
  sourceRefs: r.source_refs ?? [],
  origin: r.origin,
});

export const toPublicQuestion = (r: Row): PublicQuestion => ({
  id: r.id,
  topicId: r.topic_id,
  type: r.type,
  difficulty: r.difficulty,
  prompt: r.prompt,
  options: r.options,
});

export const toTask = (r: Row): RevisionTask => ({
  id: r.id,
  day: r.day,
  topicId: r.topic_id,
  kind: r.kind,
  minutes: r.minutes,
  objective: r.objective,
  reason: r.reason,
  completed: r.completed,
  completedAt: r.completed_at,
});

export const toSnapshot = (r: Row): MasterySnapshot => ({
  attemptId: r.attempt_id,
  createdAt: r.created_at,
  topicId: r.topic_id,
  attempted: r.attempted,
  correct: Number(r.correct),
  accuracy: r.accuracy === null ? null : Number(r.accuracy),
  level: r.level,
});

export interface AnswerFeedback {
  explanation: string;
  understood: string[];
  missing: string[];
  misconceptions: string[];
  citations: Citation[];
  correctOption: number | null;
  expectedAnswer: string | null;
}

export function toEvaluatedAnswer(answer: Row, question: PublicQuestion): EvaluatedAnswer {
  const fb = (answer.feedback ?? {}) as Partial<AnswerFeedback>;
  return {
    questionId: answer.question_id,
    topicId: answer.topic_id,
    type: question.type,
    difficulty: question.difficulty,
    prompt: question.prompt,
    options: question.options,
    selectedOption: answer.selected_option,
    answerText: answer.answer_text,
    correctOption: fb.correctOption ?? null,
    expectedAnswer: fb.expectedAnswer ?? null,
    score: Number(answer.score),
    isCorrect: answer.is_correct,
    explanation: fb.explanation ?? "",
    understood: fb.understood ?? [],
    missing: fb.missing ?? [],
    misconceptions: fb.misconceptions ?? [],
    citations: fb.citations ?? [],
    evaluator: answer.evaluator,
  };
}

export function buildAttempts(attemptRows: Row[], questionRows: Row[], answerRows: Row[]): QuizAttempt[] {
  const questions = new Map(questionRows.map((q) => [q.id, toPublicQuestion(q)]));
  return attemptRows.map((a) => {
    const qs = (a.question_ids as string[]).map((id) => questions.get(id)).filter((q): q is PublicQuestion => !!q);
    const answers = answerRows.filter((r) => r.attempt_id === a.id);
    const results =
      a.status === "completed"
        ? (a.question_ids as string[])
            .map((qid) => {
              const ans = answers.find((r) => r.question_id === qid);
              const q = questions.get(qid);
              return ans && q ? toEvaluatedAnswer(ans, q) : null;
            })
            .filter((r): r is EvaluatedAnswer => !!r)
        : null;
    return {
      id: a.id,
      createdAt: a.created_at,
      completedAt: a.completed_at,
      topicIds: a.topic_ids,
      difficulty: a.difficulty,
      status: a.status,
      questions: qs,
      results,
      score: a.score === null ? null : Number(a.score),
      isSample: false,
    };
  });
}
