"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Briefcase, Settings, Menu } from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Apps", href: "/applications", icon: Briefcase },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Top bar — mobile only */}
      <header
        className="lg:hidden sticky top-0 z-50 flex items-center justify-between h-14 px-4"
        style={{
          backgroundColor: "var(--lane-surface)",
          borderBottom: "1px solid var(--lane-border)",
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ backgroundColor: "var(--lane-accent)", color: "var(--lane-bg)" }}
          >
            <span className="text-xs font-bold">L</span>
          </div>
          <span className="text-sm font-bold" style={{ color: "var(--lane-text-primary)" }}>
            Lane
          </span>
        </div>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold"
          style={{
            backgroundColor: "var(--lane-surface-muted)",
            color: "var(--lane-text-secondary)",
            border: "1px solid var(--lane-border)",
          }}
        >
          LZ
        </div>
      </header>

      {/* Bottom tab bar — mobile only */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-14"
        style={{
          backgroundColor: "var(--lane-surface)",
          borderTop: "1px solid var(--lane-border)",
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 py-1"
            >
              <Icon
                size={20}
                style={{
                  color: isActive
                    ? "var(--lane-text-primary)"
                    : "var(--lane-text-tertiary)",
                }}
              />
              <span
                className="text-[10px] font-medium"
                style={{
                  color: isActive
                    ? "var(--lane-text-primary)"
                    : "var(--lane-text-tertiary)",
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
