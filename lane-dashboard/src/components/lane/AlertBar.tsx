"use client";

import { getUnreadEmails, getOverdueFollowups } from "@/lib/fake-data";
import { Mail, Clock } from "lucide-react";

export function AlertBar() {
  const unreadEmails = getUnreadEmails();
  const overdueFollowups = getOverdueFollowups();

  if (unreadEmails.length === 0 && overdueFollowups.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-4 px-4 py-2.5 rounded-xl text-sm"
      style={{
        backgroundColor: "var(--lane-surface)",
        border: "1px solid var(--lane-border)",
      }}
    >
      {unreadEmails.length > 0 && (
        <span className="flex items-center gap-2" style={{ color: "var(--lane-text-secondary)" }}>
          <Mail size={14} style={{ color: "#a8632a" }} />
          <span>
            <strong>{unreadEmails.length}</strong> new company {unreadEmails.length === 1 ? "reply" : "replies"}
          </span>
        </span>
      )}
      {unreadEmails.length > 0 && overdueFollowups.length > 0 && (
        <span style={{ color: "var(--lane-border)" }}>·</span>
      )}
      {overdueFollowups.length > 0 && (
        <span className="flex items-center gap-2" style={{ color: "var(--lane-text-secondary)" }}>
          <Clock size={14} style={{ color: "#a8632a" }} />
          <span>
            <strong>{overdueFollowups.length}</strong> {overdueFollowups.length === 1 ? "followup" : "followups"} overdue
          </span>
        </span>
      )}
    </div>
  );
}
