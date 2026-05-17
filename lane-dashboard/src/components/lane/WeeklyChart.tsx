"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { getWeeklyVolume } from "@/lib/fake-data";
import { TrendingUp } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  return (
    <div
      className="px-3 py-2 rounded-lg text-xs shadow-md"
      style={{
        backgroundColor: "var(--lane-surface)",
        border: "1px solid var(--lane-border)",
      }}
    >
      <div className="font-semibold mb-1" style={{ color: "var(--lane-text-primary)" }}>
        Week of {label}
      </div>
      {payload.map((entry: { name: string; value: number; color: string }) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span style={{ color: "var(--lane-text-secondary)" }}>
            {entry.name}: <strong>{entry.value}</strong>
          </span>
        </div>
      ))}
    </div>
  );
}

export function WeeklyChart() {
  const data = getWeeklyVolume();
  const thisWeek = data[data.length - 1]?.applications || 0;
  const lastWeek = data[data.length - 2]?.applications || 0;
  const diff = thisWeek - lastWeek;

  return (
    <div className="lane-card-flat overflow-hidden">
      <div
        className="px-5 py-3.5 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--lane-border)" }}
      >
        <div className="flex items-center gap-2">
          <TrendingUp size={15} style={{ color: "var(--lane-text-tertiary)" }} />
          <h2 className="lane-section-title">Weekly Applications</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold" style={{ color: "var(--lane-text-primary)" }}>
            {thisWeek}
          </span>
          <span className="text-xs" style={{ color: "var(--lane-text-tertiary)" }}>
            this week
          </span>
          {diff !== 0 && (
            <span
              className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: diff > 0 ? "var(--status-interview-bg)" : "var(--status-rejected-bg)",
                color: diff > 0 ? "var(--status-interview-text)" : "var(--status-rejected-text)",
              }}
            >
              {diff > 0 ? "+" : ""}{diff}
            </span>
          )}
        </div>
      </div>
      <div className="px-4 py-4">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--lane-border)" vertical={false} />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: "var(--lane-text-tertiary)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--lane-text-tertiary)" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={24}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--lane-surface-muted)" }} />
            <Legend
              iconType="circle"
              iconSize={6}
              wrapperStyle={{ fontSize: 11, color: "var(--lane-text-tertiary)" }}
            />
            <Bar
              dataKey="applications"
              name="Applied"
              fill="var(--status-applied-text)"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
            <Bar
              dataKey="responses"
              name="Responses"
              fill="var(--status-phone-screen-text)"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
