import { ArrowRight, BookOpen, CalendarCheck, CheckCircle2, FileSearch, ListChecks, Network, Quote, ShieldCheck, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { enterDemoAction } from "./auth-actions";
import { Logo } from "@/components/Logo";
import { Button, LinkButton } from "@/components/ui";
import { getPublicConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: BookOpen, title: "Upload your material", text: "Syllabus, notes, textbook chapters or past papers — PDF or text." },
  { icon: Network, title: "Map the syllabus", text: "Topics and sub-topics are taken from your syllabus, and every passage is linked to them." },
  { icon: ListChecks, title: "Take a diagnostic quiz", text: "Questions are generated from retrieved passages and cite the exact section they come from." },
  { icon: Target, title: "See your gaps", text: "Each topic is rated weak, developing or strong from your actual answers — with the evidence shown." },
  { icon: CalendarCheck, title: "Follow the plan", text: "A day-by-day plan that fits your hours and exam date, prioritising the biggest gaps." },
  { icon: TrendingUp, title: "Retest and improve", text: "Every quiz updates your mastery, and the plan shifts time to whatever is still weak." },
];

const FEATURES = [
  { icon: FileSearch, title: "Grounded in your sources", text: "Questions and explanations come from retrieved passages of your own material. Citations that don't resolve to a stored passage are rejected." },
  { icon: Target, title: "Explainable diagnosis", text: "Mastery labels are computed by transparent rules from your answers — never assigned by a language model." },
  { icon: CalendarCheck, title: "Adaptive revision plan", text: "The plan respects your daily study limit, keeps finished tasks, and recalculates after each quiz." },
  { icon: ShieldCheck, title: "Private by design", text: "Row-level security keeps every document, answer and plan visible only to its owner. Answer keys never reach the browser." },
];

export default function Landing() {
  const config = getPublicConfig();
  const demo = config.mode === "demo";
  return (
    <div className="bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <LinkButton href="/login" variant="ghost">
            Log in
          </LinkButton>
          {!demo && (
            <LinkButton href="/register" variant="secondary">
              Create account
            </LinkButton>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:pt-16">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200">
            Knowledge-gap diagnosis for exam revision
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">Find out what you don&apos;t know yet — and what to study next.</h1>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">
            Students lose revision time re-reading what they already understand. GapFinder AI quizzes you on <em>your own</em> syllabus and notes, pinpoints the weak topics from your answers, explains why, and builds a plan that adapts as you improve.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {demo ? (
              <form action={enterDemoAction}>
                <Button type="submit" className="px-5 py-2.5 text-base" icon={ArrowRight}>
                  Try the demo — no sign-up
                </Button>
              </form>
            ) : (
              <>
                <LinkButton href="/register" className="px-5 py-2.5 text-base" icon={ArrowRight}>
                  Get started
                </LinkButton>
                <LinkButton href="/login" variant="secondary" className="px-5 py-2.5 text-base">
                  {config.judgeAccess ? "Judge / demo login" : "Log in"}
                </LinkButton>
              </>
            )}
          </div>
          {demo && <p className="mt-3 text-sm text-slate-500">Demo mode runs with a sample Data Structures course and saves progress in your browser only.</p>}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 py-16" aria-labelledby="how">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 id="how" className="text-2xl font-semibold tracking-tight text-slate-900">How it works</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-semibold text-white">{i + 1}</span>
                  <s.icon className="h-5 w-5 text-brand-600" aria-hidden />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="features">
        <h2 id="features" className="text-2xl font-semibold tracking-tight text-slate-900">Built to be trusted</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-4">
              <span className="h-fit rounded-lg bg-brand-50 p-2 text-brand-600">
                <f.icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6" aria-labelledby="benefits">
        <div className="grid gap-8 rounded-2xl bg-slate-900 p-8 text-white lg:grid-cols-2 lg:p-12">
          <div>
            <h2 id="benefits" className="text-2xl font-semibold tracking-tight">For students who want to revise smarter</h2>
            <ul className="mt-6 space-y-3 text-sm text-slate-200">
              {[
                "Stop spending hours on topics you already know",
                "Know why an answer was wrong, with the source passage to re-read",
                "Get a schedule that fits the hours you actually have",
                "See measurable improvement after every retest",
              ].map((b) => (
                <li key={b} className="flex gap-2">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-300" aria-hidden /> {b}
                </li>
              ))}
            </ul>
          </div>
          <figure className="rounded-xl bg-white/5 p-6 ring-1 ring-white/10">
            <Quote className="h-5 w-5 text-brand-300" aria-hidden />
            <blockquote className="mt-3 text-sm leading-relaxed text-slate-200">
              Example diagnosis: <strong className="text-white">Graphs — Weak (25%)</strong>. You chose “mark visited when dequeued”, which lets a vertex enter the queue twice. Re-read §5.2 Breadth-first search, then retest.
            </blockquote>
            <figcaption className="mt-3 text-xs text-slate-400">What a gap report entry looks like</figcaption>
          </figure>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        GapFinder AI — hackathon MVP. <Link href="/login" className="font-medium text-brand-600 hover:underline">Open the app</Link>
      </footer>
    </div>
  );
}
