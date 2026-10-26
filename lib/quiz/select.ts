// Chooses which stored questions go into a diagnostic quiz.
// Priority: never-seen questions, then previously missed ones, then the rest; balanced across topics.
import type { Difficulty, PublicQuestion } from "@/types/domain";

export interface QuestionHistoryEntry {
  questionId: string;
  isCorrect: boolean;
  at: string;
}

export interface SelectionOptions {
  count: number;
  difficulty: Difficulty | "mixed";
  topicScope: string[][]; // one array of topic IDs (topic + descendants) per selected topic
  history: QuestionHistoryEntry[];
  includeShortAnswer: boolean;
  seed?: number;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function selectQuestions<Q extends PublicQuestion>(pool: Q[], opts: SelectionOptions): Q[] {
  const rand = mulberry32(opts.seed ?? Date.now());
  const last = new Map<string, QuestionHistoryEntry>();
  for (const h of [...opts.history].sort((a, b) => a.at.localeCompare(b.at))) last.set(h.questionId, h);
  const rank = (q: Q) => {
    const h = last.get(q.id);
    const seenRank = !h ? 0 : !h.isCorrect ? 1 : 2;
    const diffRank = opts.difficulty === "mixed" || q.difficulty === opts.difficulty ? 0 : 1;
    return diffRank * 10 + seenRank + rand() * 0.5;
  };
  const eligible = pool.filter((q) => opts.includeShortAnswer || q.type === "mcq");
  const perTopic = opts.topicScope.map((scope) =>
    eligible.filter((q) => scope.includes(q.topicId)).map((q) => ({ q, r: rank(q) })).sort((a, b) => a.r - b.r)
  );
  const chosen: Q[] = [];
  const used = new Set<string>();
  // Round-robin across topics so every selected topic gets evidence.
  let progressed = true;
  while (chosen.length < opts.count && progressed) {
    progressed = false;
    for (const list of perTopic) {
      const next = list.find((x) => !used.has(x.q.id));
      if (next && chosen.length < opts.count) {
        chosen.push(next.q);
        used.add(next.q.id);
        progressed = true;
      }
    }
  }
  return chosen;
}
