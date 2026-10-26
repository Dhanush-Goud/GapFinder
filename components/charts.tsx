"use client";
// Recharts wrappers. Every series is computed from stored attempts / mastery snapshots.
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const PALETTE = ["#4f46e5", "#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#64748b", "#ec4899"];
const pctTick = (v: number) => `${v}%`;

export function ScoreTrend({ data, height = 220 }: { data: { label: string; score: number; sample?: boolean }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} />
        <YAxis domain={[0, 100]} tickFormatter={pctTick} tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} width={44} />
        <Tooltip formatter={(v) => [`${v}%`, "Score"]} contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12 }} />
        <Line type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 4, fill: "#4f46e5" }} activeDot={{ r: 6 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function MasteryOverTime({ data, series, height = 280 }: { data: Record<string, string | number | null>[]; series: { key: string; name: string }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} />
        <YAxis domain={[0, 100]} tickFormatter={pctTick} tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} width={44} />
        <Tooltip formatter={(v) => (v === null || v === undefined ? "—" : `${v}%`)} contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function FirstVsLatest({ data, height = 260 }: { data: { name: string; first: number; latest: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} interval={0} />
        <YAxis domain={[0, 100]} tickFormatter={pctTick} tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} width={44} />
        <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="first" name="First assessment" fill="#cbd5e1" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="latest" name="Latest" fill="#4f46e5" radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
