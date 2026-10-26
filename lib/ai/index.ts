// Returns the configured AI provider, or null when none is configured (demo mode or no key).
import { EMBEDDING_DIMENSION, getServerConfig } from "@/lib/config";
import { GeminiProvider } from "./gemini";
import type { AIProvider } from "./provider";

export function getAIProvider(): AIProvider | null {
  const { ai } = getServerConfig();
  if (!ai) return null;
  return new GeminiProvider(ai.apiKey, ai.model, ai.embeddingModel, EMBEDDING_DIMENSION);
}

export { AIError } from "./provider";
export type { AIProvider } from "./provider";
