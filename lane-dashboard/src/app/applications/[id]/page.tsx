"use client";

import { use } from "react";
import Link from "next/link";
import { AppShell } from "@/components/lane/AppShell";
import { StatusPill } from "@/components/lane/StatusPill";
import { SourceIcon } from "@/components/lane/SourceIcon";
import {
  getApplicationById,
  getEmailsForApplication,
  getActivityForApplication,
  type ApplicationStatus,
} from "@/lib/fake-data";
import {
  ArrowLeft,
  ExternalLink,
  Mail,
  ArrowRight,
  Plus,
  Calendar,
  FileText,
  MapPin,
  Trash2,
} from "lucide-react";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

type TimelineItem = {
  id: string;
  type: "activity" | "email";
  date: string;
  content: React.ReactNode;
};

export default function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const app = getApplicationById(id);

  if (!app) {
    return (
      <AppShell>
        <div className="px-6 lg:px-8 py-12 text-center max-w-[1100px]">
          <h1 className="lane-heading mb-2">Application not found</h1>
          <Link href="/applications" className="text-sm underline" style={{ color: "var(--lane-text-secondary)" }}>
            ← Back to applications
          </Link>
        </div>
      </AppShell>
    );
  }

  const emails = getEmailsForApplication(id);
  const activity = getActivityForApplication(id);

  // Merge into timeline
  const timeline: TimelineItem[] = [
    ...activity.map((a) => ({
      id: a.id,
      type: "activity" as const,
      date: a.created_at,
      content: (
        <span className="text-sm" style={{ color: "var(--lane-text-secondary)" }}>
          {a.action === "created" && <>Application saved</>}
          {a.action === "status_change" && a.details && (
            <>
              Status changed:{" "}
              <span className="capitalize">{a.details.from.replace("_", " ")}</span>
              {" → "}
              <span className="font-medium capitalize">{a.details.to.replace("_", " ")}</span>
            </>
          )}
          {a.action === "email_detected" && (
            <>📧 Email detected: &ldquo;{a.subject}&rdquo;</>
          )}
        </span>
      ),
    })),
    ...emails.map((e) => ({
      id: e.id,
      type: "email" as const,
      date: e.received_at,
      content: (
        <div>
          <span className="text-sm font-medium" style={{ color: "var(--lane-text-primary)" }}>
            📧 {e.from_name}
          </span>
          <div className="text-sm mt-0.5" style={{ color: "var(--lane-text-secondary)" }}>
            &ldquo;{e.subject}&rdquo;
          </div>
          <div className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--lane-text-tertiary)" }}>
            {e.snippet}
          </div>
        </div>
      ),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <AppShell>
      <div className="px-6 lg:px-8 py-6 max-w-[1100px]">
        {/* Back link */}
        <Link
          href="/applications"
          className="inline-flex items-center gap-1.5 text-sm mb-4 transition-colors duration-150"
          style={{ color: "var(--lane-text-tertiary)" }}
        >
          <ArrowLeft size={14} /> Back to applications
        </Link>

        {/* Header */}
        <div
          className="lane-card-flat px-6 py-5 mb-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1
                className="text-2xl font-bold"
                style={{ color: "var(--lane-text-primary)" }}
              >
                {app.company}{" "}
                <span className="font-normal" style={{ color: "var(--lane-text-secondary)" }}>
                  · {app.role}
                </span>
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <StatusPill status={app.status} size="md" />
                {app.location && (
                  <span className="flex items-center gap-1 text-sm" style={{ color: "var(--lane-text-tertiary)" }}>
                    <MapPin size={13} /> {app.location}
                  </span>
                )}
                <SourceIcon source={app.source} />
              </div>
            </div>
            <a
              href={app.job_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
              style={{
                backgroundColor: "var(--lane-surface-muted)",
                color: "var(--lane-text-secondary)",
                border: "1px solid var(--lane-border)",
              }}
            >
              <ExternalLink size={14} /> Open posting
            </a>
          </div>
        </div>

        {/* Content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Timeline + Notes */}
          <div className="lg:col-span-2 space-y-6">
            {/* Timeline */}
            <div className="lane-card-flat overflow-hidden">
              <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--lane-border)" }}>
                <h2 className="lane-section-title">Timeline</h2>
              </div>
              <div className="px-5 py-4 space-y-4">
                {timeline.length === 0 ? (
                  <div className="text-sm text-center py-4" style={{ color: "var(--lane-text-tertiary)" }}>
                    No activity yet
                  </div>
                ) : (
                  timeline.map((item) => (
                    <div key={item.id} className="flex items-start gap-3">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center mt-0.5 shrink-0"
                        style={{ backgroundColor: "var(--lane-surface-muted)" }}
                      >
                        {item.type === "email" ? (
                          <Mail size={12} style={{ color: "#a8632a" }} />
                        ) : (
                          <ArrowRight size={12} style={{ color: "var(--lane-text-tertiary)" }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {item.content}
                        <div className="text-[11px] mt-1" style={{ color: "var(--lane-text-tertiary)" }}>
                          {formatShort(item.date)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="lane-card-flat overflow-hidden">
              <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--lane-border)" }}>
                <h2 className="lane-section-title">Notes</h2>
              </div>
              <div className="px-5 py-4">
                <textarea
                  defaultValue={app.notes}
                  placeholder="Add notes about this application..."
                  rows={4}
                  className="w-full resize-none rounded-lg px-3 py-2.5 text-sm outline-none transition-colors duration-150"
                  style={{
                    backgroundColor: "var(--lane-surface-muted)",
                    color: "var(--lane-text-primary)",
                    border: "1px solid transparent",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--lane-border)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "transparent";
                  }}
                />
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Key dates */}
            <div className="lane-card-flat overflow-hidden">
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--lane-border)" }}>
                <h3 className="lane-label">Key Dates</h3>
              </div>
              <div className="px-4 py-3 space-y-3">
                {[
                  { label: "Applied", value: formatDate(app.applied_at), icon: Calendar },
                  { label: "First Response", value: formatDate(app.response_received_at), icon: Mail },
                  { label: "Interview", value: formatDate(app.interview_at), icon: Calendar },
                  { label: "Follow-up Due", value: formatDate(app.next_followup_at), icon: Calendar },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs" style={{ color: "var(--lane-text-tertiary)" }}>
                      <item.icon size={12} />
                      {item.label}
                    </span>
                    <span className="text-sm font-medium" style={{ color: "var(--lane-text-primary)" }}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Resume */}
            <div className="lane-card-flat overflow-hidden">
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--lane-border)" }}>
                <h3 className="lane-label">Resume Used</h3>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <FileText size={14} style={{ color: "var(--lane-text-tertiary)" }} />
                  <span className="text-sm" style={{ color: "var(--lane-text-primary)" }}>
                    {app.resume_version}
                  </span>
                </div>
              </div>
            </div>

            {/* Salary */}
            {(app.salary_min || app.salary_max) && (
              <div className="lane-card-flat overflow-hidden">
                <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--lane-border)" }}>
                  <h3 className="lane-label">Salary</h3>
                </div>
                <div className="px-4 py-3">
                  <span className="text-sm font-medium" style={{ color: "var(--lane-text-primary)" }}>
                    ${app.salary_min}{app.salary_max && app.salary_min !== app.salary_max ? `–$${app.salary_max}` : ""}/hr {app.salary_currency}
                  </span>
                </div>
              </div>
            )}

            {/* Danger zone */}
            <div className="pt-4">
              <button
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 w-full justify-center"
                style={{
                  backgroundColor: "var(--status-rejected-bg)",
                  color: "var(--status-rejected-text)",
                }}
              >
                <Trash2 size={14} /> Delete Application
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
