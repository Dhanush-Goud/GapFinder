// Deterministic option shuffling so the correct answer's position carries no signal.
// The answer key and per-option misconception rationales are remapped with the options.
import type { FullQuestion } from "@/types/domain";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shuffleOptions(q: FullQuestion, seed: string = q.id): FullQuestion {
  if (q.type !== "mcq" || !q.options || q.key.correctOption === null) return q;
  const order = q.options.map((_, i) => i);
  let h = hash(seed);
  for (let i = order.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    const j = h % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const newIndexOf = new Map(order.map((oldIdx, newIdx) => [oldIdx, newIdx]));
  return {
    ...q,
    options: order.map((oldIdx) => q.options![oldIdx]),
    key: {
      ...q.key,
      correctOption: newIndexOf.get(q.key.correctOption)!,
      optionRationales: Object.fromEntries(Object.entries(q.key.optionRationales).map(([k, v]) => [String(newIndexOf.get(Number(k))), v])),
    },
  };
}
