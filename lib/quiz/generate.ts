// Deterministic question generation from extracted content. Used when no AI provider is configured.
// Produces MCQ questions from definitions, key terms, and factual statements found in chunks.
// Every generated question is grounded in an actual passage and includes a verifiable citation.
// The UI labels these as "rule-based" rather than AI-generated.
import type { Chunk, Citation, Difficulty, FullQuestion, Topic } from "@/types/domain";
import { citationFromChunk } from "@/lib/rag/citations";
import { contentTokens, splitSentences, excerpt } from "@/lib/rag/text";
import { shuffleOptions } from "@/lib/quiz/shuffle";

/** A candidate fact extracted from a passage. */
interface Fact {
  sentence: string;
  chunk: Chunk;
  keywords: string[];
}

/** Simple deterministic hash for seeding. */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Pick a pseudorandom element from an array using a seed. */
function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

/**
 * Extract factual sentences from chunks that are likely to contain testable definitions
 * or key statements (contains "is", "are", "means", "defined as", lists, etc.).
 */
function extractFacts(chunks: Chunk[]): Fact[] {
  const facts: Fact[] = [];
  const seenSentences = new Set<string>();

  for (const chunk of chunks) {
    const sentences = splitSentences(chunk.text);
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      // Skip too short or too long sentences, headings, bullets without substance
      if (trimmed.length < 40 || trimmed.length > 400) continue;
      if (/^[#*\-•]/.test(trimmed) && trimmed.length < 60) continue;

      const lower = trimmed.toLowerCase();
      // Look for definitional or factual patterns
      const isFactual =
        /\b(is|are|was|were|means?|defined?\s+as|refers?\s+to|known\s+as|called|consists?\s+of|involves?|requires?|uses?|provides?|allows?|enables?|ensures?|works?\s+by|operates?\s+on|stores?|returns?|takes?|has\s+a|have\s+a)\b/.test(lower) &&
        !/\b(you|your|we|our|i|my|let's|should|would|could|please|note|remember|hint)\b/.test(lower);

      if (!isFactual) continue;

      const normalized = lower.replace(/\s+/g, " ");
      if (seenSentences.has(normalized)) continue;
      seenSentences.add(normalized);

      const keywords = contentTokens(trimmed).filter((t) => t.length > 2);
      if (keywords.length < 3) continue;

      facts.push({ sentence: trimmed, chunk, keywords });
    }
  }
  return facts;
}

/** Template patterns for generating MCQ questions from a factual sentence. */
const TEMPLATES = [
  {
    pattern: /\b(\w[\w\s]{2,40}?)\s+(?:is|are)\s+(?:a|an|the)?\s*(.{15,200}?)(?:\.|$)/i,
    question: (term: string) => `What is ${term}?`,
    correct: (_term: string, def: string) => def.charAt(0).toUpperCase() + def.slice(1).replace(/\.$/, ""),
  },
  {
    pattern: /\b(\w[\w\s]{2,40}?)\s+(?:uses?|requires?|involves?)\s+(.{10,200}?)(?:\.|$)/i,
    question: (term: string) => `What does ${term} use or require?`,
    correct: (_term: string, detail: string) => detail.charAt(0).toUpperCase() + detail.slice(1).replace(/\.$/, ""),
  },
  {
    pattern: /\b(\w[\w\s]{2,40}?)\s+(?:provides?|allows?|enables?)\s+(.{10,200}?)(?:\.|$)/i,
    question: (term: string) => `What does ${term} provide or enable?`,
    correct: (_term: string, detail: string) => detail.charAt(0).toUpperCase() + detail.slice(1).replace(/\.$/, ""),
  },
  {
    pattern: /\bthe\s+(?:time|space)\s+complexity\s+(?:of|for)\s+(.{3,60}?)\s+is\s+(.{3,40}?)(?:\.|,|$)/i,
    question: (_: string, __: string, match: RegExpMatchArray) => `What is the ${match[0].includes("time") ? "time" : "space"} complexity of ${match[1].trim()}?`,
    correct: (_term: string, complexity: string) => complexity.trim(),
  },
];

/**
 * Generate plausible wrong options. Uses other facts from the same topic area to create
 * realistic distractors rather than random text.
 */
function generateDistractors(correctAnswer: string, allFacts: Fact[], seed: number, count = 3): string[] {
  const correctTokens = new Set(contentTokens(correctAnswer));
  const distractors: string[] = [];
  const used = new Set<string>([correctAnswer.toLowerCase()]);

  // Try using definitions from other facts
  for (let i = 0; i < allFacts.length && distractors.length < count; i++) {
    const idx = (seed + i * 7) % allFacts.length;
    const fact = allFacts[idx];
    for (const tmpl of TEMPLATES) {
      const match = tmpl.pattern.exec(fact.sentence);
      if (match && match[2]) {
        const candidate = match[2].trim().replace(/\.$/, "");
        const candidateLower = candidate.toLowerCase();
        if (candidate.length > 10 && candidate.length < 200 && !used.has(candidateLower)) {
          // Don't use something too similar to the correct answer
          const overlap = contentTokens(candidate).filter((t) => correctTokens.has(t)).length;
          if (overlap < correctTokens.size * 0.5) {
            distractors.push(candidate.charAt(0).toUpperCase() + candidate.slice(1));
            used.add(candidateLower);
            break;
          }
        }
      }
    }
  }

  // If we still need more, generate synthetic variations
  const fillers = [
    "A sequential search through all elements",
    "A method that operates in constant time",
    "A recursive approach with exponential complexity",
    "A structure that stores data in contiguous memory",
    "An algorithm that requires sorted input",
    "A technique that divides the problem in half",
    "A process that maintains insertion order",
    "An operation that modifies the original data",
  ];
  for (let i = 0; distractors.length < count && i < fillers.length; i++) {
    const filler = fillers[(seed + i) % fillers.length];
    if (!used.has(filler.toLowerCase())) {
      distractors.push(filler);
      used.add(filler.toLowerCase());
    }
  }

  return distractors.slice(0, count);
}

function difficultyFor(sentence: string): Difficulty {
  const words = sentence.split(/\s+/).length;
  if (words < 15) return "easy";
  if (words < 30) return "medium";
  return "hard";
}

export interface DeterministicGenerationResult {
  questions: FullQuestion[];
  /** Human-readable note about the generation method. */
  note: string;
}

/**
 * Generate deterministic MCQ questions from uploaded material chunks.
 * Each question is derived from a real sentence in the material and includes
 * a citation back to the source chunk.
 */
export function generateDeterministicQuestions(args: {
  topic: Topic;
  chunks: Chunk[];
  count: number;
  difficulty: Difficulty | "mixed";
  allChunks: Chunk[];
  makeId: () => string;
}): DeterministicGenerationResult {
  const { topic, chunks, count, difficulty, allChunks, makeId } = args;
  const topicFacts = extractFacts(chunks);
  const allFacts = extractFacts(allChunks);

  if (topicFacts.length === 0) {
    return {
      questions: [],
      note: `No testable statements found in passages linked to "${topic.name}". Upload more detailed notes covering this topic.`,
    };
  }

  const questions: FullQuestion[] = [];
  const usedSentences = new Set<string>();

  for (let i = 0; i < topicFacts.length && questions.length < count; i++) {
    const factIdx = (hash(topic.id + String(i)) + i) % topicFacts.length;
    const fact = topicFacts[factIdx];

    if (usedSentences.has(fact.sentence)) continue;

    for (const tmpl of TEMPLATES) {
      const match = tmpl.pattern.exec(fact.sentence);
      if (!match || !match[1] || !match[2]) continue;

      const questionText = typeof tmpl.question === "function"
        ? (tmpl.question as (a: string, b: string, m: RegExpMatchArray) => string)(match[1].trim(), match[2].trim(), match)
        : tmpl.question;
      const correctAnswer = tmpl.correct(match[1].trim(), match[2].trim());

      if (correctAnswer.length < 8 || correctAnswer.length > 200) continue;
      if (questionText.length < 10) continue;

      const questionDifficulty = difficulty === "mixed" ? difficultyFor(fact.sentence) : difficulty;
      const distractors = generateDistractors(correctAnswer, allFacts, hash(fact.sentence), 3);
      if (distractors.length < 3) continue;

      const id = makeId();
      const options = [correctAnswer, ...distractors];
      const citation: Citation = citationFromChunk(fact.chunk, fact.sentence);

      const fullQ: FullQuestion = {
        id,
        topicId: topic.id,
        type: "mcq",
        difficulty: questionDifficulty,
        prompt: questionText,
        options,
        citations: [citation],
        key: {
          questionId: id,
          correctOption: 0, // will be shuffled
          expectedAnswer: null,
          keyPoints: [],
          explanation: `From your notes: "${excerpt(fact.sentence, 200)}"`,
          optionRationales: {},
        },
      };

      questions.push(shuffleOptions(fullQ));
      usedSentences.add(fact.sentence);
      break;
    }
  }

  const note = questions.length > 0
    ? `${questions.length} question(s) generated from your uploaded material using rule-based extraction (no AI model). Questions are based on definitions and factual statements found in your notes.`
    : `Could not generate questions from passages linked to "${topic.name}". The material may not contain enough definitions or factual statements in a recognized format.`;

  return { questions, note };
}
