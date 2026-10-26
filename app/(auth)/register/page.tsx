import Link from "next/link";
import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/AuthForms";
import { Alert, Card, LinkButton } from "@/components/ui";
import { getPublicConfig } from "@/lib/config";

export const metadata: Metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  const config = getPublicConfig();
  if (config.mode === "demo") {
    return (
      <Card className="p-6">
        <h1 className="text-xl font-semibold text-slate-900">Registration is not enabled</h1>
        <Alert tone="info" className="mt-4">This deployment runs in demo mode without Supabase, so accounts cannot be created. Use the demo workspace instead.</Alert>
        <LinkButton href="/login" className="mt-5 w-full">Go to the demo</LinkButton>
      </Card>
    );
  }
  return (
    <Card className="p-6">
      <h1 className="text-xl font-semibold text-slate-900">Create your account</h1>
      <p className="mt-1 text-sm text-slate-600">Your documents, quiz results and revision plans are private to your account.</p>
      <div className="mt-5">
        <RegisterForm />
      </div>
      <p className="mt-5 text-center text-sm text-slate-600">
        Already registered? <Link href="/login" className="font-medium text-brand-600 hover:underline">Log in</Link>
      </p>
    </Card>
  );
}
