// Provider-neutral AI interface. Business logic depends on this, never on a vendor SDK.
import type { z } from "zod";

export interface GenerateJsonOptions {
  system: string;
  prompt: string;
  temperature?: number;
}

export type EmbeddingTask = "document" | "query";

export interface AIProvider {
  readonly name: string;
  /** Returns parsed JSON validated against `schema`; throws AIError if the output never validates. */
  generateJson<T>(schema: z.ZodType<T>, opts: GenerateJsonOptions): Promise<T>;
  /** Returns one unit-length vector per input, each of the configured fixed dimension. */
  embed(texts: string[], task: EmbeddingTask): Promise<number[][]>;
}

export class AIError extends Error {
  constructor(message: string, public readonly kind: "config" | "http" | "invalid_output" | "safety") {
    super(message);
  }
}
