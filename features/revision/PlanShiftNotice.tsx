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
  const shifts = [...lastPlanShift].sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before)).slice(0, 6);
  return (
    <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 px-5 py-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-brand-900">
        <RefreshCw className="h-4 w-4" aria-hidden /> Your revision plan was recalculated from these results
      </p>
      <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
        {shifts.map((s) => {
          const up = s.after > s.before;
          return (
            <li key={s.topicId} className="flex items-center gap-2 text-brand-900">
              {up ? <ArrowUpRight className="h-4 w-4 text-red-600" aria-hidden /> : <ArrowDownRight className="h-4 w-4 text-emerald-600" aria-hidden />}
              <span className="font-medium">{d.topicName(s.topicId)}</span>
              <span className="text-brand-700">
                {formatMinutes(s.before)} → {formatMinutes(s.after)}
              </span>
            </li>
          );
        })}
      </ul>
      <Link href="/revision-plan" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">
        Open the updated plan →
      </Link>
    </div>
  );
}
