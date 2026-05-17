"use client";

import { useState } from "react";
import { AppShell } from "@/components/lane/AppShell";
import { fakeResumes } from "@/lib/fake-data";
import {
  FileText,
  Upload,
  Star,
  Trash2,
  Clock,
  Mail,
  User,
  LogOut,
  AlertTriangle,
  Check,
} from "lucide-react";

export default function SettingsPage() {
  const [followupDays, setFollowupDays] = useState(7);
  const [ghostThreshold, setGhostThreshold] = useState(30);

  return (
    <AppShell>
      <div className="px-6 lg:px-8 py-6 space-y-6 max-w-3xl">
        <h1 className="lane-heading">Settings</h1>

        {/* Resume Versions */}
        <div className="lane-card-flat overflow-hidden">
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--lane-border)" }}
          >
            <div className="flex items-center gap-2">
              <FileText size={15} style={{ color: "var(--lane-text-tertiary)" }} />
              <h2 className="lane-section-title">Resume Versions</h2>
            </div>
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150"
              style={{
                backgroundColor: "var(--lane-accent)",
                color: "var(--lane-bg)",
              }}
            >
              <Upload size={12} /> Upload New
            </button>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--lane-border)" }}>
            {fakeResumes.map((resume) => (
              <div key={resume.id} className="px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText size={16} style={{ color: "var(--lane-text-tertiary)" }} />
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--lane-text-primary)" }}>
                      {resume.label}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--lane-text-tertiary)" }}>
                      Added {new Date(resume.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {resume.is_default ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                      style={{
                        backgroundColor: "var(--status-interview-bg)",
                        color: "var(--status-interview-text)",
                      }}
                    >
                      <Star size={10} /> Default
                    </span>
                  ) : (
                    <button
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors duration-150 hover:bg-[var(--lane-surface-muted)]"
                      style={{ color: "var(--lane-text-tertiary)" }}
                    >
                      Set default
                    </button>
                  )}
                  <button
                    className="p-1 rounded transition-colors duration-150 hover:bg-[var(--lane-surface-muted)]"
                    style={{ color: "var(--lane-text-tertiary)" }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Follow-up Defaults */}
        <div className="lane-card-flat overflow-hidden">
          <div
            className="px-5 py-3"
            style={{ borderBottom: "1px solid var(--lane-border)" }}
          >
            <div className="flex items-center gap-2">
              <Clock size={15} style={{ color: "var(--lane-text-tertiary)" }} />
              <h2 className="lane-section-title">Follow-up Defaults</h2>
            </div>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium" style={{ color: "var(--lane-text-primary)" }}>
                  Default follow-up interval
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--lane-text-tertiary)" }}>
                  Auto-set when saving a new application
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={followupDays}
                  onChange={(e) => setFollowupDays(Number(e.target.value))}
                  min={1}
                  max={60}
                  className="w-16 px-2 py-1.5 rounded-lg text-sm text-center outline-none"
                  style={{
                    backgroundColor: "var(--lane-surface-muted)",
                    border: "1px solid var(--lane-border)",
                    color: "var(--lane-text-primary)",
                  }}
                />
                <span className="text-sm" style={{ color: "var(--lane-text-tertiary)" }}>
                  days
                </span>
              </div>
            </div>

            <div
              className="w-full"
              style={{ borderTop: "1px solid var(--lane-border)" }}
            />

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium" style={{ color: "var(--lane-text-primary)" }}>
                  Auto-ghosted threshold
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--lane-text-tertiary)" }}>
                  Show ghost icon after this many days with no response
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={ghostThreshold}
                  onChange={(e) => setGhostThreshold(Number(e.target.value))}
                  min={7}
                  max={120}
                  className="w-16 px-2 py-1.5 rounded-lg text-sm text-center outline-none"
                  style={{
                    backgroundColor: "var(--lane-surface-muted)",
                    border: "1px solid var(--lane-border)",
                    color: "var(--lane-text-primary)",
                  }}
                />
                <span className="text-sm" style={{ color: "var(--lane-text-tertiary)" }}>
                  days
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Gmail Connection */}
        <div className="lane-card-flat overflow-hidden">
          <div
            className="px-5 py-3"
            style={{ borderBottom: "1px solid var(--lane-border)" }}
          >
            <div className="flex items-center gap-2">
              <Mail size={15} style={{ color: "var(--lane-text-tertiary)" }} />
              <h2 className="lane-section-title">Gmail Connection</h2>
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium" style={{ color: "var(--lane-text-primary)" }}>
                  Not connected
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--lane-text-tertiary)" }}>
                  Connect Gmail to auto-detect company replies
                </div>
              </div>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150"
                style={{
                  backgroundColor: "var(--lane-surface-muted)",
                  color: "var(--lane-text-secondary)",
                  border: "1px solid var(--lane-border)",
                }}
              >
                <Mail size={12} /> Connect Gmail
              </button>
            </div>
          </div>
        </div>

        {/* Account */}
        <div className="lane-card-flat overflow-hidden">
          <div
            className="px-5 py-3"
            style={{ borderBottom: "1px solid var(--lane-border)" }}
          >
            <div className="flex items-center gap-2">
              <User size={15} style={{ color: "var(--lane-text-tertiary)" }} />
              <h2 className="lane-section-title">Account</h2>
            </div>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium" style={{ color: "var(--lane-text-primary)" }}>
                  louis@example.com
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--lane-text-tertiary)" }}>
                  Signed in via magic link
                </div>
              </div>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150"
                style={{
                  backgroundColor: "var(--lane-surface-muted)",
                  color: "var(--lane-text-secondary)",
                  border: "1px solid var(--lane-border)",
                }}
              >
                <LogOut size={12} /> Log out
              </button>
            </div>

            <div
              className="w-full"
              style={{ borderTop: "1px solid var(--lane-border)" }}
            />

            <div>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-150"
                style={{
                  backgroundColor: "var(--status-rejected-bg)",
                  color: "var(--status-rejected-text)",
                }}
              >
                <AlertTriangle size={12} /> Delete all data
              </button>
              <div className="text-[11px] mt-1.5" style={{ color: "var(--lane-text-tertiary)" }}>
                This will permanently delete all your applications, emails, and resumes.
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
