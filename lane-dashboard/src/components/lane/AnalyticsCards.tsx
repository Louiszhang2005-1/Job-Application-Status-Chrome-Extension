"use client";

import { getFunnelData, getSourceBreakdown, getLocationBreakdown } from "@/lib/fake-data";
import { BarChart2, MapPin, Globe } from "lucide-react";

export function FunnelChart() {
  const funnel = getFunnelData();
  const maxCount = funnel[0]?.count || 1;

  return (
    <div className="lane-card-flat overflow-hidden">
      <div
        className="px-5 py-3.5 flex items-center gap-2"
        style={{ borderBottom: "1px solid var(--lane-border)" }}
      >
        <BarChart2 size={15} style={{ color: "var(--lane-text-tertiary)" }} />
        <h2 className="lane-section-title">Conversion Funnel</h2>
      </div>
      <div className="px-5 py-4 space-y-3">
        {funnel.map((stage) => (
          <div key={stage.stage}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[13px] font-medium" style={{ color: "var(--lane-text-primary)" }}>
                {stage.stage}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold" style={{ color: "var(--lane-text-primary)" }}>
                  {stage.count}
                </span>
                <span
                  className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full min-w-[36px] text-center"
                  style={{
                    backgroundColor: stage.rate >= 50 ? "var(--status-interview-bg)" : stage.rate >= 20 ? "var(--status-applied-bg)" : "var(--status-rejected-bg)",
                    color: stage.rate >= 50 ? "var(--status-interview-text)" : stage.rate >= 20 ? "var(--status-applied-text)" : "var(--status-rejected-text)",
                  }}
                >
                  {stage.rate}%
                </span>
              </div>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: "var(--lane-surface-muted)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(stage.count / maxCount) * 100}%`,
                  backgroundColor: stage.fill,
                  opacity: 0.7,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SourceBreakdownCard() {
  const sources = getSourceBreakdown();
  const total = sources.reduce((sum, s) => sum + s.count, 0);

  const sourceColors: Record<string, string> = {
    "Company Site": "#9a9388",
    "LinkedIn": "#0a66c2",
    "Indeed": "#2164f3",
    "Greenhouse": "#3b8427",
    "Workday": "#0875e1",
    "Lever": "#5a4fcf",
    "Ashby": "#1a1a1a",
    "Other": "#9a9388",
  };

  return (
    <div className="lane-card-flat overflow-hidden">
      <div
        className="px-5 py-3.5 flex items-center gap-2"
        style={{ borderBottom: "1px solid var(--lane-border)" }}
      >
        <Globe size={15} style={{ color: "var(--lane-text-tertiary)" }} />
        <h2 className="lane-section-title">By Source</h2>
      </div>
      <div className="px-5 py-4 space-y-2.5">
        {sources.map((source) => {
          const pct = Math.round((source.count / total) * 100);
          return (
            <div key={source.name} className="flex items-center gap-3">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: sourceColors[source.name] || "#9a9388" }}
              />
              <span className="text-[13px] flex-1" style={{ color: "var(--lane-text-secondary)" }}>
                {source.name}
              </span>
              <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--lane-text-primary)" }}>
                {source.count}
              </span>
              <span className="text-[11px] w-8 text-right" style={{ color: "var(--lane-text-tertiary)" }}>
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LocationBreakdownCard() {
  const locations = getLocationBreakdown();
  const total = locations.reduce((sum, l) => sum + l.count, 0);

  return (
    <div className="lane-card-flat overflow-hidden">
      <div
        className="px-5 py-3.5 flex items-center gap-2"
        style={{ borderBottom: "1px solid var(--lane-border)" }}
      >
        <MapPin size={15} style={{ color: "var(--lane-text-tertiary)" }} />
        <h2 className="lane-section-title">By Location</h2>
      </div>
      <div className="px-5 py-4 space-y-2.5">
        {locations.map((loc) => {
          const pct = Math.round((loc.count / total) * 100);
          return (
            <div key={loc.region} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-medium" style={{ color: "var(--lane-text-primary)" }}>
                    {loc.region}
                  </span>
                  <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--lane-text-primary)" }}>
                    {loc.count}
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: "var(--lane-surface-muted)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: "var(--lane-text-tertiary)",
                      opacity: 0.5,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
