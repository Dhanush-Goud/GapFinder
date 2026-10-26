import Link from "next/link";
import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/AuthForms";
import { DemoAccessCard } from "@/components/auth/DemoAccessCard";
import { Alert, Card, LinkButton } from "@/components/ui";
import { getJudgeCredentials, getPublicConfig } from "@/lib/config";

export const metadata: Metadata = { title: "Create Account · Intelligence Lab" };
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  const config = getPublicConfig();
  const creds = getJudgeCredentials();

  if (config.mode === "demo") {
    return (
      <Card className="border-[#2A2D26] bg-[#10110F] p-6 shadow-2xl">
        <h1 className="text-xl font-bold tracking-tight text-[#F4F5F0]">Account Registration Disabled</h1>
        <Alert tone="info" className="mt-4">
          This instance operates in demo mode without Supabase connection. Direct accounts are not needed.
        </Alert>
        <LinkButton href="/login" className="mt-5 w-full text-xs font-bold uppercase tracking-wider py-2.5">
          Launch Demo Workspace
        </LinkButton>
      </Card>
    );
  }

  return (
    <Card className="border-[#2A2D26] bg-[#10110F] p-6 shadow-2xl">
      <h1 className="text-xl font-bold tracking-tight text-[#F4F5F0]">Create Workspace Account</h1>
      <p className="mt-1 text-xs text-[#A0A39A]">
        Documents, quiz attempts, and revision plans are private and secured by Row-Level Security.
      </p>
      <div className="mt-5">
        <RegisterForm />
      </div>

      <DemoAccessCard
        demoEmail={creds?.email}
        demoPassword={creds?.password}
      />

      <p className="mt-6 text-center text-xs text-[#73776E]">
        Existing account?{" "}
        <Link href="/login" className="font-semibold text-[#D5FF32] hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
