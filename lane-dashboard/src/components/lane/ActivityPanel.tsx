"use client";

import { fakeActivity } from "@/lib/fake-data";
import { ArrowRight, Mail, Plus, Clock } from "lucide-react";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function groupByDay(entries: typeof fakeActivity) {
  const groups: { label: string; entries: typeof fakeActivity }[] = [];
  const map = new Map<string, typeof fakeActivity>();

  for (const entry of entries) {
    const label = formatDate(entry.created_at);
    if (!map.has(label)) {
      map.set(label, []);
    }
    map.get(label)!.push(entry);
  }

  for (const [label, entries] of map) {
    groups.push({ label, entries });
  }

  return groups;
}

export function ActivityPanel() {
  const recent = fakeActivity.slice(0, 12);
  const groups = groupByDay(recent);

  return (
    <aside
      className="hidden xl:flex flex-col w-[280px] shrink-0 sticky top-0 h-screen overflow-y-auto"
      style={{
        backgroundColor: "var(--lane-surface)",
        borderLeft: "1px solid var(--lane-border)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-5 h-16"
        style={{ borderBottom: "1px solid var(--lane-border)" }}
      >
        <Clock size={15} style={{ color: "var(--lane-text-tertiary)" }} />
        <span className="text-[13px] font-semibold" style={{ color: "var(--lane-text-primary)" }}>
          Activity
        </span>
      </div>

      {/* Activity feed */}
      <div className="px-4 py-4 space-y-5">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="lane-label mb-2.5">{group.label}</div>
            <div className="space-y-3">
              {group.entries.map((entry) => (
                <div key={entry.id} className="flex items-start gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center mt-0.5 shrink-0"
                    style={{ backgroundColor: getIconBg(entry.action) }}
                  >
                    {entry.action === "status_change" && (
                      <ArrowRight size={11} style={{ color: getIconColor(entry.action) }} />
                    )}
                    {entry.action === "email_detected" && (
                      <Mail size={11} style={{ color: getIconColor(entry.action) }} />
                    )}
                    {entry.action === "created" && (
                      <Plus size={11} style={{ color: getIconColor(entry.action) }} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] leading-snug" style={{ color: "var(--lane-text-secondary)" }}>
                      {entry.action === "created" && (
                        <>
                          <span className="font-semibold" style={{ color: "var(--lane-text-primary)" }}>
                            {entry.company}
                          </span>
                          <br />
                          <span className="text-[11px]" style={{ color: "var(--lane-text-tertiary)" }}>
                            {entry.role} saved
                          </span>
                        </>
                      )}
                      {entry.action === "status_change" && entry.details && (
                        <>
                          <span className="font-semibold" style={{ color: "var(--lane-text-primary)" }}>
                            {entry.company}
                          </span>
                          <br />
                          <span className="text-[11px]" style={{ color: "var(--lane-text-tertiary)" }}>
                            → {entry.details.to.replace("_", " ")}
                          </span>
                        </>
                      )}
                      {entry.action === "email_detected" && (
                        <>
                          <span className="font-semibold" style={{ color: "var(--lane-text-primary)" }}>
                            {entry.company}
                          </span>
                          <br />
                          <span className="text-[11px]" style={{ color: "var(--lane-text-tertiary)" }}>
                            replied: &ldquo;{entry.subject}&rdquo;
                          </span>
                        </>
                      )}
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: "var(--lane-text-tertiary)" }}>
                      {formatTime(entry.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function getIconBg(action: string): string {
  switch (action) {
    case "email_detected": return "var(--status-applied-bg)";
    case "status_change": return "var(--status-phone-screen-bg)";
    default: return "var(--lane-surface-muted)";
  }
}

function getIconColor(action: string): string {
  switch (action) {
    case "email_detected": return "var(--status-applied-text)";
    case "status_change": return "var(--status-phone-screen-text)";
    default: return "var(--lane-text-tertiary)";
  }
}
