import { AppShell } from "@/components/lane/AppShell";
import { DashboardGreeting } from "@/components/lane/DashboardGreeting";
import { AlertBar } from "@/components/lane/AlertBar";
import { StatsRow } from "@/components/lane/StatsRow";
import { WeeklyChart } from "@/components/lane/WeeklyChart";
import { FunnelChart, SourceBreakdownCard, LocationBreakdownCard } from "@/components/lane/AnalyticsCards";
import { PipelineKanban } from "@/components/lane/PipelineKanban";
import { CompanyReplies } from "@/components/lane/CompanyReplies";
import { FollowupSection } from "@/components/lane/FollowupSection";

export default function DashboardPage() {
  return (
    <AppShell showActivityPanel>
      <div className="px-6 lg:px-8 py-6 space-y-6 max-w-[1100px]">
        <DashboardGreeting />
        <AlertBar />
        <StatsRow />

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <WeeklyChart />
          </div>
          <FunnelChart />
        </div>

        {/* Source & Location mini cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SourceBreakdownCard />
          <LocationBreakdownCard />
        </div>

        <PipelineKanban />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CompanyReplies />
          <FollowupSection />
        </div>
      </div>
    </AppShell>
  );
}
