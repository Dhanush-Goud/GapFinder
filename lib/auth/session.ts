// Server-side identity resolution for API routes and pages.
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerConfig } from "@/lib/config";
import { createUserClient } from "@/lib/supabase/server";

export const DEMO_COOKIE = "gf_demo";

export type Viewer =
  | { kind: "demo" }
  | { kind: "user"; userId: string; email: string | null; supabase: SupabaseClient };

export class AuthError extends Error {
  status = 401;
}

/** Returns the current viewer, or null if nobody is signed in / no demo session exists. */
export async function getViewer(): Promise<Viewer | null> {
  const config = getServerConfig();
  if (config.mode === "demo") {
    const store = await cookies();
    return store.get(DEMO_COOKIE)?.value === "1" ? { kind: "demo" } : null;
  }
  const supabase = await createUserClient();
  // getUser() validates the JWT with Supabase Auth (getSession() alone would trust the cookie).
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { kind: "user", userId: data.user.id, email: data.user.email ?? null, supabase };
}

export async function requireUser(): Promise<Extract<Viewer, { kind: "user" }>> {
  const viewer = await getViewer();
  if (!viewer || viewer.kind !== "user") throw new AuthError("Sign in required.");
  return viewer;
}

export async function requireDemo(): Promise<void> {
  const viewer = await getViewer();
  if (!viewer || viewer.kind !== "demo") throw new AuthError("Demo session required.");
}
