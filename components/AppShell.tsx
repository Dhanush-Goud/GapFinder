"use client";
import clsx from "clsx";
import {
  BookOpen,
  CalendarCheck,
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MessageSquareText,
  Network,
  Settings,
  Target,
  TrendingUp,
  X,
  ShieldCheck,
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
  { href: "/topics", label: "Knowledge Map", icon: Network },
  { href: "/quiz", label: "Diagnostic Quiz", icon: ListChecks },
  { href: "/gap-report", label: "Gap Report", icon: Target },
  { href: "/revision-plan", label: "Revision Plan", icon: CalendarCheck },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/tutor", label: "AI Tutor", icon: MessageSquareText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children, userLabel }: { children: ReactNode; userLabel: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { config, status, error, refresh } = useAppState();

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-2" aria-label="Main Navigation">
      <div className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-[#73776E]">
        Workspace
      </div>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150",
              active
                ? "bg-[#171915] text-[#D5FF32] font-semibold border border-[#2A2D26]"
                : "text-[#A0A39A] hover:bg-[#171915]/60 hover:text-[#F4F5F0] border border-transparent"
            )}
          >
            {/* Slim electric-lime active bar on left */}
            {active && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-[#D5FF32]" />
            )}
            <Icon
              className={clsx(
                "h-4 w-4 shrink-0 transition-colors",
                active ? "text-[#D5FF32]" : "text-[#73776E] group-hover:text-[#A0A39A]"
              )}
              aria-hidden
            />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="border-t border-[#2A2D26] p-3 bg-[#10110F]">
      <div className="flex items-center gap-2.5 rounded-lg border border-[#2A2D26] bg-[#171915] px-2.5 py-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#2A2D26] bg-[#20221D] text-[#D5FF32]">
          <GraduationCap className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-[#F4F5F0]">{userLabel}</p>
          <p className="flex items-center gap-1 text-[10px] text-[#73776E]">
            {config.mode === "demo" ? (
              <span className="text-[#E5A83B] flex items-center gap-1">
                <FlaskConical className="h-2.5 w-2.5" /> Local Demo
              </span>
            ) : (
              <span className="text-[#34D399] flex items-center gap-1">
                <ShieldCheck className="h-2.5 w-2.5" /> Live Supabase
              </span>
            )}
          </p>
        </div>
      </div>
      <form action={logoutAction} className="mt-2">
        <Button
          type="submit"
          variant="ghost"
          icon={LogOut}
          className="w-full justify-start text-xs text-[#73776E] hover:text-[#EF4444] hover:bg-[#171915]"
        >
          {config.mode === "demo" ? "Exit Demo Session" : "Log out"}
        </Button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#080908] text-[#F4F5F0] lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#2A2D26] bg-[#10110F] lg:fixed lg:inset-y-0 lg:flex z-20">
        <div className="px-5 py-5 border-b border-[#2A2D26]/70">
          <Logo href="/dashboard" />
        </div>
        {nav}
        {footer}
      </aside>

      {/* Mobile header + drawer */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#2A2D26] bg-[#10110F] px-4 py-3 lg:hidden">
        <Logo href="/dashboard" />
        <Button
          variant="ghost"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          icon={open ? X : Menu}
          className="text-[#F4F5F0]"
        />
      </header>

      {open && (
        <div className="fixed inset-0 z-40 bg-[#080908]/80 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)}>
          <aside
            className="absolute inset-y-0 left-0 flex w-72 flex-col bg-[#10110F] border-r border-[#2A2D26] pt-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pb-4 border-b border-[#2A2D26]">
              <Logo href="/dashboard" />
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {config.mode === "demo" && (
          <div className="border-b border-[#3D3017] bg-[#19150B] px-4 py-2 text-center text-xs text-[#FDE68A] sm:text-sm">
            <FlaskConical className="mr-1.5 inline h-3.5 w-3.5 text-[#E5A83B] align-text-bottom" aria-hidden />
            <strong>Demo environment.</strong> Real browser-persisted diagnostic analysis with pre-seeded sample data.{" "}
            <Link href="/settings#mode" className="font-medium underline hover:text-[#D5FF32] transition-colors ml-1">
              Architecture details →
            </Link>
          </div>
        )}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {status === "loading" && <Spinner label="Loading intelligence workspace…" />}
          {status === "error" && (
            <Alert tone="error" title="Workspace could not be loaded">
              <p>{error}</p>
              <Button variant="secondary" className="mt-3" onClick={() => void refresh()}>
                Retry connection
              </Button>
            </Alert>
          )}
          {status === "ready" && children}
        </main>
      </div>
    </div>
  );
}
