"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Settings, Bell } from "lucide-react";
import { getUnreadEmails } from "@/lib/fake-data";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Applications", href: "/applications" },
  { label: "Settings", href: "/settings" },
];

export function TopBar() {
  const pathname = usePathname();
  const unread = getUnreadEmails().length;

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{
        backgroundColor: "var(--lane-surface)",
        borderBottom: "1px solid var(--lane-border)",
      }}
    >
      <div className="mx-auto max-w-7xl flex items-center justify-between h-14 px-4 sm:px-6">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-8">
          <Link
            href="/dashboard"
            className="text-lg font-bold tracking-tight"
            style={{ color: "var(--lane-text-primary)" }}
          >
            Lane
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150"
                  style={{
                    color: isActive
                      ? "var(--lane-text-primary)"
                      : "var(--lane-text-secondary)",
                    backgroundColor: isActive
                      ? "var(--lane-surface-muted)"
                      : "transparent",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Search + Notifications + Settings */}
        <div className="flex items-center gap-2">
          <button
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
            style={{
              color: "var(--lane-text-tertiary)",
              backgroundColor: "var(--lane-surface-muted)",
              border: "1px solid var(--lane-border)",
            }}
          >
            <Search size={14} />
            <span>Search</span>
            <kbd className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--lane-surface)", border: "1px solid var(--lane-border)" }}>
              ⌘K
            </kbd>
          </button>

          <button
            className="relative p-2 rounded-lg transition-colors duration-150 hover:bg-[var(--lane-surface-muted)]"
            style={{ color: "var(--lane-text-secondary)" }}
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#a8632a]" />
            )}
          </button>

          <Link
            href="/settings"
            className="p-2 rounded-lg transition-colors duration-150 hover:bg-[var(--lane-surface-muted)]"
            style={{ color: "var(--lane-text-secondary)" }}
          >
            <Settings size={18} />
          </Link>

          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ml-1"
            style={{
              backgroundColor: "var(--lane-surface-muted)",
              color: "var(--lane-text-secondary)",
              border: "1px solid var(--lane-border)",
            }}
          >
            LZ
          </div>
        </div>
      </div>
    </header>
  );
}
