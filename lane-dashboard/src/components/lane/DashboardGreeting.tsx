"use client";

import { Search } from "lucide-react";

export function DashboardGreeting() {
  const now = new Date();
  const hour = now.getHours();
  let greeting = "Good morning";
  if (hour >= 12 && hour < 17) greeting = "Good afternoon";
  if (hour >= 17) greeting = "Good evening";

  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--lane-text-primary)" }}
        >
          {greeting}, Louis
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--lane-text-tertiary)" }}>
          {dateStr} — Track your progress here.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--lane-text-tertiary)" }}
        />
        <input
          type="text"
          placeholder="Search applications..."
          className="pl-9 pr-3 py-2 rounded-lg text-sm w-full sm:w-64 outline-none transition-colors duration-150"
          style={{
            backgroundColor: "var(--lane-surface)",
            border: "1px solid var(--lane-border)",
            color: "var(--lane-text-primary)",
          }}
        />
        <kbd
          className="hidden sm:inline-flex absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: "var(--lane-surface-muted)",
            color: "var(--lane-text-tertiary)",
            border: "1px solid var(--lane-border)",
          }}
        >
          ⌘K
        </kbd>
      </div>
    </div>
  );
}
