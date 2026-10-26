"use client";
import { Check, Copy, Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { demoLoginAction } from "@/app/auth-actions";
import { Alert, Button } from "@/components/ui";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

interface DemoAccessCardProps {
  demoEmail?: string;
  demoPassword?: string;
  next?: string;
}

export function DemoAccessCard({
  demoEmail = "demo@gapfinder.ai",
  demoPassword = "DemoPass_GapFinder_2026!",
  next,
}: DemoAccessCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<"email" | "password" | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleDemoSignIn() {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Authenticate via Server Action using the server Supabase SSR client
      const res = await demoLoginAction(next);
      if (res?.error) {
        setError(res.error);
        setLoading(false);
      }
    } catch (err: unknown) {
      // Next.js redirect throws a NEXT_REDIRECT digest/error; let it pass
      if (err instanceof Error && (err.message === "NEXT_REDIRECT" || (err as { digest?: string }).digest?.startsWith("NEXT_REDIRECT"))) {
        throw err;
      }

      // 2. Client-side fallback using browser Supabase Auth client directly
      try {
        const supabase = createBrowserSupabaseClient();
        const { error: sbError } = await supabase.auth.signInWithPassword({
          email: demoEmail,
          password: demoPassword,
        });
        if (sbError) throw sbError;
        router.push(next || "/dashboard");
        router.refresh();
      } catch (clientErr: unknown) {
        setError(
          clientErr instanceof Error
            ? clientErr.message
            : err instanceof Error
            ? err.message
            : "Demo sign-in failed. Please use the copy buttons below to sign in manually."
        );
        setLoading(false);
      }
    }
  }

  async function copyText(text: string, field: "email" | "password") {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      setCopiedField(null);
    }
  }

  return (
    <div className="w-full">
      {/* Polished Divider */}
      <div className="relative my-6 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#2A2D26]" />
        </div>
        <div className="relative bg-[#10110F] px-3 text-[10px] font-bold uppercase tracking-widest text-[#73776E]">
          Or Try The Demo
        </div>
      </div>

      {/* Demo Access Card */}
      <div className="rounded-xl border border-[#2A2D26] bg-[#171915] p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[#D5FF32]/30 bg-[#D5FF32]/10 text-[#D5FF32]">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#F4F5F0]">
              Instant Demo Access
            </h3>
          </div>
          <span className="rounded bg-[#10B981]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#34D399]">
            One-Click
          </span>
        </div>

        <p className="text-xs leading-relaxed text-[#A0A39A]">
          Explore GapFinder AI with a pre-configured student demo account. Inspect diagnostic knowledge maps, quiz telemetry, and adaptive revision schedules with sample materials.
        </p>

        {error && (
          <Alert tone="error" className="text-xs">
            {error}
          </Alert>
        )}

        {/* Prominent Try Demo Account Button */}
        <Button
          type="button"
          onClick={handleDemoSignIn}
          loading={loading}
          disabled={loading}
          icon={Sparkles}
          className="w-full justify-center bg-[#D5FF32] text-[#080908] hover:bg-[#C2EB28] font-bold text-xs uppercase tracking-wider py-2.5 shadow-lime active:translate-y-[1px]"
        >
          {loading ? "Authenticating Demo Account…" : "Try Demo Account"}
        </Button>

        {/* Fallback Credentials Section */}
        <div className="rounded-lg border border-[#2A2D26] bg-[#10110F] p-3 text-xs space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#73776E]">
            Fallback Credentials (Manual Sign In)
          </p>

          {/* Email row */}
          <div className="flex items-center justify-between gap-2 rounded-md border border-[#2A2D26]/70 bg-[#171915] px-2.5 py-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-medium text-[#73776E] w-14 shrink-0">Email:</span>
              <span className="font-mono text-xs text-[#F4F5F0] truncate select-all">{demoEmail}</span>
            </div>
            <button
              type="button"
              onClick={() => copyText(demoEmail, "email")}
              className="shrink-0 flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold text-[#D5FF32] hover:bg-[#20221D] transition-colors"
              title="Copy demo email to clipboard"
            >
              {copiedField === "email" ? (
                <>
                  <Check className="h-3 w-3 text-[#34D399]" />
                  <span className="text-[#34D399]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Password row */}
          <div className="flex items-center justify-between gap-2 rounded-md border border-[#2A2D26]/70 bg-[#171915] px-2.5 py-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-medium text-[#73776E] w-14 shrink-0">Password:</span>
              <span className="font-mono text-xs text-[#F4F5F0] truncate select-all">
                {showPassword ? demoPassword : "••••••••••••••••••••••"}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="rounded p-1 text-[#73776E] hover:text-[#A0A39A] transition-colors"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
              <button
                type="button"
                onClick={() => copyText(demoPassword, "password")}
                className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold text-[#D5FF32] hover:bg-[#20221D] transition-colors"
                title="Copy demo password to clipboard"
              >
                {copiedField === "password" ? (
                  <>
                    <Check className="h-3 w-3 text-[#34D399]" />
                    <span className="text-[#34D399]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
