import Link from "next/link";

export function Logo({ href = "/", compact }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="group flex items-center gap-2.5 font-semibold text-[#F4F5F0] transition-opacity hover:opacity-90">
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#2A2D26] bg-[#171915]">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#D5FF32]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {/* Diagnostic scanner radar */}
          <circle cx="12" cy="12" r="9" stroke="#2A2D26" />
          <path d="M12 3v4" stroke="#D5FF32" />
          <path d="M12 12l5-5" stroke="#D5FF32" />
          <circle cx="12" cy="12" r="2.5" fill="#D5FF32" />
        </svg>
        <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[#D5FF32]" />
      </div>
      {!compact && (
        <div className="flex flex-col">
          <span className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-[#F4F5F0]">
            GapFinder
            <span className="rounded bg-[#D5FF32] px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider text-[#080908]">
              AI
            </span>
          </span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-[#73776E]">Intelligence Lab</span>
        </div>
      )}
    </Link>
  );
}
