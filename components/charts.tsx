"use client";
// Recharts wrappers for Intelligence Lab.
// Every series is strictly computed from stored attempts / mastery snapshots / actual dated events.
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Intelligence Lab palette: Lime accent is prominent, supplemented by muted cyan, amber, emerald, violet
const LAB_PALETTE = ["#D5FF32", "#38BDF8", "#E5A83B", "#34D399", "#C084FC", "#F87171", "#A0A39A", "#818CF8"];
const pctTick = (v: number) => `${v}%`;

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number | string | null; name: string; color: string; dataKey?: string }>;
  label?: string;
}

function DarkTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-[#2A2D26] bg-[#171915] px-3 py-2 shadow-lg">
      {label && <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#73776E]">{label}</p>}
      <div className="space-y-1">
        {payload.map((p, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-[#A0A39A]">{p.name}:</span>
            <span className="font-bold tabular-nums text-[#F4F5F0]">
              {p.value === null || p.value === undefined ? "—" : typeof p.value === "number" ? `${p.value}%` : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScoreTrend({ data, height = 220 }: { data: { label: string; score: number; sample?: boolean }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 12, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#2A2D26" strokeDasharray="2 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#73776E" }}
          tickLine={false}
          axisLine={{ stroke: "#2A2D26" }}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={pctTick}
          tick={{ fontSize: 11, fill: "#73776E" }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip content={<DarkTooltip />} />
        <Line
          type="monotone"
          dataKey="score"
          name="Diagnostic Score"
          stroke="#D5FF32"
          strokeWidth={2.5}
          dot={{ r: 4, fill: "#D5FF32", stroke: "#080908", strokeWidth: 1.5 }}
          activeDot={{ r: 6, fill: "#D5FF32", stroke: "#F4F5F0", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function MasteryOverTime({
  data,
  series,
  height = 280,
}: {
  data: Record<string, string | number | null>[];
  series: { key: string; name: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 12, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#2A2D26" strokeDasharray="2 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#73776E" }}
          tickLine={false}
          axisLine={{ stroke: "#2A2D26" }}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={pctTick}
          tick={{ fontSize: 11, fill: "#73776E" }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip content={<DarkTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          formatter={(val) => <span className="text-[#A0A39A] hover:text-[#F4F5F0] transition-colors">{val}</span>}
        />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={LAB_PALETTE[i % LAB_PALETTE.length]}
            strokeWidth={2}
            dot={{ r: 3, fill: LAB_PALETTE[i % LAB_PALETTE.length] }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function FirstVsLatest({ data, height = 260 }: { data: { name: string; first: number; latest: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 12, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#2A2D26" strokeDasharray="2 3" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "#73776E" }}
          tickLine={false}
          axisLine={{ stroke: "#2A2D26" }}
          interval={0}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={pctTick}
          tick={{ fontSize: 11, fill: "#73776E" }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip content={<DarkTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          formatter={(val) => <span className="text-[#A0A39A]">{val}</span>}
        />
        <Bar dataKey="first" name="Initial Assessment" fill="#2A2D26" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="latest" name="Current Mastery" fill="#D5FF32" radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Activity Heatmap Grid for Intelligence Lab.
 * Renders small activity squares with subtle intensity differences based on real dated learning events.
 */
export function ActivityHeatmap({
  events,
  weeks = 12,
}: {
  events: { date: string; count: number }[];
  weeks?: number;
}) {
  // Generate date grid for the last N weeks
  const today = new Date();
  const dayMap = new Map<string, number>();
  for (const e of events) {
    dayMap.set(e.date, (dayMap.get(e.date) ?? 0) + e.count);
  }

  const days: { dateStr: string; count: number; dayOfWeek: number }[] = [];
  const totalDays = weeks * 7;
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    days.push({
      dateStr,
      count: dayMap.get(dateStr) ?? 0,
      dayOfWeek: d.getDay(),
    });
  }

  // Intensity color map
  const getCellColor = (count: number) => {
    if (count === 0) return "bg-[#171915] border-[#2A2D26]/60";
    if (count === 1) return "bg-[#506610] border-[#D5FF32]/30";
    if (count <= 3) return "bg-[#82A816] border-[#D5FF32]/50";
    return "bg-[#D5FF32] border-[#D5FF32]";
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 text-[10px] uppercase tracking-wider text-[#73776E]">
        <span>Recent 12-week activity</span>
        <div className="flex items-center gap-1.5">
          <span>Less</span>
          <span className="h-2 w-2 rounded-sm bg-[#171915] border border-[#2A2D26]" />
          <span className="h-2 w-2 rounded-sm bg-[#506610]" />
          <span className="h-2 w-2 rounded-sm bg-[#82A816]" />
          <span className="h-2 w-2 rounded-sm bg-[#D5FF32]" />
          <span>More</span>
        </div>
      </div>
      <div className="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto pb-1">
        {days.map((d) => (
          <div
            key={d.dateStr}
            title={`${d.dateStr}: ${d.count} event(s)`}
            className={`h-2.5 w-2.5 rounded-[2px] border transition-colors ${getCellColor(d.count)}`}
          />
        ))}
      </div>
    </div>
  );
}
