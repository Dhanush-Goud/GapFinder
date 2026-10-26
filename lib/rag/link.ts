// Associates chunks with syllabus topics: first by matching section numbers (e.g. "4.2"),
// then by lexical overlap with the topic name/description.
import type { Chunk, Topic } from "@/types/domain";
import { sectionCode } from "./chunk";
import { contentTokens } from "./text";

export function ancestorsOf(topicId: string, topics: Topic[]): string[] {
  const byId = new Map(topics.map((t) => [t.id, t]));
  const out: string[] = [];
  let current = byId.get(topicId);
  const guard = new Set<string>();
  while (current?.parentId && !guard.has(current.parentId)) {
    guard.add(current.parentId);
    out.push(current.parentId);
    current = byId.get(current.parentId);
  }
  return out;
}

export function descendantsOf(topicId: string, topics: Topic[]): string[] {
  const out: string[] = [];
  const stack = [topicId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const t of topics) {
      if (t.parentId === id && !out.includes(t.id)) {
        out.push(t.id);
        stack.push(t.id);
      }
    }
  }
  return out;
}

export function linkChunksToTopics(chunks: Chunk[], topics: Topic[], minOverlap = 0.6): Chunk[] {
  const byCode = new Map(topics.filter((t) => t.code).map((t) => [t.code!, t]));
  const leafTopics = topics.filter((t) => !topics.some((c) => c.parentId === t.id));
  return chunks.map((chunk) => {
    const linked = new Set<string>();
    const code = sectionCode(chunk.section);
    const codeMatch = code ? byCode.get(code) : undefined;
    if (codeMatch) {
      linked.add(codeMatch.id);
    } else {
      const chunkTokens = new Set(contentTokens(`${chunk.section ?? ""} ${chunk.text}`));
      for (const topic of leafTopics) {
        const nameTokens = Array.from(new Set(contentTokens(topic.name)));
        if (nameTokens.length === 0) continue;
        const overlap = nameTokens.filter((t) => chunkTokens.has(t)).length / nameTokens.length;
        if (overlap >= minOverlap) linked.add(topic.id);
      }
    }
    for (const id of Array.from(linked)) for (const a of ancestorsOf(id, topics)) linked.add(a);
    return { ...chunk, topicIds: Array.from(linked) };
  });
}
