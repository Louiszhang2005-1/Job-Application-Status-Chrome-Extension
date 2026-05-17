"use client";

import { getUnreadEmails, getCompanyForEmail } from "@/lib/fake-data";
import { StatusPill } from "@/components/lane/StatusPill";
import { Mail, Check, X, ExternalLink } from "lucide-react";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export function CompanyReplies() {
  const unreadEmails = getUnreadEmails();

  return (
    <div className="lane-card-flat overflow-hidden">
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--lane-border)" }}
      >
        <div className="flex items-center gap-2">
          <Mail size={15} style={{ color: "var(--lane-text-tertiary)" }} />
          <h2 className="lane-section-title">Company Replies</h2>
          {unreadEmails.length > 0 && (
            <span
              className="text-[11px] font-semibold rounded-full px-2 py-0.5"
              style={{ backgroundColor: "var(--status-applied-bg)", color: "var(--status-applied-text)" }}
            >
              {unreadEmails.length}
            </span>
          )}
        </div>
        <button
          className="text-xs font-medium transition-colors duration-150"
          style={{ color: "var(--lane-text-tertiary)" }}
        >
          Mark all read
        </button>
      </div>

      <div className="divide-y" style={{ borderColor: "var(--lane-border)" }}>
        {unreadEmails.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--lane-text-tertiary)" }}>
            No new replies — you&apos;re all caught up
          </div>
        ) : (
          unreadEmails.map((email) => {
            const app = getCompanyForEmail(email);
            return (
              <div
                key={email.id}
                className="px-4 py-3.5 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: "var(--lane-text-primary)" }}>
                        {app?.company}
                      </span>
                      <span className="text-[11px]" style={{ color: "var(--lane-text-tertiary)" }}>
                        {timeAgo(email.received_at)}
                      </span>
                    </div>
                    <div className="text-sm mt-0.5 truncate" style={{ color: "var(--lane-text-secondary)" }}>
                      &ldquo;{email.subject}&rdquo;
                    </div>
                    <div className="text-xs mt-1 line-clamp-1" style={{ color: "var(--lane-text-tertiary)" }}>
                      {email.snippet}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {email.suggested_status && (
                    <>
                      <span className="text-[11px] mr-1" style={{ color: "var(--lane-text-tertiary)" }}>
                        Suggested:
                      </span>
                      <StatusPill status={email.suggested_status} />
                      <button className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors duration-150 hover:bg-[var(--lane-surface-muted)]" style={{ color: "var(--status-interview-text)" }}>
                        <Check size={12} /> Accept
                      </button>
                      <button className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors duration-150 hover:bg-[var(--lane-surface-muted)]" style={{ color: "var(--lane-text-tertiary)" }}>
                        <X size={12} /> Dismiss
                      </button>
                    </>
                  )}
                  <button className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors duration-150 hover:bg-[var(--lane-surface-muted)] ml-auto" style={{ color: "var(--lane-text-tertiary)" }}>
                    <ExternalLink size={11} /> View email
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
