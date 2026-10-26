import { ArrowRight, FlaskConical } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { enterDemoAction } from "@/app/auth-actions";
import { JudgeLoginButton, LoginForm } from "@/components/auth/AuthForms";
import { Alert, Button, Card } from "@/components/ui";
import { getPublicConfig } from "@/lib/config";

export const metadata: Metadata = { title: "Log in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const config = getPublicConfig();

  if (config.mode === "demo") {
    return (
      <Card className="p-6">
        <h1 className="text-xl font-semibold text-slate-900">Enter the demo workspace</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          This deployment runs in <strong>demo mode</strong>: Supabase authentication is not configured, so there is no real login. The demo workspace is stored in this browser only and uses a sample Data Structures &amp; Algorithms course with seeded, source-grounded questions.
        </p>
        <Alert tone="warning" className="mt-4" title="Not secure authentication">
          Anyone with this link can open the demo. Configure Supabase (see README) for real accounts and database persistence.
        </Alert>
        <form action={enterDemoAction} className="mt-5">
          <Button type="submit" icon={FlaskConical} className="w-full">
            Enter demo workspace
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h1 className="text-xl font-semibold text-slate-900">Log in</h1>
      <p className="mt-1 text-sm text-slate-600">Welcome back. Your materials and progress are saved to your account.</p>
      {error === "confirmation" && <Alert tone="error" className="mt-4">That confirmation link is invalid or has expired. Log in or register again.</Alert>}
      {config.judgeAccess && (
        <div className="mt-5 rounded-lg border border-brand-200 bg-brand-50 p-4">
          <p className="text-sm font-medium text-brand-900">Hackathon judges</p>
          <p className="mb-3 mt-1 text-xs text-brand-800">Sign in to the dedicated demo account without registering. The password stays on the server.</p>
          <JudgeLoginButton />
        </div>
      )}
      <div className="mt-5">
        <LoginForm next={next} />
      </div>
      <p className="mt-5 text-center text-sm text-slate-600">
        New here?{" "}
        <Link href="/register" className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline">
          Create an account <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </p>
    </Card>
  );
}
