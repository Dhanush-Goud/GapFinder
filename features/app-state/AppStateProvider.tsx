"use client";
// One interface for every page, two backends:
//  • live — Supabase via /api/* (persisted, authenticated)
//  • demo — browser localStorage + stateless /api/demo/* (clearly labelled, no external calls)
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  AppState, Chunk, Difficulty, DocumentKind, EvaluatedAnswer, PublicQuestion, QuizAttempt, StudyDocument, StudySettings, Topic, TutorAnswer,
} from "@/types/domain";
import type { PublicConfig } from "@/lib/config";
import { snapshotsAfterAttempt } from "@/lib/diagnosis/mastery";
import { bm25Search, filterChunks } from "@/lib/rag/lexical";
import { extractiveAnswer } from "@/lib/rag/tutor";
import { localToday } from "@/lib/revision/dates";
import { clearSampleAttempts, completeAttempt, defaultSettings, planFor, planShift, withNewPlan, type PlanShift } from "./demo-logic";

const DEMO_KEY = "gapfinder:demo-workspace:v1";
const EMPTY: AppState = { documents: [], chunks: [], topics: [], attempts: [], masteryHistory: [], settings: null, plan: null, taskHistory: [] };

export interface QuizSession {
  attemptId: string;
  createdAt: string;
  topicIds: string[];
  difficulty: Difficulty | "mixed";
  questions: PublicQuestion[];
  notes: string[];
}

export interface StartQuizInput {
  topicIds: string[];
  count: number;
  difficulty: Difficulty | "mixed";
  includeShortAnswer: boolean;
}

interface Ctx {
  config: PublicConfig;
  status: "loading" | "ready" | "error";
  error: string | null;
  state: AppState;
  lastPlanShift: PlanShift[];
  refresh(): Promise<void>;
  uploadDocument(file: File, kind: DocumentKind): Promise<StudyDocument>;
  retryDocument(id: string): Promise<void>;
  deleteDocument(id: string): Promise<void>;
  loadSamples(): Promise<string>;
  extractTopics(): Promise<string>;
  startQuiz(input: StartQuizInput): Promise<QuizSession>;
  submitQuiz(session: QuizSession, answers: { questionId: string; selectedOption?: number | null; text?: string | null }[]): Promise<QuizAttempt>;
  savePlan(settings: StudySettings): Promise<void>;
  toggleTask(id: string, completed: boolean): Promise<void>;
  askTutor(question: string, topicId: string | null): Promise<TutorAnswer>;
  clearExampleData(): Promise<void>;
  resetWorkspace(): Promise<void>;
}

const AppStateContext = createContext<Ctx | null>(null);

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init?.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = Array.isArray(body.details) ? ` (${body.details.join("; ")})` : "";
    throw new ApiError((body.error ?? `Request failed (${res.status})`) + detail, res.status, body.code);
  }
  return body as T;
}

function readDemo(): AppState | null {
  try {
    const raw = window.localStorage.getItem(DEMO_KEY);
    return raw ? (JSON.parse(raw) as AppState) : null;
  } catch {
    return null;
  }
}

function writeDemo(state: AppState) {
  try {
    window.localStorage.setItem(DEMO_KEY, JSON.stringify(state));
  } catch {
    throw new Error("Your browser's storage for this site is full. Delete some uploaded documents in the demo, or use live mode.");
  }
}

export function AppStateProvider({ config, children }: { config: PublicConfig; children: ReactNode }) {
  const demo = config.mode === "demo";
  const [state, setState] = useState<AppState>(EMPTY);
  const [status, setStatus] = useState<Ctx["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [lastPlanShift, setLastPlanShift] = useState<PlanShift[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;

  const commitDemo = useCallback((next: AppState) => {
    writeDemo(next);
    setState(next);
  }, []);

  const bootstrapDemo = useCallback(async (): Promise<AppState> => {
    const data = await api<{ documents: StudyDocument[]; chunks: Chunk[]; topics: Topic[]; sampleAttempt: QuizAttempt }>("/api/demo/bootstrap");
    const today = localToday();
    const attempts = [data.sampleAttempt];
    const base: AppState = {
      ...EMPTY,
      documents: data.documents,
      chunks: data.chunks,
      topics: data.topics,
      attempts,
      masteryHistory: snapshotsAfterAttempt(data.topics, attempts, data.sampleAttempt),
      settings: defaultSettings(today),
    };
    return { ...base, plan: planFor(base, base.settings!, today, data.sampleAttempt.id) };
  }, []);

  const refresh = useCallback(async () => {
    try {
      if (demo) {
        const stored = readDemo();
        const next = stored ?? (await bootstrapDemo());
        if (!stored) writeDemo(next);
        setState(next);
      } else {
        setState(await api<AppState>("/api/state", { cache: "no-store" }));
      }
      setError(null);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your workspace.");
      setStatus("error");
    }
  }, [demo, bootstrapDemo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<Ctx>(() => {
    const today = () => localToday();
    return {
      config,
      status,
      error,
      state,
      lastPlanShift,
      refresh,

      async uploadDocument(file, kind) {
        const form = new FormData();
        form.set("file", file);
        form.set("kind", kind);
        if (demo) {
          form.set("topics", JSON.stringify(stateRef.current.topics));
          const res = await api<{ document: StudyDocument; chunks: Chunk[]; topics: Topic[] | null }>("/api/demo/documents", { method: "POST", body: form });
          const cur = stateRef.current;
          const topics = res.topics ? [...cur.topics, ...res.topics.map((t) => ({ ...t, origin: "parsed" as const }))] : cur.topics;
          commitDemo({ ...cur, documents: [res.document, ...cur.documents], chunks: [...cur.chunks, ...res.chunks], topics });
          return res.document;
        }
        try {
          const res = await api<{ document: StudyDocument }>("/api/documents", { method: "POST", body: form });
          return res.document;
        } finally {
          await refresh();
        }
      },

      async retryDocument(id) {
        if (demo) throw new Error("Retry is only needed for stored files in live mode. Upload the file again.");
        try {
          await api(`/api/documents/${id}/retry`, { method: "POST" });
        } finally {
          await refresh();
        }
      },

      async deleteDocument(id) {
        if (demo) {
          const cur = stateRef.current;
          const doc = cur.documents.find((d) => d.id === id);
          if (doc?.isSample) throw new Error("The sample documents power the demo quiz and cannot be deleted. Use “Reset demo workspace” in Settings instead.");
          commitDemo({
            ...cur,
            documents: cur.documents.filter((d) => d.id !== id),
            chunks: cur.chunks.filter((c) => c.documentId !== id),
            topics: cur.topics.filter((t) => !t.id.startsWith(`${id}:`)),
          });
          return;
        }
        await api(`/api/documents/${id}`, { method: "DELETE" });
        await refresh();
      },

      async loadSamples() {
        if (demo) return "The sample course is already loaded in the demo workspace.";
        const r = await api<{ topics: number; chunks: number; questions: number; embeddings: string }>("/api/samples", { method: "POST" });
        await refresh();
        return `Loaded the sample course: ${r.topics} topics, ${r.chunks} passages, ${r.questions} grounded questions (embeddings: ${r.embeddings.replace("_", " ")}).`;
      },

      async extractTopics() {
        if (demo) return "In demo mode the topic map is parsed automatically when a syllabus is uploaded.";
        const r = await api<{ method: string; topics: number; linkedChunks: number; totalChunks: number }>("/api/topics/extract", { method: "POST" });
        await refresh();
        return `Built ${r.topics} topics (${r.method === "ai" ? "AI-assisted, verified against the syllabus text" : "parsed from syllabus numbering"}); ${r.linkedChunks} of ${r.totalChunks} passages linked to topics.`;
      },

      async startQuiz(input) {
        if (demo) {
          const history = stateRef.current.attempts.flatMap((a) => (a.results ?? []).map((r) => ({ questionId: r.questionId, isCorrect: r.isCorrect, at: a.completedAt ?? a.createdAt })));
          const res = await api<{ questions: PublicQuestion[]; skippedTopicIds: string[] }>("/api/demo/quiz/start", { method: "POST", body: JSON.stringify({ ...input, history }) });
          const skipped = res.skippedTopicIds.map((id) => stateRef.current.topics.find((t) => t.id === id)?.name).filter(Boolean);
          return {
            attemptId: `attempt-${crypto.randomUUID()}`,
            createdAt: new Date().toISOString(),
            topicIds: input.topicIds,
            difficulty: input.difficulty,
            questions: res.questions,
            notes: skipped.length ? [`No demo questions exist for: ${skipped.join(", ")} (uploaded topics need the live AI configuration).`] : [],
          };
        }
        const res = await api<{ attemptId: string; createdAt: string; questions: PublicQuestion[]; notes: string[] }>("/api/quiz/start", { method: "POST", body: JSON.stringify(input) });
        return { attemptId: res.attemptId, createdAt: res.createdAt, topicIds: input.topicIds, difficulty: input.difficulty, questions: res.questions, notes: res.notes };
      },

      async submitQuiz(session, answers) {
        if (demo) {
          const res = await api<{ results: EvaluatedAnswer[]; score: number }>("/api/demo/quiz/submit", {
            method: "POST",
            body: JSON.stringify({ questionIds: session.questions.map((q) => q.id), answers }),
          });
          const { state: next, shift } = completeAttempt(stateRef.current, { id: session.attemptId, createdAt: session.createdAt, topicIds: session.topicIds, difficulty: session.difficulty, questions: session.questions, results: res.results, score: res.score }, today());
          commitDemo(next);
          setLastPlanShift(shift);
          return next.attempts.find((a) => a.id === session.attemptId)!;
        }
        const previousPlan = stateRef.current.plan;
        const res = await api<{ attempt: QuizAttempt }>(`/api/quiz/${session.attemptId}/submit`, { method: "POST", body: JSON.stringify({ answers, today: today() }) });
        const latest = await api<AppState>("/api/state", { cache: "no-store" });
        setState(latest);
        setLastPlanShift(latest.plan && latest.plan.id !== previousPlan?.id ? planShift(previousPlan, latest.plan) : []);
        return res.attempt;
      },

      async savePlan(settings) {
        if (demo) {
          const cur = stateRef.current;
          const lastAttempt = cur.attempts.filter((a) => a.status === "completed").at(-1)?.id ?? null;
          const withSettings = { ...cur, settings };
          const plan = planFor(withSettings, settings, today(), lastAttempt);
          setLastPlanShift(planShift(cur.plan, plan));
          commitDemo(withNewPlan(withSettings, plan));
          return;
        }
        const previous = stateRef.current.plan;
        await api("/api/plan", { method: "PUT", body: JSON.stringify({ settings, today: today() }) });
        const latest = await api<AppState>("/api/state", { cache: "no-store" });
        setState(latest);
        setLastPlanShift(latest.plan ? planShift(previous, latest.plan) : []);
      },

      async toggleTask(id, completed) {
        if (demo) {
          const cur = stateRef.current;
          if (!cur.plan) return;
          commitDemo({
            ...cur,
            plan: { ...cur.plan, tasks: cur.plan.tasks.map((t) => (t.id === id ? { ...t, completed, completedAt: completed ? new Date().toISOString() : null } : t)) },
          });
          return;
        }
        // Optimistic update, then persist.
        setState((s) => (s.plan ? { ...s, plan: { ...s.plan, tasks: s.plan.tasks.map((t) => (t.id === id ? { ...t, completed, completedAt: completed ? new Date().toISOString() : null } : t)) } } : s));
        try {
          await api(`/api/plan/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ completed }) });
        } catch (err) {
          await refresh();
          throw err;
        }
      },

      async askTutor(question, topicId) {
        if (demo) {
          const cur = stateRef.current;
          const scope = topicId ? filterChunks(cur.chunks, { topicIds: [topicId] }) : cur.chunks;
          // Syllabus chunks only list topic names; explanations come from notes/textbooks.
          const sources = scope.filter((c) => cur.documents.find((d) => d.id === c.documentId)?.kind !== "syllabus");
          return extractiveAnswer(question, bm25Search(question, sources, 5));
        }
        return api<TutorAnswer>("/api/tutor", { method: "POST", body: JSON.stringify({ question, topicId }) });
      },

      async clearExampleData() {
        if (!demo) return;
        commitDemo(clearSampleAttempts(stateRef.current, today()));
        setLastPlanShift([]);
      },

      async resetWorkspace() {
        if (demo) {
          window.localStorage.removeItem(DEMO_KEY);
          setLastPlanShift([]);
          setStatus("loading");
          await refresh();
          return;
        }
        await api("/api/account/data", { method: "DELETE" });
        setLastPlanShift([]);
        await refresh();
      },
    };
  }, [config, status, error, state, lastPlanShift, refresh, demo, commitDemo]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): Ctx {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used inside AppStateProvider");
  return ctx;
}
