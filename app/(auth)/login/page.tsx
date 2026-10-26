import { ArrowRight, FlaskConical } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { enterDemoAction } from "@/app/auth-actions";
import { LoginForm } from "@/components/auth/AuthForms";
import { DemoAccessCard } from "@/components/auth/DemoAccessCard";
import { Alert, Button, Card } from "@/components/ui";
import { getJudgeCredentials, getPublicConfig } from "@/lib/config";

export const metadata: Metadata = { title: "Sign In · Intelligence Lab" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const config = getPublicConfig();
  const creds = getJudgeCredentials();

  if (config.mode === "demo") {
    return (
      <Card className="border-[#2A2D26] bg-[#10110F] p-6 shadow-2xl">
        <h1 className="text-xl font-bold tracking-tight text-[#F4F5F0]">Launch Demo Environment</h1>
        <p className="mt-2 text-xs leading-relaxed text-[#A0A39A]">
          This deployment operates in <strong>demo mode</strong>: Supabase authentication is not configured. The workspace session is stored locally in this browser and initializes with a verified Data Structures &amp; Algorithms course.
        </p>
        <Alert tone="warning" className="mt-4" title="Ephemeral Sandbox">
          Data persists in your local browser storage. Configure Supabase credentials to enable production persistent storage.
        </Alert>
        <form action={enterDemoAction} className="mt-5">
          <Button type="submit" icon={FlaskConical} className="w-full text-xs font-bold uppercase tracking-wider py-2.5">
            Enter Demo Workspace
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card className="border-[#2A2D26] bg-[#10110F] p-6 shadow-2xl">
      <h1 className="text-xl font-bold tracking-tight text-[#F4F5F0]">Workspace Sign In</h1>
      <p className="mt-1 text-xs text-[#A0A39A]">
        Access your continuous learning telemetry and adaptive revision schedule.
      </p>

      {error === "confirmation" && (
        <Alert tone="error" className="mt-4">
          Verification token is invalid or has expired. Sign in or register again.
        </Alert>
      )}

      <div className="mt-5">
        <LoginForm next={next} />
      </div>

      <DemoAccessCard
        demoEmail={creds?.email}
        demoPassword={creds?.password}
        next={next}
      />

      <p className="mt-6 text-center text-xs text-[#73776E]">
        New to GapFinder?{" "}
        <Link href="/register" className="inline-flex items-center gap-1 font-semibold text-[#D5FF32] hover:underline">
          Create account <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </p>
    </Card>
  );
}
