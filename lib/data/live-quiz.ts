// Live quiz flow: select or generate grounded questions, create attempts, grade, record mastery.
// Answer keys are read and grades written with the admin client, always scoped by user_id.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Chunk, Difficulty, EvaluatedAnswer, FullQuestion, PublicQuestion, SubmittedAnswer, Topic } from "@/types/domain";
import type { AIProvider } from "@/lib/ai/provider";
import { evaluateShortAnswerWithAI, generateQuestionsFromPassages } from "@/lib/ai/tasks";
import { HttpError } from "@/lib/api/respond";
import { snapshotsAfterAttempt } from "@/lib/diagnosis/mastery";
import { attemptScore, checkSubmission, gradeDeterministic } from "@/lib/evaluation/grade";
import { descendantsOf } from "@/lib/rag/link";
import { selectQuestions } from "@/lib/quiz/select";
import { createAdminClient } from "@/lib/supabase/server";
import { validateGeneratedQuestions, type RejectedQuestion } from "@/lib/validation/question";
import type { AnswerFeedback } from "./live-mappers";
import { toChunk, toPublicQuestion, toTopic } from "./live-mappers";
import { retrieveLive } from "./live-retrieval";
import { loadAttempts } from "./live-state";
import { regeneratePlanLive } from "./live-plan";

export async function saveQuestions(userId: string, questions: FullQuestion[], origin: "sample" | "generated") {
  if (!questions.length) return;
  const admin = createAdminClient();
  const { error } = await admin.from("questions").insert(
    questions.map((q) => ({
      id: q.id, user_id: userId, topic_id: q.topicId, type: q.type, difficulty: q.difficulty,
      prompt: q.prompt, options: q.options, citations: q.citations, origin,
    }))
  );
  if (error) throw new Error(`Saving questions failed: ${error.message}`);
  const { error: keyError } = await admin.from("question_keys").insert(
    questions.map((q) => ({
      question_id: q.id, user_id: userId, correct_option: q.key.correctOption, expected_answer: q.key.expectedAnswer,
      key_points: q.key.keyPoints, explanation: q.key.explanation, option_rationales: q.key.optionRationales,
    }))
  );
  if (keyError) throw new Error(`Saving answer keys failed: ${keyError.message}`);
}

async function topicPassages(db: SupabaseClient, ai: AIProvider | null, topic: Topic, scope: string[]): Promise<Chunk[]> {
  const retrieved = await retrieveLive(db, ai, `${topic.name}. ${topic.description}`, { topicIds: scope, k: 6 });
  if (retrieved.length) return retrieved.map((r) => r.chunk);
  // Fall back to chunks linked to the topic during ingestion.
  const { data } = await db.from("document_chunks").select("*").overlaps("topic_ids", scope).limit(6);
  return (data ?? []).map(toChunk);
}

export async function startQuizLive(
  db: SupabaseClient,
  ai: AIProvider | null,
  userId: string,
  input: { topicIds: string[]; count: number; difficulty: Difficulty | "mixed"; includeShortAnswer: boolean }
) {
  const { data: topicRows, error } = await db.from("topics").select("*").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const topics = (topicRows ?? []).map(toTopic);
  const selectedTopics = input.topicIds.map((id) => topics.find((t) => t.id === id)).filter((t): t is Topic => !!t);
  if (selectedTopics.length !== input.topicIds.length) throw new HttpError(404, "One or more topics were not found.");
  const scopes = selectedTopics.map((t) => [t.id, ...descendantsOf(t.id, topics)]);
  const allScope = Array.from(new Set(scopes.flat()));

  const { data: poolRows } = await db.from("questions").select("id, topic_id, type, difficulty, prompt, options").eq("user_id", userId).in("topic_id", allScope);
  let pool: PublicQuestion[] = (poolRows ?? []).map(toPublicQuestion);
  const { data: historyRows } = await db.from("student_answers").select("question_id, is_correct, created_at").eq("user_id", userId);
  const history = (historyRows ?? []).map((h) => ({ questionId: h.question_id, isCorrect: h.is_correct, at: h.created_at }));
  const unseen = (scope: string[]) => pool.filter((q) => scope.includes(q.topicId) && !history.some((h) => h.questionId === q.id)).length;

  const notes: string[] = [];
  const rejected: RejectedQuestion[] = [];
  const perTopicTarget = Math.ceil(input.count / selectedTopics.length);
  if (ai) {
    for (let i = 0; i < selectedTopics.length; i++) {
      const missing = perTopicTarget - unseen(scopes[i]);
      if (missing <= 0) continue;
      const passages = await topicPassages(db, ai, selectedTopics[i], scopes[i]);
      if (passages.length === 0) {
        notes.push(`No source passages are linked to “${selectedTopics[i].name}”, so no new questions could be generated.`);
        continue;
      }
      const raw = await generateQuestionsFromPassages(ai, {
        topic: selectedTopics[i], passages, count: Math.min(missing + 1, 8), difficulty: input.difficulty, includeShort: input.includeShortAnswer,
      });
      const validated = validateGeneratedQuestions(
        raw.map((q) => ({ ...(q as object), topicId: selectedTopics[i].id })),
        { allowedTopicIds: scopes[i], retrieved: passages, existingPrompts: pool.map((q) => q.prompt), makeId: () => crypto.randomUUID() }
      );
      rejected.push(...validated.rejected);
      await saveQuestions(userId, validated.accepted, "generated");
      pool = pool.concat(validated.accepted.map(({ id, topicId, type, difficulty, prompt, options }) => ({ id, topicId, type, difficulty, prompt, options })));
    }
  } else if (selectedTopics.some((_, i) => unseen(scopes[i]) === 0)) {
    notes.push("The AI provider is not configured, so only stored questions can be used.");
  }
  if (rejected.length) notes.push(`${rejected.length} generated question(s) failed validation and were discarded.`);

  const selected = selectQuestions(pool, { count: input.count, difficulty: input.difficulty, includeShortAnswer: input.includeShortAnswer, history, topicScope: scopes });
  if (selected.length < 3) {
    throw new HttpError(
      422,
      `Not enough grounded questions for this selection (${selected.length} available). ${ai ? "Upload more material covering these topics." : "Load the sample materials or configure GEMINI_API_KEY to generate questions from your uploads."}`,
      "insufficient_evidence"
    );
  }
  const admin = createAdminClient();
  const { data: attempt, error: attemptError } = await admin
    .from("quiz_attempts")
    .insert({ user_id: userId, topic_ids: input.topicIds, difficulty: input.difficulty, question_ids: selected.map((q) => q.id) })
    .select("id, created_at")
    .single();
  if (attemptError) throw new Error(attemptError.message);
  return { attemptId: attempt.id as string, createdAt: attempt.created_at as string, questions: selected, notes, rejected };
}

export async function submitQuizLive(db: SupabaseClient, ai: AIProvider | null, userId: string, attemptId: string, answers: SubmittedAnswer[], today: string) {
  const admin = createAdminClient();
  const { data: attempt } = await admin.from("quiz_attempts").select("*").eq("id", attemptId).eq("user_id", userId).maybeSingle();
  if (!attempt) throw new HttpError(404, "Quiz attempt not found.");
  if (attempt.status === "completed") throw new HttpError(409, "This quiz has already been submitted.");
  const questionIds = attempt.question_ids as string[];
  const problem = checkSubmission(questionIds, answers);
  if (problem) throw new HttpError(400, problem);

  const { data: qRows } = await admin.from("questions").select("*").eq("user_id", userId).in("id", questionIds);
  const { data: kRows } = await admin.from("question_keys").select("*").eq("user_id", userId).in("question_id", questionIds);
  const questions: FullQuestion[] = (qRows ?? []).map((q) => {
    const k = (kRows ?? []).find((r) => r.question_id === q.id);
    if (!k) throw new Error(`Missing answer key for question ${q.id}`);
    return {
      ...toPublicQuestion(q),
      citations: q.citations,
      key: { questionId: q.id, correctOption: k.correct_option, expectedAnswer: k.expected_answer, keyPoints: k.key_points, explanation: k.explanation, optionRationales: k.option_rationales },
    };
  });

  const results: EvaluatedAnswer[] = [];
  for (const id of questionIds) {
    const q = questions.find((x) => x.id === id);
    if (!q) continue;
    const answer = answers.find((a) => a.questionId === id);
    if (q.type === "short" && ai && answer?.text?.trim()) {
      const { data: srcRows } = await db.from("document_chunks").select("*").in("id", q.citations.map((c) => c.chunkId));
      results.push(await evaluateShortAnswerWithAI(ai, q, answer.text, (srcRows ?? []).map(toChunk)));
    } else {
      results.push(gradeDeterministic(q, answer));
    }
  }

  const { error: insertError } = await admin.from("student_answers").insert(
    results.map((r) => {
      const feedback: AnswerFeedback = {
        explanation: r.explanation, understood: r.understood, missing: r.missing, misconceptions: r.misconceptions,
        citations: r.citations, correctOption: r.correctOption, expectedAnswer: r.expectedAnswer,
      };
      return {
        user_id: userId, attempt_id: attemptId, question_id: r.questionId, topic_id: r.topicId,
        selected_option: r.selectedOption, answer_text: r.answerText, score: r.score, is_correct: r.isCorrect,
        evaluator: r.evaluator, feedback,
      };
    })
  );
  // The unique (attempt_id, question_id) constraint rejects a concurrent duplicate submission.
  if (insertError) {
    if (insertError.code === "23505") throw new HttpError(409, "This quiz has already been submitted.");
    throw new Error(insertError.message);
  }
  const score = attemptScore(results);
  const completedAt = new Date().toISOString();
  const { data: updated } = await admin
    .from("quiz_attempts")
    .update({ status: "completed", score, completed_at: completedAt })
    .eq("id", attemptId)
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .select("id");
  if (!updated?.length) throw new HttpError(409, "This quiz has already been submitted.");

  // Recalculate mastery from all of the student's answers and record a snapshot.
  const { data: topicRows } = await admin.from("topics").select("*").eq("user_id", userId);
  const topics = (topicRows ?? []).map(toTopic);
  const attempts = await loadAttempts(admin, userId);
  const thisAttempt = attempts.find((a) => a.id === attemptId)!;
  const snapshots = snapshotsAfterAttempt(topics, attempts, thisAttempt);
  if (snapshots.length) {
    const { error: snapError } = await admin.from("topic_mastery_history").insert(
      snapshots.map((s) => ({ user_id: userId, attempt_id: attemptId, topic_id: s.topicId, attempted: s.attempted, correct: s.correct, accuracy: s.accuracy, level: s.level, created_at: s.createdAt }))
    );
    if (snapError) throw new Error(snapError.message);
  }
  const replanned = await regeneratePlanLive(db, userId, topics, attempts, today, attemptId).catch((err) => {
    console.warn("[gapfinder] re-planning after quiz failed:", err);
    return false;
  });
  return { attempt: thisAttempt, replanned };
}
