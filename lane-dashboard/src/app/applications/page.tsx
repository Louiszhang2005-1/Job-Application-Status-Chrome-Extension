"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { AppShell } from "@/components/lane/AppShell";
import { StatusPill } from "@/components/lane/StatusPill";
import { SourceIcon } from "@/components/lane/SourceIcon";
import {
  fakeApplications,
  getUniqueLocations,
  getUniqueRoles,
  type ApplicationStatus,
  type ApplicationSource,
} from "@/lib/fake-data";
import {
  Plus,
  Search,
  ArrowUpDown,
  SlidersHorizontal,
  X,
  MapPin,
  LayoutGrid,
  List,
  ChevronDown,
} from "lucide-react";

const allStatuses: ApplicationStatus[] = [
  "saved", "applied", "phone_screen", "interview", "offer", "rejected", "withdrew", "ghosted",
];

const allSources: { value: ApplicationSource; label: string }[] = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "indeed", label: "Indeed" },
  { value: "greenhouse", label: "Greenhouse" },
  { value: "lever", label: "Lever" },
  { value: "workday", label: "Workday" },
  { value: "company_site", label: "Company Site" },
];

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type SortKey = "company" | "applied_at" | "status" | "location";
type ViewMode = "table" | "cards";

export default function ApplicationsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<ApplicationSource | "all">("all");
  const [sortBy, setSortBy] = useState<SortKey>("applied_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [showFilters, setShowFilters] = useState(false);

  const locations = getUniqueLocations();

  const activeFilterCount = [
    statusFilter !== "all",
    locationFilter !== "all",
    sourceFilter !== "all",
  ].filter(Boolean).length;

  const filtered = useMemo(() => {
    let apps = [...fakeApplications];

    if (search) {
      const q = search.toLowerCase();
      apps = apps.filter(
        (a) =>
          a.company.toLowerCase().includes(q) ||
          a.role.toLowerCase().includes(q) ||
          a.location.toLowerCase().includes(q) ||
          a.notes.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") apps = apps.filter((a) => a.status === statusFilter);
    if (locationFilter !== "all") apps = apps.filter((a) => a.location === locationFilter);
    if (sourceFilter !== "all") apps = apps.filter((a) => a.source === sourceFilter);

    apps.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "company") cmp = a.company.localeCompare(b.company);
      else if (sortBy === "location") cmp = a.location.localeCompare(b.location);
      else if (sortBy === "applied_at") {
        cmp = new Date(a.applied_at || a.captured_at).getTime() - new Date(b.applied_at || b.captured_at).getTime();
      } else if (sortBy === "status") {
        cmp = allStatuses.indexOf(a.status) - allStatuses.indexOf(b.status);
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return apps;
  }, [search, statusFilter, locationFilter, sourceFilter, sortBy, sortDir]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: fakeApplications.length };
    for (const app of fakeApplications) {
      counts[app.status] = (counts[app.status] || 0) + 1;
    }
    return counts;
  }, []);

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortDir("desc"); }
  }

  function clearAllFilters() {
    setStatusFilter("all");
    setLocationFilter("all");
    setSourceFilter("all");
    setSearch("");
  }

  return (
    <AppShell>
      <div className="px-6 lg:px-8 py-6 space-y-4 max-w-[1100px]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="lane-heading">Applications</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--lane-text-tertiary)" }}>
              {filtered.length} of {fakeApplications.length} applications
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 shadow-sm hover:shadow-md"
            style={{
              backgroundColor: "var(--lane-accent)",
              color: "var(--lane-bg)",
            }}
          >
            <Plus size={16} />
            Add Application
          </button>
        </div>

        {/* Search + filter controls */}
        <div className="lane-card-flat overflow-hidden">
          <div className="px-4 py-3 flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--lane-text-tertiary)" }}
              />
              <input
                type="text"
                placeholder="Search company, role, location, or notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none transition-all duration-150"
                style={{
                  backgroundColor: "var(--lane-surface-muted)",
                  border: "1px solid transparent",
                  color: "var(--lane-text-primary)",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--lane-border)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--lane-text-tertiary)" }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter toggle + view mode */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
                style={{
                  backgroundColor: showFilters || activeFilterCount > 0 ? "var(--lane-accent)" : "var(--lane-surface-muted)",
                  color: showFilters || activeFilterCount > 0 ? "var(--lane-bg)" : "var(--lane-text-secondary)",
                }}
              >
                <SlidersHorizontal size={14} />
                Filters
                {activeFilterCount > 0 && (
                  <span
                    className="text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.2)",
                    }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>

              <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--lane-border)" }}>
                <button
                  onClick={() => setViewMode("table")}
                  className="p-2 transition-colors duration-150"
                  style={{
                    backgroundColor: viewMode === "table" ? "var(--lane-surface-muted)" : "var(--lane-surface)",
                    color: viewMode === "table" ? "var(--lane-text-primary)" : "var(--lane-text-tertiary)",
                  }}
                >
                  <List size={15} />
                </button>
                <button
                  onClick={() => setViewMode("cards")}
                  className="p-2 transition-colors duration-150"
                  style={{
                    backgroundColor: viewMode === "cards" ? "var(--lane-surface-muted)" : "var(--lane-surface)",
                    color: viewMode === "cards" ? "var(--lane-text-primary)" : "var(--lane-text-tertiary)",
                  }}
                >
                  <LayoutGrid size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div
              className="px-4 py-3 flex flex-wrap gap-3 items-end"
              style={{ borderTop: "1px solid var(--lane-border)" }}
            >
              {/* Status */}
              <div>
                <label className="lane-label block mb-1.5">Status</label>
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | "all")}
                    className="appearance-none pl-3 pr-8 py-2 rounded-lg text-sm outline-none cursor-pointer"
                    style={{
                      backgroundColor: "var(--lane-surface-muted)",
                      border: "1px solid var(--lane-border)",
                      color: "var(--lane-text-primary)",
                    }}
                  >
                    <option value="all">All statuses ({statusCounts.all})</option>
                    {allStatuses.map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())} ({statusCounts[s] || 0})
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: "var(--lane-text-tertiary)" }}
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="lane-label block mb-1.5">Location</label>
                <div className="relative">
                  <select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-2 rounded-lg text-sm outline-none cursor-pointer"
                    style={{
                      backgroundColor: "var(--lane-surface-muted)",
                      border: "1px solid var(--lane-border)",
                      color: "var(--lane-text-primary)",
                    }}
                  >
                    <option value="all">All locations</option>
                    {locations.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: "var(--lane-text-tertiary)" }}
                  />
                </div>
              </div>

              {/* Source */}
              <div>
                <label className="lane-label block mb-1.5">Source</label>
                <div className="relative">
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value as ApplicationSource | "all")}
                    className="appearance-none pl-3 pr-8 py-2 rounded-lg text-sm outline-none cursor-pointer"
                    style={{
                      backgroundColor: "var(--lane-surface-muted)",
                      border: "1px solid var(--lane-border)",
                      color: "var(--lane-text-primary)",
                    }}
                  >
                    <option value="all">All sources</option>
                    {allSources.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: "var(--lane-text-tertiary)" }}
                  />
                </div>
              </div>

              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors duration-150 hover:bg-[var(--lane-surface-muted)]"
                  style={{ color: "var(--status-rejected-text)" }}
                >
                  <X size={12} /> Clear all
                </button>
              )}
            </div>
          )}

          {/* Active filter tags */}
          {!showFilters && activeFilterCount > 0 && (
            <div
              className="px-4 py-2 flex flex-wrap gap-1.5"
              style={{ borderTop: "1px solid var(--lane-border)" }}
            >
              {statusFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: "var(--lane-surface-muted)", color: "var(--lane-text-secondary)" }}>
                  Status: {statusFilter.replace("_", " ")}
                  <button onClick={() => setStatusFilter("all")}><X size={10} /></button>
                </span>
              )}
              {locationFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: "var(--lane-surface-muted)", color: "var(--lane-text-secondary)" }}>
                  <MapPin size={10} /> {locationFilter}
                  <button onClick={() => setLocationFilter("all")}><X size={10} /></button>
                </span>
              )}
              {sourceFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: "var(--lane-surface-muted)", color: "var(--lane-text-secondary)" }}>
                  Source: {sourceFilter}
                  <button onClick={() => setSourceFilter("all")}><X size={10} /></button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Table view */}
        {viewMode === "table" && (
          <div className="lane-card-flat overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--lane-border)", backgroundColor: "var(--lane-surface-muted)" }}>
                    {[
                      { key: "company" as SortKey, label: "Company" },
                      { key: null, label: "Role" },
                      { key: "status" as SortKey, label: "Status" },
                      { key: "location" as SortKey, label: "Location" },
                      { key: null, label: "Source" },
                      { key: "applied_at" as SortKey, label: "Applied" },
                      { key: null, label: "Follow-up" },
                    ].map((col, i) => (
                      <th
                        key={i}
                        className={`px-4 py-2.5 text-left lane-label ${col.key ? "cursor-pointer select-none hover:text-[var(--lane-text-secondary)]" : ""}`}
                        onClick={() => col.key && toggleSort(col.key)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {col.key && (
                            <ArrowUpDown
                              size={10}
                              style={{
                                opacity: sortBy === col.key ? 1 : 0.3,
                              }}
                            />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((app) => (
                    <tr
                      key={app.id}
                      className="cursor-pointer transition-colors duration-100 group"
                      style={{ borderBottom: "1px solid var(--lane-border)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--lane-surface-muted)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/applications/${app.id}`}
                          className="text-sm font-semibold hover:underline"
                          style={{ color: "var(--lane-text-primary)" }}
                        >
                          {app.company}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--lane-text-secondary)" }}>
                        {app.role}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={app.status} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-xs" style={{ color: "var(--lane-text-tertiary)" }}>
                          <MapPin size={11} /> {app.location}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <SourceIcon source={app.source} />
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums" style={{ color: "var(--lane-text-tertiary)" }}>
                        {formatDate(app.applied_at)}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{
                        color: app.next_followup_at && new Date(app.next_followup_at) <= new Date()
                          ? "#a8632a"
                          : "var(--lane-text-tertiary)",
                        fontWeight: app.next_followup_at && new Date(app.next_followup_at) <= new Date() ? 600 : 400,
                      }}>
                        {app.next_followup_at ? timeAgo(app.next_followup_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <div className="md:hidden divide-y" style={{ borderColor: "var(--lane-border)" }}>
              {filtered.map((app) => (
                <Link key={app.id} href={`/applications/${app.id}`} className="block px-4 py-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold" style={{ color: "var(--lane-text-primary)" }}>{app.company}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--lane-text-secondary)" }}>{app.role}</div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--lane-text-tertiary)" }}>
                          <MapPin size={10} /> {app.location}
                        </span>
                      </div>
                    </div>
                    <StatusPill status={app.status} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Card view */}
        {viewMode === "cards" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((app) => (
              <Link
                key={app.id}
                href={`/applications/${app.id}`}
                className="lane-card px-4 py-4 block"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: "var(--lane-text-primary)" }}>
                      {app.company}
                    </div>
                    <div className="text-xs truncate mt-0.5" style={{ color: "var(--lane-text-secondary)" }}>
                      {app.role}
                    </div>
                  </div>
                  <StatusPill status={app.status} />
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--lane-text-tertiary)" }}>
                    <MapPin size={10} /> {app.location}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid var(--lane-border)" }}>
                  <SourceIcon source={app.source} />
                  <span className="text-[11px] tabular-nums" style={{ color: "var(--lane-text-tertiary)" }}>
                    {formatDate(app.applied_at)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="lane-card-flat px-4 py-16 text-center">
            <div className="text-lg font-semibold mb-1" style={{ color: "var(--lane-text-primary)" }}>
              No applications found
            </div>
            <div className="text-sm mb-4" style={{ color: "var(--lane-text-tertiary)" }}>
              Try adjusting your filters or search query
            </div>
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
              style={{
                backgroundColor: "var(--lane-surface-muted)",
                color: "var(--lane-text-secondary)",
                border: "1px solid var(--lane-border)",
              }}
            >
              <X size={14} /> Clear all filters
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
