import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractText } from "@/lib/rag/extract";
import { processDocument } from "@/lib/rag/process";

const fixture = (name: string) => new Uint8Array(fs.readFileSync(path.join(__dirname, "fixtures", name)));

describe("PDF extraction", () => {
  it("extracts text page by page and preserves page numbers in chunks", async () => {
    const out = await extractText(fixture("two-page-notes.pdf"), "application/pdf", "notes.pdf");
    expect(out.pageCount).toBe(2);
    expect(out.pages[1].text).toMatch(/marks vertices visited when they are enqueued/);
    const processed = await processDocument({ doc: { id: "d", name: "notes.pdf", kind: "notes" }, bytes: fixture("two-page-notes.pdf"), mimeType: "application/pdf", existingTopics: [] });
    const bfs = processed.chunks.find((c) => c.text.includes("BFS"));
    expect(bfs).toMatchObject({ page: 2, section: "5.2 Breadth-first search" });
  });

  it("reports an image-only (scanned) PDF honestly instead of succeeding", async () => {
    await expect(extractText(fixture("scanned.pdf"), "application/pdf", "scan.pdf")).rejects.toThrow(/scanned PDF/);
  });
});

describe("configuration and access mode", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
    vi.resetModules();
  });

  async function freshConfig(env: Record<string, string | undefined>) {
    process.env = { ...original, APP_MODE: undefined, NEXT_PUBLIC_SUPABASE_URL: undefined, NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined, GEMINI_API_KEY: undefined, DEMO_USER_EMAIL: undefined, DEMO_USER_PASSWORD: undefined, ...env } as NodeJS.ProcessEnv;
    vi.resetModules();
    return (await import("@/lib/config")).getServerConfig();
  }

  it("defaults to demo mode with no credentials and never enables AI there", async () => {
    const c = await freshConfig({ GEMINI_API_KEY: "test-key" });
    expect(c.mode).toBe("demo");
    expect(c.ai).toBeNull();
    expect(c.judgeAccessConfigured).toBe(false);
  });

  it("switches to live mode only when Supabase is fully configured", async () => {
    const partial = await freshConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" });
    expect(partial.mode).toBe("demo");
    expect(partial.problems.join(" ")).toMatch(/partially configured/);
    const live = await freshConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service", GEMINI_API_KEY: "k" });
    expect(live.mode).toBe("live");
    expect(live.ai?.model).toBe("gemini-2.5-flash");
  });

  it("does not claim live mode when APP_MODE=live but Supabase is missing", async () => {
    const c = await freshConfig({ APP_MODE: "live" });
    expect(c.mode).toBe("demo");
    expect(c.problems.join(" ")).toMatch(/Falling back to demo/);
  });

  it("never exposes secrets in the public config", async () => {
    await freshConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service-secret", GEMINI_API_KEY: "gemini-secret", DEMO_USER_EMAIL: "j@x.io", DEMO_USER_PASSWORD: "pw-secret" });
    const pub = JSON.stringify((await import("@/lib/config")).getPublicConfig());
    expect(pub).not.toMatch(/service-secret|gemini-secret|pw-secret/);
    expect(JSON.parse(pub).judgeAccess).toBe(true);
  });
});
