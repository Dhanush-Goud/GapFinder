"use server";
// Server actions for authentication. Passwords are only ever handled server-side.
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getJudgeCredentials, getServerConfig } from "@/lib/config";
import { DEMO_COOKIE } from "@/lib/auth/session";
import { createUserClient } from "@/lib/supabase/server";

export interface AuthFormState {
  error?: string;
  message?: string;
}

const credentials = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
});

function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

export async function loginAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  if (getServerConfig().mode !== "live") return { error: "Authentication is not configured. Use the demo workspace." };
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createUserClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message === "Invalid login credentials" ? "Incorrect email or password." : error.message };
  redirect(safeNext(form.get("next")));
}

export async function registerAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  if (getServerConfig().mode !== "live") return { error: "Registration is not available in demo mode." };
  const parsed = credentials.extend({ name: z.string().trim().min(1, "Enter your name.").max(80) }).safeParse({
    email: form.get("email"), password: form.get("password"), name: form.get("name"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createUserClient();
  const origin = (await headers()).get("origin") ?? "";
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { display_name: parsed.data.name }, emailRedirectTo: origin ? `${origin}/auth/callback` : undefined },
  });
  if (error) return { error: error.message };
  if (data.session) redirect("/dashboard");
  return { message: "Account created. Check your email for a confirmation link, then log in." };
}

export async function judgeLoginAction(): Promise<AuthFormState> {
  const creds = getJudgeCredentials();
  if (!creds) return { error: "Judge access is not configured on this deployment." };
  const supabase = await createUserClient();
  const { error } = await supabase.auth.signInWithPassword(creds);
  if (error) return { error: `Judge account sign-in failed: ${error.message}` };
  redirect("/dashboard");
}

export async function logoutAction() {
  if (getServerConfig().mode === "live") {
    const supabase = await createUserClient();
    await supabase.auth.signOut();
  } else {
    (await cookies()).delete(DEMO_COOKIE);
  }
  redirect("/");
}

export async function enterDemoAction() {
  if (getServerConfig().mode !== "demo") redirect("/login");
  (await cookies()).set(DEMO_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30, secure: process.env.NODE_ENV === "production" });
  redirect("/dashboard");
}
