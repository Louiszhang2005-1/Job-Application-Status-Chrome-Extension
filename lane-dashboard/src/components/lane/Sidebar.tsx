"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Settings,
  Mail,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { getUnreadEmails } from "@/lib/fake-data";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Applications", href: "/applications", icon: Briefcase },
  { label: "Emails", href: "/dashboard", icon: Mail, badge: true },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const unread = getUnreadEmails().length;
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className="hidden lg:flex flex-col shrink-0 sticky top-0 h-screen transition-all duration-200"
      style={{
        width: collapsed ? 72 : 220,
        backgroundColor: "var(--lane-surface)",
        borderRight: "1px solid var(--lane-border)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16" style={{ borderBottom: "1px solid var(--lane-border)" }}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: "var(--lane-accent)", color: "var(--lane-bg)" }}
        >
          <span className="text-sm font-bold">L</span>
        </div>
        {!collapsed && (
          <span
            className="text-[15px] font-bold tracking-tight"
            style={{ color: "var(--lane-text-primary)" }}
          >
            Lane
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150"
              style={{
                backgroundColor: isActive
                  ? "var(--lane-surface-muted)"
                  : "transparent",
                color: isActive
                  ? "var(--lane-text-primary)"
                  : "var(--lane-text-secondary)",
              }}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && (
                <span className="flex-1">{item.label}</span>
              )}
              {!collapsed && item.badge && unread > 0 && (
                <span
                  className="text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center"
                  style={{
                    backgroundColor: "var(--status-applied-bg)",
                    color: "var(--status-applied-text)",
                  }}
                >
                  {unread}
                </span>
              )}
              {collapsed && item.badge && unread > 0 && (
                <span className="absolute ml-4 -mt-4 w-2 h-2 rounded-full bg-[#a8632a]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User + collapse */}
      <div className="px-3 py-3 space-y-2" style={{ borderTop: "1px solid var(--lane-border)" }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 rounded-lg transition-colors duration-150 hover:bg-[var(--lane-surface-muted)]"
          style={{ color: "var(--lane-text-tertiary)" }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {!collapsed && (
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
              style={{
                backgroundColor: "var(--lane-surface-muted)",
                color: "var(--lane-text-secondary)",
                border: "1px solid var(--lane-border)",
              }}
            >
              LZ
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-medium truncate" style={{ color: "var(--lane-text-primary)" }}>
                Louis Zhang
              </div>
              <div className="text-[11px] truncate" style={{ color: "var(--lane-text-tertiary)" }}>
                louis@example.com
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
