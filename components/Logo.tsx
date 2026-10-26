import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-semibold text-slate-900">
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#4f46e5" />
        <circle cx="14" cy="14" r="7" fill="none" stroke="#fff" strokeWidth="2.5" />
        <path d="M19.5 19.5 25 25" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M11 14h6" stroke="#a5b4fc" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span>
        GapFinder <span className="text-brand-600">AI</span>
      </span>
    </Link>
  );
}
