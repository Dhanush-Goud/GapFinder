// Supabase email-confirmation / magic-link callback: exchanges the code for a session cookie.
import { NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createUserClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/dashboard", url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=confirmation", url.origin));
}
