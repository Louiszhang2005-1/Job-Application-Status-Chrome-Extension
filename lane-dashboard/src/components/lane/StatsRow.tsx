"use client";

import { getStats } from "@/lib/fake-data";
import { Briefcase, TrendingUp, Percent, Clock, Trophy, ArrowUp, ArrowDown } from "lucide-react";

// Trend data (fake — simulates change from last week)
const trends = [
  { delta: "+3", direction: "up" as const, label: "this week" },
  { delta: "+2", direction: "up" as const, label: "this week" },
  { delta: "+5%", direction: "up" as const, label: "vs last month" },
  { delta: "-1.2d", direction: "down" as const, label: "improving" },
  { delta: "+1", direction: "up" as const, label: "this month" },
];

const iconConfigs = [
  { icon: Briefcase, bg: "var(--status-applied-bg)", color: "var(--status-applied-text)" },
  { icon: TrendingUp, bg: "var(--status-phone-screen-bg)", color: "var(--status-phone-screen-text)" },
  { icon: Percent, bg: "var(--status-interview-bg)", color: "var(--status-interview-text)" },
  { icon: Clock, bg: "var(--status-saved-bg)", color: "var(--status-saved-text)" },
  { icon: Trophy, bg: "var(--status-offer-bg)", color: "var(--status-offer-text)" },
];

export function StatsRow() {
  const stats = getStats();

  const items = [
    { label: "Total Applied", value: stats.totalApplied.toString() },
    { label: "Active Pipeline", value: stats.activePipeline.toString() },
    { label: "Response Rate", value: `${stats.responseRate}%` },
    { label: "Avg Response", value: typeof stats.avgDaysToResponse === "string" ? stats.avgDaysToResponse : `${stats.avgDaysToResponse}d` },
    { label: "Offers", value: stats.offers.toString() },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((item, i) => {
        const { icon: Icon, bg, color } = iconConfigs[i];
        const trend = trends[i];
        const trendIsPositive = trend.direction === "up";

        return (
          <div key={item.label} className="lane-card px-4 py-4">
            {/* Icon + trend row */}
            <div className="flex items-center justify-between mb-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: bg }}
              >
                <Icon size={16} style={{ color }} />
              </div>
              <span
                className="inline-flex items-center gap-0.5 text-[11px] font-semibold rounded-full px-1.5 py-0.5"
                style={{
                  color: trendIsPositive ? "var(--status-interview-text)" : "var(--status-applied-text)",
                  backgroundColor: trendIsPositive ? "var(--status-interview-bg)" : "var(--status-applied-bg)",
                }}
              >
                {trendIsPositive ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
                {trend.delta}
              </span>
            </div>

            {/* Value + label */}
            <span className="lane-stat text-[28px]">{item.value}</span>
            <span className="lane-label block mt-1">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
