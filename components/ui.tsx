// Reusable UI primitives — Intelligence Lab design system.
import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentType, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark" | "dark-outline";

const buttonStyles: Record<Variant, string> = {
  primary:
    "bg-[#D5FF32] text-[#080908] font-semibold hover:bg-[#C2EB28] active:translate-y-[1px] disabled:bg-[#20221D] disabled:text-[#73776E] shadow-[0_1px_8px_rgba(213,255,50,0.2)]",
  secondary:
    "bg-[#171915] text-[#F4F5F0] border border-[#2A2D26] hover:bg-[#20221D] hover:border-[#3A3F33] active:translate-y-[1px] disabled:text-[#73776E] disabled:border-[#1F221B]",
  ghost:
    "text-[#A0A39A] hover:bg-[#171915] hover:text-[#F4F5F0] disabled:text-[#73776E]",
  danger:
    "bg-[#171915] text-[#EF4444] border border-[#EF4444]/30 hover:bg-[#EF4444]/15 hover:border-[#EF4444]/50 disabled:text-[#73776E]",
  dark:
    "bg-[#080908] text-[#F4F5F0] font-bold hover:bg-[#171915] hover:text-[#D5FF32] border border-[#080908] active:translate-y-[1px] shadow-lg",
  "dark-outline":
    "bg-[#080908]/15 text-[#080908] font-bold border border-[#080908]/40 hover:bg-[#080908]/25 active:translate-y-[1px]",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D5FF32] disabled:cursor-not-allowed select-none";

export function Button({
  variant = "primary",
  loading,
  className,
  children,
  icon: Icon,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; icon?: ComponentType<{ className?: string }> }) {
  return (
    <button className={clsx(base, buttonStyles[variant], className)} disabled={loading || props.disabled} {...props}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  className,
  children,
  icon: Icon,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href} className={clsx(base, buttonStyles[variant], className)}>
      {Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
      {children}
    </Link>
  );
}

export function Card({
  className,
  children,
  as: As = "section",
  elevated = false,
}: {
  className?: string;
  children: ReactNode;
  as?: "section" | "div" | "article";
  elevated?: boolean;
}) {
  return (
    <As
      className={clsx(
        "min-w-0 rounded-xl border border-[#2A2D26] transition-colors",
        elevated ? "bg-[#20221D]" : "bg-[#10110F]",
        className
      )}
    >
      {children}
    </As>
  );
}

export function CardHeader({
  title,
  description,
  action,
  icon: Icon,
  badge,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  badge?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#2A2D26] px-5 py-3.5">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#2A2D26] bg-[#171915] text-[#D5FF32]">
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-[#F4F5F0]">{title}</h2>
            {badge}
          </div>
          {description && <p className="mt-0.5 text-xs text-[#A0A39A]">{description}</p>}
        </div>
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  badge,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[#2A2D26]/60 pb-5">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-[#F4F5F0]">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#A0A39A]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

type Tone = "slate" | "brand" | "red" | "amber" | "green" | "blue" | "violet";
const tones: Record<Tone, string> = {
  slate: "bg-[#171915] text-[#A0A39A] ring-[#2A2D26]",
  brand: "bg-[#D5FF32]/10 text-[#D5FF32] ring-[#D5FF32]/30",
  red: "bg-[#EF4444]/10 text-[#F87171] ring-[#EF4444]/30",
  amber: "bg-[#E5A83B]/10 text-[#FBBF24] ring-[#E5A83B]/30",
  green: "bg-[#10B981]/10 text-[#34D399] ring-[#10B981]/30",
  blue: "bg-[#38BDF8]/10 text-[#38BDF8] ring-[#38BDF8]/30",
  violet: "bg-[#A855F7]/10 text-[#C084FC] ring-[#A855F7]/30",
};

export function Badge({ tone = "slate", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide ring-1 ring-inset",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  tone = "brand",
  label,
  height = "h-1.5",
}: {
  value: number;
  tone?: "brand" | "red" | "amber" | "green" | "slate";
  label?: string;
  height?: string;
}) {
  const colors = {
    brand: "bg-[#D5FF32]",
    red: "bg-[#EF4444]",
    amber: "bg-[#E5A83B]",
    green: "bg-[#10B981]",
    slate: "bg-[#73776E]",
  };
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div
      className={clsx("w-full overflow-hidden rounded-full bg-[#171915] border border-[#2A2D26]", height)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={clsx("h-full rounded-full transition-all duration-300", colors[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function CircularProgress({
  value,
  size = 56,
  strokeWidth = 5,
  tone = "lime",
  label,
  children,
}: {
  value: number; // 0 to 1 or 0 to 100
  size?: number;
  strokeWidth?: number;
  tone?: "lime" | "dark" | "amber" | "red" | "green";
  label?: string;
  children?: ReactNode;
}) {
  const normalized = value > 1 ? value : Math.round(value * 100);
  const clamped = Math.max(0, Math.min(100, normalized));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  const strokeColors = {
    lime: "#D5FF32",
    dark: "#080908",
    amber: "#E5A83B",
    red: "#EF4444",
    green: "#10B981",
  };

  const trackColors = {
    lime: "#171915",
    dark: "rgba(8, 9, 8, 0.2)",
    amber: "#20221D",
    red: "#20221D",
    green: "#20221D",
  };

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} aria-label={label}>
      <svg width={size} height={size} className="-rotate-90 transform">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColors[tone]}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColors[tone]}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums">
        {children ?? `${clamped}%`}
      </div>
    </div>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "success" | "warning" | "error";
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const map = {
    info: { cls: "border-[#1E293B] bg-[#10141A] text-[#93C5FD]", Icon: Info, iconColor: "text-sky-400" },
    success: { cls: "border-[#1B3828] bg-[#0E1A14] text-[#A7F3D0]", Icon: CheckCircle2, iconColor: "text-emerald-400" },
    warning: { cls: "border-[#3D3017] bg-[#19150B] text-[#FDE68A]", Icon: AlertTriangle, iconColor: "text-amber-400" },
    error: { cls: "border-[#451818] bg-[#1C0E0E] text-[#FECACA]", Icon: XCircle, iconColor: "text-red-400" },
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={clsx("flex gap-3 rounded-lg border px-4 py-3 text-sm", map.cls, className)}>
      <map.Icon className={clsx("mt-0.5 h-4 w-4 shrink-0", map.iconColor)} aria-hidden />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed text-xs opacity-90">{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#2A2D26] bg-[#171915] text-[#D5FF32]">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="mt-4 text-base font-semibold text-[#F4F5F0]">{title}</h3>
      {children && <div className="mt-1.5 max-w-md text-xs leading-relaxed text-[#A0A39A]">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ label = "Loading intelligence…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-[#A0A39A]" role="status">
      <Loader2 className="h-5 w-5 animate-spin text-[#D5FF32]" aria-hidden /> {label}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  tone?: Tone;
}) {
  return (
    <Card className="p-4 relative overflow-hidden group hover:border-[#3A3F33] transition-colors">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#73776E]">{label}</p>
        {Icon && (
          <span className={clsx("flex h-6 w-6 items-center justify-center rounded-md ring-1 ring-inset", tones[tone])}>
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-[#F4F5F0]">{value}</p>
      {hint && <p className="mt-1 text-xs text-[#A0A39A] truncate">{hint}</p>}
    </Card>
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-semibold uppercase tracking-wider text-[#A0A39A]">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-[#73776E]">{hint}</p>}
    </div>
  );
}

export const inputClass =
  "block w-full rounded-lg border border-[#2A2D26] bg-[#10110F] px-3 py-2 text-sm text-[#F4F5F0] placeholder:text-[#73776E] shadow-sm transition-colors focus:border-[#D5FF32] focus:outline-none focus:ring-1 focus:ring-[#D5FF32] disabled:opacity-50 disabled:cursor-not-allowed";
