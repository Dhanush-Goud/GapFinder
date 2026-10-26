"use client";
import { ArrowDownRight, ArrowUpRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { formatMinutes } from "@/components/domain";
import { useAppState } from "@/features/app-state/AppStateProvider";
import { useDerived } from "@/features/app-state/useDerived";

/** Shows how the last re-plan moved study time between topics — evidence that the plan adapts. */
export function PlanShiftNotice() {
  const { lastPlanShift, state } = useAppState();
  const d = useDerived();
  if (!state.plan || lastPlanShift.length === 0) return null;
  const shifts = [...lastPlanShift]
    .sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))
    .slice(0, 6);

  return (
    <div className="rounded-xl border border-[#D5FF32]/40 bg-[#171915] p-5 shadow-[0_0_16px_-4px_rgba(213,255,50,0.12)]">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#D5FF32]">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Revision Plan Recalibrated from Diagnostic Telemetry
      </p>
      <ul className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        {shifts.map((s) => {
          const up = s.after > s.before;
          return (
            <li
              key={s.topicId}
              className="flex items-center justify-between rounded-lg border border-[#2A2D26] bg-[#10110F] px-3 py-2 text-[#F4F5F0]"
            >
              <div className="flex items-center gap-2 min-w-0">
                {up ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-[#EF4444] shrink-0" aria-hidden />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-[#10B981] shrink-0" aria-hidden />
                )}
                <span className="font-semibold truncate">{d.topicName(s.topicId)}</span>
              </div>
              <span className="tabular-nums text-xs text-[#A0A39A] shrink-0 ml-2">
                {formatMinutes(s.before)} →{" "}
                <strong className={up ? "text-[#EF4444]" : "text-[#10B981]"}>{formatMinutes(s.after)}</strong>
              </span>
            </li>
          );
        })}
      </ul>
      <Link
        href="/revision-plan"
        className="mt-3 inline-block text-xs font-semibold text-[#D5FF32] hover:underline"
      >
        View Updated Daily Schedule →
      </Link>
    </div>
  );
}
