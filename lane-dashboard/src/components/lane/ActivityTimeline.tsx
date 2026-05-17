"use client";

import { fakeActivity } from "@/lib/fake-data";
import { ArrowRight, Mail, Plus } from "lucide-react";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

export function ActivityTimeline() {
  const recent = fakeActivity.slice(0, 10);
  const groups = groupByDay(recent);

  return (
    <div className="lane-card-flat overflow-hidden">
      <div
        className="px-4 py-3"
        style={{ borderBottom: "1px solid var(--lane-border)" }}
      >
        <h2 className="lane-section-title">Recent Activity</h2>
      </div>

      <div className="px-4 py-3">
        {groups.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            <div className="lane-label mb-2">{group.label}</div>
            <div className="space-y-2">
              {group.entries.map((entry) => (
                <div key={entry.id} className="flex items-start gap-2.5">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center mt-0.5 shrink-0"
                    style={{ backgroundColor: "var(--lane-surface-muted)" }}
                  >
                    {entry.action === "status_change" && (
                      <ArrowRight size={11} style={{ color: "var(--lane-text-tertiary)" }} />
                    )}
                    {entry.action === "email_detected" && (
                      <Mail size={11} style={{ color: "#a8632a" }} />
                    )}
                    {entry.action === "created" && (
                      <Plus size={11} style={{ color: "var(--lane-text-tertiary)" }} />
                    )}
                  </div>
                  <div className="text-sm" style={{ color: "var(--lane-text-secondary)" }}>
                    {entry.action === "created" && (
                      <>
                        Saved: <span className="font-medium" style={{ color: "var(--lane-text-primary)" }}>{entry.company}</span>
                        {" · "}{entry.role}
                      </>
                    )}
                    {entry.action === "status_change" && entry.details && (
                      <>
                        <span className="font-medium" style={{ color: "var(--lane-text-primary)" }}>{entry.company}</span>
                        {" → "}
                        <span className="font-medium capitalize">
                          {entry.details.to.replace("_", " ")}
                        </span>
                      </>
                    )}
                    {entry.action === "email_detected" && (
                      <>
                        <Mail size={11} className="inline mr-1" style={{ color: "#a8632a" }} />
                        <span className="font-medium" style={{ color: "var(--lane-text-primary)" }}>{entry.company}</span>
                        {" replied: \""}{entry.subject}&rdquo;
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
