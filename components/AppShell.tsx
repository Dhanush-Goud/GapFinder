"use client";
import clsx from "clsx";
import {
  BookOpen, CalendarCheck, FlaskConical, GraduationCap, LayoutDashboard, ListChecks, LogOut, Menu, MessageSquareText, Network, Settings, Target, TrendingUp, X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { logoutAction } from "@/app/auth-actions";
import { useAppState } from "@/features/app-state/AppStateProvider";
import { Logo } from "./Logo";
import { Alert, Button, Spinner } from "./ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/materials", label: "Materials", icon: BookOpen },
  { href: "/topics", label: "Topic map", icon: Network },
  { href: "/quiz", label: "Diagnostic quiz", icon: ListChecks },
  { href: "/gap-report", label: "Gap report", icon: Target },
  { href: "/revision-plan", label: "Revision plan", icon: CalendarCheck },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/tutor", label: "Explain a topic", icon: MessageSquareText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children, userLabel }: { children: ReactNode; userLabel: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { config, status, error, refresh } = useAppState();

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Main">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <Icon className={clsx("h-4 w-4", active ? "text-brand-600" : "text-slate-400")} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="border-t border-slate-200 p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <GraduationCap className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{userLabel}</p>
          <p className="text-xs text-slate-500">{config.mode === "demo" ? "Local demo — not signed in" : "Signed in"}</p>
        </div>
      </div>
      <form action={logoutAction}>
        <Button type="submit" variant="ghost" icon={LogOut} className="mt-1 w-full justify-start">
          {config.mode === "demo" ? "Exit demo" : "Log out"}
        </Button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:flex">
        <div className="px-6 py-5">
          <Logo href="/dashboard" />
        </div>
        {nav}
        {footer}
      </aside>

      {/* Mobile header + drawer */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <Logo href="/dashboard" />
        <Button variant="ghost" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)} icon={open ? X : Menu} />
      </header>
      {open && (
        <div className="fixed inset-0 z-20 bg-slate-900/30 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white pt-16 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      <div className="flex-1 lg:pl-64">
        {config.mode === "demo" && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900 sm:text-sm">
            <FlaskConical className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden />
            <strong>Demo mode.</strong> No account, no external AI calls: your progress is saved in this browser only, and quizzes use seeded questions from the sample course.{" "}
            <Link href="/settings#mode" className="font-medium underline">
              What&apos;s real?
            </Link>
          </div>
        )}
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {status === "loading" && <Spinner label="Loading your workspace…" />}
          {status === "error" && (
            <Alert tone="error" title="Your workspace could not be loaded">
              <p>{error}</p>
              <Button variant="secondary" className="mt-2" onClick={() => void refresh()}>
                Retry
              </Button>
            </Alert>
          )}
          {status === "ready" && children}
        </main>
      </div>
    </div>
  );
}
