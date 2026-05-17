import { type ApplicationSource } from "@/lib/fake-data";

const sourceLabels: Record<ApplicationSource, string> = {
  linkedin: "LinkedIn",
  indeed: "Indeed",
  greenhouse: "Greenhouse",
  lever: "Lever",
  workday: "Workday",
  ashby: "Ashby",
  company_site: "Company Site",
  other: "Other",
};

// Simple text-based source indicator — clean and readable
export function SourceIcon({ source }: { source: ApplicationSource }) {
  const label = sourceLabels[source];

  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium rounded-md px-1.5 py-0.5"
      style={{
        color: "var(--lane-text-tertiary)",
        backgroundColor: "var(--lane-surface-muted)",
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getSourceDot(source) }} />
      {label}
    </span>
  );
}

function getSourceDot(source: ApplicationSource): string {
  switch (source) {
    case "linkedin": return "#0a66c2";
    case "indeed": return "#2164f3";
    case "greenhouse": return "#3b8427";
    case "lever": return "#5a4fcf";
    case "workday": return "#0875e1";
    case "ashby": return "#1a1a1a";
    case "company_site": return "#9a9388";
    default: return "#9a9388";
  }
}
