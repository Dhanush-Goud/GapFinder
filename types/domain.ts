// Core domain types shared by the UI, API routes, and business logic.

export type AppMode = "demo" | "live";

export type DocumentKind = "syllabus" | "notes" | "textbook" | "question_paper";
export type DocumentStatus = "processing" | "ready" | "failed";
export type EmbeddingStatus = "complete" | "not_configured" | "failed" | "pending";

export interface StudyDocument {
  id: string;
  name: string;
  kind: DocumentKind;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  status: DocumentStatus;
  error: string | null;
  pageCount: number | null;
  chunkCount: number;
  embeddingStatus: EmbeddingStatus;
  isSample: boolean;
  previewText: string;
}

export interface Chunk {
  id: string;
  documentId: string;
  documentName: string;
  ordinal: number;
  page: number | null;
  section: string | null;
  text: string;
  topicIds: string[];
}

export interface SourceRef {
  documentId: string;
  documentName: string;
  section: string | null;
  page: number | null;
}

export interface Topic {
  id: string;
  code: string | null;
  name: string;
  description: string;
  parentId: string | null;
  importance: 1 | 2 | 3 | null;
  sourceRefs: SourceRef[];
  origin: "parsed" | "ai" | "sample";
}

export type QuestionType = "mcq" | "short";
export type Difficulty = "easy" | "medium" | "hard";

export interface Citation {
  chunkId: string;
  documentId: string;
  documentName: string;
  page: number | null;
  section: string | null;
  excerpt: string;
}

/** What the browser sees before submission — never contains the answer key. */
export interface PublicQuestion {
  id: string;
  topicId: string;
  type: QuestionType;
  difficulty: Difficulty;
  prompt: string;
  options: string[] | null;
}

/** Server-only answer key. */
export interface QuestionKey {
  questionId: string;
  correctOption: number | null;
  expectedAnswer: string | null;
  keyPoints: string[];
  explanation: string;
  optionRationales: Record<string, string>;
}

export interface FullQuestion extends PublicQuestion {
  citations: Citation[];
  key: QuestionKey;
}

export interface SubmittedAnswer {
  questionId: string;
  selectedOption?: number | null;
  text?: string | null;
}

export type Evaluator = "deterministic" | "keyword-heuristic" | "llm";

export interface EvaluatedAnswer {
  questionId: string;
  topicId: string;
  type: QuestionType;
  difficulty: Difficulty;
  prompt: string;
  options: string[] | null;
  selectedOption: number | null;
  answerText: string | null;
  correctOption: number | null;
  expectedAnswer: string | null;
  score: number; // 0..1, partial credit allowed for short answers
  isCorrect: boolean;
  explanation: string;
  understood: string[];
  missing: string[];
  misconceptions: string[];
  citations: Citation[];
  evaluator: Evaluator;
}

export type AttemptStatus = "in_progress" | "completed";

export interface QuizAttempt {
  id: string;
  createdAt: string;
  completedAt: string | null;
  topicIds: string[];
  difficulty: Difficulty | "mixed";
  status: AttemptStatus;
  questions: PublicQuestion[];
  results: EvaluatedAnswer[] | null;
  score: number | null; // 0..1
  isSample: boolean;
}

export type MasteryLevel = "weak" | "medium" | "strong" | "insufficient";

export interface TopicMastery {
  topicId: string;
  attempted: number; // all-time evaluated answers
  correct: number; // all-time score sum
  accuracy: number | null; // all-time accuracy
  windowAttempted: number; // answers in recent window
  windowCorrect: number;
  recentAccuracy: number | null; // accuracy used for the label
  level: MasteryLevel;
  misconceptions: string[];
  lastAssessed: string | null;
  evidence: { questionId: string; attemptId: string; prompt: string; score: number; isCorrect: boolean }[];
}

export interface MasterySnapshot {
  attemptId: string;
  createdAt: string;
  topicId: string;
  attempted: number;
  correct: number;
  accuracy: number | null;
  level: MasteryLevel;
}

export interface StudySettings {
  examDate: string; // YYYY-MM-DD
  hoursPerDay: number;
  preferredSlot: "morning" | "afternoon" | "evening";
}

export type TaskKind = "study" | "practice" | "retest" | "review";

export interface RevisionTask {
  id: string;
  day: string; // YYYY-MM-DD
  topicId: string;
  kind: TaskKind;
  minutes: number;
  objective: string;
  reason: string;
  completed: boolean;
  completedAt: string | null;
}

export interface RevisionPlan {
  id: string;
  createdAt: string;
  basedOnAttemptId: string | null;
  settings: StudySettings;
  tasks: RevisionTask[];
  warnings: string[];
}

/** Full snapshot of a student's workspace, used by every page. */
export interface AppState {
  documents: StudyDocument[];
  chunks: Chunk[];
  topics: Topic[];
  attempts: QuizAttempt[];
  masteryHistory: MasterySnapshot[];
  settings: StudySettings | null;
  plan: RevisionPlan | null;
  /** Completed tasks from previous plans, kept for progress tracking. */
  taskHistory: RevisionTask[];
}

export interface RetrievedPassage {
  chunk: Chunk;
  score: number;
  method: "semantic" | "fulltext" | "lexical";
}

export interface TutorAnswer {
  status: "answered" | "insufficient_evidence";
  answer: string;
  citations: Citation[];
  method: "llm" | "extractive";
  retrieval: RetrievedPassage["method"] | "none";
  passagesConsidered: number;
}
