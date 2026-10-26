import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  FileSearch,
  ListChecks,
  Network,
  Quote,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { enterDemoAction } from "./auth-actions";
import { Logo } from "@/components/Logo";
import { Button, LinkButton } from "@/components/ui";
import { getPublicConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: BookOpen, title: "Ingest Syllabus & Notes", text: "Upload your syllabus and lecture notes (PDF or text) to initialize the knowledge topology." },
  { icon: Network, title: "Compile Topic Graph", text: "Verified units and sub-topics are structured directly from your syllabus with real passage references." },
  { icon: ListChecks, title: "Diagnostic Evaluations", text: "Targeted questions are grounded directly in your source material, citing exact chapter sections." },
  { icon: Target, title: "Empirical Gap Detection", text: "Units are classified as weak, developing, or strong from rolling answer accuracy with misconceptions identified." },
  { icon: CalendarCheck, title: "Adaptive Revision Plan", text: "A prioritized day-by-day study agenda that balances your daily time budget against your exam horizon." },
  { icon: TrendingUp, title: "Continuous Telemetry", text: "Submitting diagnostic retests recalibrates mastery scores and automatically shifts revision allocations." },
];

const FEATURES = [
  { icon: FileSearch, title: "Grounded in Your Own Material", text: "Questions and conceptual explanations come strictly from retrieved passages of your uploaded notes. Unsupported claims are rejected." },
  { icon: Target, title: "Transparent, Explainable Diagnosis", text: "Mastery classifications are determined by deterministic heuristic rules from your answers — never arbitrary model opinions." },
  { icon: CalendarCheck, title: "Dynamic Adaptive Scheduling", text: "The revision planner allocates study time to your biggest weaknesses and shifts capacity as you improve." },
  { icon: ShieldCheck, title: "Private & Secure Architecture", text: "Row-Level Security isolates documents, answers, and study telemetry strictly to your account." },
];

export default function Landing() {
  const config = getPublicConfig();
  const demo = config.mode === "demo";

  return (
    <div className="min-h-screen bg-[#080908] text-[#F4F5F0]">
      {/* Header */}
      <header className="border-b border-[#2A2D26]/70 bg-[#10110F]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-2.5">
            <LinkButton href="/login" variant="ghost" className="text-xs">
              Sign In
            </LinkButton>
            {!demo && (
              <LinkButton href="/register" className="text-xs">
                Create Account
              </LinkButton>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 lg:pt-24">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D5FF32]/30 bg-[#D5FF32]/10 px-3 py-1 text-xs font-semibold text-[#D5FF32]">
            <Sparkles className="h-3.5 w-3.5" />
            Intelligence Lab · Continuous Knowledge Diagnosis
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-[#F4F5F0] sm:text-6xl sm:leading-tight">
            Stop guessing what you know. <span className="text-[#D5FF32]">Diagnose your gaps</span> with telemetry.
          </h1>

          <p className="text-base sm:text-lg leading-relaxed text-[#A0A39A]">
            Students waste valuable revision cycles re-reading familiar chapters. GapFinder evaluates your comprehension directly on <em>your course syllabus and notes</em>, pinpoints knowledge gaps with verifiable citations, and orchestrates an adaptive study agenda.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {demo ? (
              <form action={enterDemoAction}>
                <Button type="submit" className="px-6 py-3 text-sm font-bold uppercase tracking-wider" icon={ArrowRight}>
                  Launch Interactive Demo
                </Button>
              </form>
            ) : (
              <>
                <LinkButton href="/register" className="px-6 py-3 text-sm font-bold uppercase tracking-wider" icon={ArrowRight}>
                  Initialize Workspace
                </LinkButton>
                <LinkButton href="/login" variant="secondary" className="px-6 py-3 text-sm font-bold uppercase tracking-wider">
                  {config.judgeAccess ? "Judge Evaluation Access" : "Sign In"}
                </LinkButton>
              </>
            )}
          </div>

          {demo && (
            <p className="text-xs text-[#73776E]">
              Zero signup required. Runs in demo mode with a pre-seeded Data Structures course persisted in local browser storage.
            </p>
          )}
        </div>
      </section>

      {/* Process Architecture */}
      <section className="border-y border-[#2A2D26] bg-[#10110F] py-20" aria-labelledby="architecture">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-xl">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#D5FF32]">Methodology</span>
            <h2 id="architecture" className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F4F5F0]">
              Empirical Diagnostic Workflow
            </h2>
          </div>

          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                className="group rounded-xl border border-[#2A2D26] bg-[#171915] p-5 transition-colors hover:border-[#3A3F33]"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#2A2D26] bg-[#10110F] text-xs font-bold tabular-nums text-[#D5FF32]">
                    0{i + 1}
                  </span>
                  <s.icon className="h-4 w-4 text-[#73776E] group-hover:text-[#D5FF32] transition-colors" aria-hidden />
                </div>
                <h3 className="mt-4 text-sm font-bold text-[#F4F5F0]">{s.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#A0A39A]">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Verification & Trust */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="trust">
        <div className="max-w-xl">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#D5FF32]">Reliability</span>
          <h2 id="trust" className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F4F5F0]">
            Engineered for Verification
          </h2>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex gap-4 rounded-xl border border-[#2A2D26] bg-[#10110F] p-5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#2A2D26] bg-[#171915] text-[#D5FF32]">
                <f.icon className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h3 className="text-sm font-bold text-[#F4F5F0]">{f.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-[#A0A39A]">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Diagnostic Callout Banner */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid gap-8 rounded-2xl border border-[#2A2D26] bg-[#10110F] p-8 lg:grid-cols-2 lg:p-10">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#D5FF32]">Diagnostic Impact</span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#F4F5F0]">
              Built for High-Stakes Exam Revision
            </h2>
            <ul className="mt-6 space-y-3 text-xs text-[#A0A39A]">
              {[
                "Eliminate wasted hours on topics you have already mastered",
                "Pinpoint specific misconceptions with grounded source citations",
                "Schedule study blocks that respect your actual daily available hours",
                "Measure empirical mastery improvements through periodic diagnostic retests",
              ].map((b) => (
                <li key={b} className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#D5FF32]" aria-hidden />
                  <span className="text-[#F4F5F0]">{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <figure className="rounded-xl border border-[#2A2D26] bg-[#171915] p-6 flex flex-col justify-between">
            <div>
              <Quote className="h-5 w-5 text-[#D5FF32]" aria-hidden />
              <blockquote className="mt-3 text-xs leading-relaxed text-[#F4F5F0]">
                Diagnostic Telemetry: <strong className="text-[#EF4444]">Graph Algorithms — Weak (25% accuracy)</strong>. Misconception detected: vertex marked visited upon dequeue instead of enqueue, permitting duplicate queue entries. Re-study §5.2 Breadth-First Search and launch retest.
              </blockquote>
            </div>
            <figcaption className="mt-4 text-[10px] uppercase tracking-wider text-[#73776E] border-t border-[#2A2D26]/60 pt-3">
              Sample Gap Telemetry Excerpt
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#2A2D26] py-8 text-center text-xs text-[#73776E]">
        GapFinder AI · Intelligence Lab Dashboard ·{" "}
        <Link href="/login" className="font-semibold text-[#D5FF32] hover:underline">
          Access Workspace
        </Link>
      </footer>
    </div>
  );
}
