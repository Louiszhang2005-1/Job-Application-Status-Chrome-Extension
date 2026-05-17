"use client";

import { getOverdueFollowups } from "@/lib/fake-data";
import { Clock, Check, RotateCw } from "lucide-react";
import Link from "next/link";

function daysOverdue(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return `${days}d ago`;
}

export function FollowupSection() {
  const overdue = getOverdueFollowups();

  return (
    <div className="lane-card-flat overflow-hidden">
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--lane-border)" }}
      >
        <div className="flex items-center gap-2">
          <Clock size={15} style={{ color: "var(--lane-text-tertiary)" }} />
          <h2 className="lane-section-title">Follow Up</h2>
          {overdue.length > 0 && (
            <span
              className="text-[11px] font-semibold rounded-full px-2 py-0.5"
              style={{ backgroundColor: "var(--status-applied-bg)", color: "var(--status-applied-text)" }}
            >
              {overdue.length}
            </span>
          )}
        </div>
      </div>

      <div className="divide-y" style={{ borderColor: "var(--lane-border)" }}>
        {overdue.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--lane-text-tertiary)" }}>
            No overdue follow-ups — nice work
          </div>
        ) : (
          overdue.map((app) => {
            const days = daysOverdue(app.next_followup_at!);
            return (
              <div key={app.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/applications/${app.id}`}
                      className="text-sm font-semibold hover:underline"
                      style={{ color: "var(--lane-text-primary)" }}
                    >
                      {app.company}
                    </Link>
                    <span className="text-sm ml-1" style={{ color: "var(--lane-text-secondary)" }}>
                      · {app.role}
                    </span>
                    <div className="text-xs mt-1" style={{ color: "var(--lane-text-tertiary)" }}>
                      Applied {timeAgo(app.applied_at)} · followup{" "}
                      <span className="font-semibold" style={{ color: "#a8632a" }}>
                        {days}d overdue
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-150 hover:bg-[var(--lane-surface-muted)]" style={{ color: "var(--status-interview-text)" }}>
                    <Check size={12} /> Done
                  </button>
                  <button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-150 hover:bg-[var(--lane-surface-muted)]" style={{ color: "var(--lane-text-tertiary)" }}>
                    <RotateCw size={11} /> Snooze 3 days
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
