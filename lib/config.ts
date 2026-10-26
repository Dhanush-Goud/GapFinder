// Server-side environment configuration, validated once. Never import this from client components.
import { z } from "zod";
import type { AppMode } from "@/types/domain";

const envSchema = z.object({
  APP_MODE: z.enum(["auto", "demo", "live"]).default("auto"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("gemini-2.5-flash"),
  EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  DEMO_USER_EMAIL: z.string().optional(),
  DEMO_USER_PASSWORD: z.string().optional(),
});

/** pgvector column dimension in supabase/migrations — must match the embedding request. */
export const EMBEDDING_DIMENSION = 768;

export interface ServerConfig {
  mode: AppMode;
  supabase: { url: string; anonKey: string; serviceRoleKey: string } | null;
  ai: { apiKey: string; model: string; embeddingModel: string } | null;
  judgeAccessConfigured: boolean;
  problems: string[];
}

let cached: ServerConfig | null = null;

export function getServerConfig(): ServerConfig {
  if (cached) return cached;
  const env = envSchema.parse({
    ...process.env,
    APP_MODE: process.env.APP_MODE || undefined,
    AI_MODEL: process.env.AI_MODEL || undefined,
    EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || undefined,
  });
  const problems: string[] = [];
  const hasSupabase = !!(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY);
  const partialSupabase = !hasSupabase && !!(env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
  if (partialSupabase) {
    problems.push("Supabase is partially configured: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are all required.");
  }
  let mode: AppMode = env.APP_MODE === "demo" ? "demo" : env.APP_MODE === "live" ? "live" : hasSupabase ? "live" : "demo";
  if (mode === "live" && !hasSupabase) {
    problems.push("APP_MODE=live but Supabase is not fully configured. Falling back to demo mode.");
    mode = "demo";
  }
  cached = {
    mode,
    supabase: hasSupabase
      ? { url: env.NEXT_PUBLIC_SUPABASE_URL!, anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY! }
      : null,
    // Demo mode never calls external services, even if a key is present.
    ai: mode === "live" && env.GEMINI_API_KEY ? { apiKey: env.GEMINI_API_KEY, model: env.AI_MODEL, embeddingModel: env.EMBEDDING_MODEL } : null,
    judgeAccessConfigured: mode === "live" && !!(env.DEMO_USER_EMAIL && env.DEMO_USER_PASSWORD),
    problems,
  };
  if (problems.length) console.warn(`[gapfinder] configuration: ${problems.join(" ")}`);
  return cached;
}

/** The subset that is safe to send to the browser. */
export interface PublicConfig {
  mode: AppMode;
  aiConfigured: boolean;
  judgeAccess: boolean;
  aiModel: string | null;
  embeddingModel: string | null;
  problems: string[];
}

export function getPublicConfig(): PublicConfig {
  const c = getServerConfig();
  return {
    mode: c.mode,
    aiConfigured: !!c.ai,
    judgeAccess: c.judgeAccessConfigured,
    aiModel: c.ai?.model ?? null,
    embeddingModel: c.ai?.embeddingModel ?? null,
    problems: c.problems,
  };
}

export function getJudgeCredentials(): { email: string; password: string } | null {
  const c = getServerConfig();
  if (!c.judgeAccessConfigured) return null;
  return { email: process.env.DEMO_USER_EMAIL!, password: process.env.DEMO_USER_PASSWORD! };
}
