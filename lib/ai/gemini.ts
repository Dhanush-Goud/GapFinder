// Google Gemini implementation of AIProvider using the public REST API (no SDK dependency).
// SERVER-ONLY: uses the API key.
import type { z } from "zod";
import { AIError, type AIProvider, type EmbeddingTask, type GenerateJsonOptions } from "./provider";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

/** HTTP status codes that indicate a transient error worth retrying. */
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
/** HTTP status codes that indicate a permanent configuration or auth error. */
const PERMANENT_STATUSES = new Set([400, 401, 403, 404]);
/** Maximum number of retries for transient errors. */
const MAX_RETRIES = 2;
/** Base delay in ms for exponential backoff. */
const BASE_DELAY_MS = 1000;

function isRetryable(status: number): boolean {
  return RETRYABLE_STATUSES.has(status);
}

function aiErrorKind(status: number): AIError["kind"] {
  if (status === 401 || status === 403) return "config";
  return "http";
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly embeddingModel: string,
    private readonly dimension: number
  ) {}

  private async post(path: string, body: unknown): Promise<unknown> {
    let lastError: AIError | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0 && lastError) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 500;
        await sleep(delay);
      }
      const res = await fetch(`${BASE}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(55_000),
      });
      if (res.ok) return res.json();
      const text = await res.text().catch(() => "");
      const kind = aiErrorKind(res.status);
      lastError = new AIError(
        `Gemini request failed (${res.status}): ${text.slice(0, 300)}`,
        kind
      );
      // Permanent errors: don't retry.
      if (PERMANENT_STATUSES.has(res.status)) throw lastError;
      // Non-retryable errors: don't retry.
      if (!isRetryable(res.status)) throw lastError;
      // Retryable error: if we have retries left, honour Retry-After header if present.
      if (attempt < MAX_RETRIES) {
        const retryAfter = res.headers.get("retry-after");
        if (retryAfter) {
          const secs = parseInt(retryAfter, 10);
          if (!Number.isNaN(secs) && secs > 0 && secs <= 30) {
            await sleep(secs * 1000);
          }
        }
      }
    }
    throw lastError!;
  }

  async generateJson<T>(schema: z.ZodType<T>, opts: GenerateJsonOptions): Promise<T> {
    let lastError = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const data = (await this.post(`models/${encodeURIComponent(this.model)}:generateContent`, {
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [
          {
            role: "user",
            parts: [{ text: attempt === 0 ? opts.prompt : `${opts.prompt}\n\nYour previous reply was invalid (${lastError}). Reply with valid JSON only.` }],
          },
        ],
        generationConfig: { responseMimeType: "application/json", temperature: opts.temperature ?? 0.2 },
      })) as {
        candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
        promptFeedback?: { blockReason?: string };
      };
      if (data.promptFeedback?.blockReason) throw new AIError(`Request blocked by the provider (${data.promptFeedback.blockReason}).`, "safety");
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      let json: unknown;
      try {
        json = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
      } catch {
        lastError = "not valid JSON";
        continue;
      }
      const parsed = schema.safeParse(json);
      if (parsed.success) return parsed.data;
      lastError = parsed.error.issues.slice(0, 2).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    }
    throw new AIError(`Model output failed validation: ${lastError}`, "invalid_output");
  }

  async embed(texts: string[], task: EmbeddingTask): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 100) {
      const batch = texts.slice(i, i + 100);
      const data = (await this.post(`models/${encodeURIComponent(this.embeddingModel)}:batchEmbedContents`, {
        requests: batch.map((text) => ({
          model: `models/${this.embeddingModel}`,
          content: { parts: [{ text: text.slice(0, 8000) }] },
          taskType: task === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
          outputDimensionality: this.dimension,
        })),
      })) as { embeddings?: { values?: number[] }[] };
      const vectors = data.embeddings?.map((e) => e.values ?? []) ?? [];
      if (vectors.length !== batch.length || vectors.some((v) => v.length !== this.dimension)) {
        throw new AIError(`Embedding response had unexpected shape (expected ${batch.length} × ${this.dimension}).`, "invalid_output");
      }
      out.push(...vectors.map(normalize));
    }
    return out;
  }
}

/** Reduced-dimension Gemini embeddings are not unit-length; normalise for cosine similarity. */
export function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((n, x) => n + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}
