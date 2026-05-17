"use client";

import Link from "next/link";
import {
  getApplicationsByStatus,
  type ApplicationStatus,
} from "@/lib/fake-data";
import { StatusPill } from "@/components/lane/StatusPill";
import { SourceIcon } from "@/components/lane/SourceIcon";

const pipelineStatuses: ApplicationStatus[] = [
  "saved",
  "applied",
  "phone_screen",
  "interview",
  "offer",
];

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function PipelineKanban() {
  return (
    <div className="lane-card-flat overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--lane-border)" }}>
        <h2 className="lane-section-title">Pipeline</h2>
        <Link
          href="/applications"
          className="text-xs font-medium transition-colors duration-150"
          style={{ color: "var(--lane-text-tertiary)" }}
        >
          View all →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {pipelineStatuses.map((status, idx) => {
          const apps = getApplicationsByStatus(status);
          const displayed = apps.slice(0, 4);
          const isLast = idx === pipelineStatuses.length - 1;

          return (
            <div
              key={status}
              className="flex flex-col"
              style={{
                borderRight: isLast ? "none" : "1px solid var(--lane-border)",
              }}
            >
              {/* Column header */}
              <div
                className="px-3 py-2.5 flex items-center justify-between"
                style={{
                  backgroundColor: "var(--lane-surface-muted)",
                  borderBottom: "1px solid var(--lane-border)",
                }}
              >
                <StatusPill status={status} />
                <span
                  className="text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center"
                  style={{
                    backgroundColor: "var(--lane-surface)",
                    color: "var(--lane-text-tertiary)",
                    border: "1px solid var(--lane-border)",
                  }}
                >
                  {apps.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col p-2 gap-1.5 min-h-[120px]">
                {displayed.map((app) => (
                  <Link
                    key={app.id}
                    href={`/applications/${app.id}`}
                    className="block px-3 py-2.5 rounded-lg transition-all duration-150 cursor-pointer"
                    style={{ backgroundColor: "var(--lane-surface)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--lane-surface-muted)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--lane-surface)";
                    }}
                  >
                    <div
                      className="text-sm font-semibold truncate"
                      style={{ color: "var(--lane-text-primary)" }}
                    >
                      {app.company}
                    </div>
                    <div
                      className="text-xs truncate mt-0.5"
                      style={{ color: "var(--lane-text-secondary)" }}
                    >
                      {app.role}
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[11px]" style={{ color: "var(--lane-text-tertiary)" }}>
                        {timeAgo(app.applied_at || app.captured_at)}
                      </span>
                      <SourceIcon source={app.source} />
                    </div>
                  </Link>
                ))}
                {apps.length === 0 && (
                  <div className="flex items-center justify-center h-full text-xs" style={{ color: "var(--lane-text-tertiary)" }}>
                    No applications
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
