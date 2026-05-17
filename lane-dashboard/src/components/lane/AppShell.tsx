"use client";

import { Sidebar } from "@/components/lane/Sidebar";
import { MobileNav } from "@/components/lane/MobileNav";
import { ActivityPanel } from "@/components/lane/ActivityPanel";

interface AppShellProps {
  children: React.ReactNode;
  showActivityPanel?: boolean;
}

export function AppShell({ children, showActivityPanel = false }: AppShellProps) {
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "var(--lane-bg)" }}>
      <Sidebar />
      <MobileNav />
      <main className="flex-1 min-w-0 pb-16 lg:pb-0">{children}</main>
      {showActivityPanel && <ActivityPanel />}
    </div>
  );
}
