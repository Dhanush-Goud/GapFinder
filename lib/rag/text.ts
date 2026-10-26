// Small text utilities shared by chunking, lexical retrieval and grounding checks.

const STOPWORDS = new Set(
  (
    "a an and are as at be been but by can do does each for from has have how if in into is it its " +
    "of on or so such than that the their them then there these this those to was were what when " +
    "where which while who why will with you your i me my we our us he she they his her not no yes " +
    "also only just very more most less much many any all some one two use used using about after before " +
    "between both during same other own over under again further once here should would could may might " +
    "must shall explain describe define what's whats tell give"
  ).split(/\s+/)
);

export function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/** Lower-case word tokens with light stemming; keeps tokens like o(n) meaningful as "o", "n". */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(stem);
}

export function contentTokens(text: string): string[] {
  return tokenize(text).filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Very light suffix stripping so "pointers"/"pointer", "queues"/"queue" match. */
export function stem(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith("ies") && token.length > 4) return token.slice(0, -3) + "y";
  if (token.endsWith("sses")) return token.slice(0, -2);
  if (token.endsWith("es") && /(ch|sh|x|ss|z)es$/.test(token)) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss") && !token.endsWith("us") && !token.endsWith("is")) return token.slice(0, -1);
  return token;
}

/** Fraction of the content tokens in `claim` that appear in `evidence`. */
export function tokenCoverage(claim: string, evidence: string): number {
  const claimTokens = Array.from(new Set(contentTokens(claim)));
  if (claimTokens.length === 0) return 0;
  const evidenceTokens = new Set(contentTokens(evidence));
  const hit = claimTokens.filter((t) => evidenceTokens.has(t)).length;
  return hit / claimTokens.length;
}

export function excerpt(text: string, max = 280): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd() + "…";
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
