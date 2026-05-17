import { type ApplicationStatus } from "@/lib/fake-data";

const statusConfig: Record<
  ApplicationStatus,
  { label: string; bg: string; text: string }
> = {
  saved: { label: "Saved", bg: "var(--status-saved-bg)", text: "var(--status-saved-text)" },
  applied: { label: "Applied", bg: "var(--status-applied-bg)", text: "var(--status-applied-text)" },
  phone_screen: { label: "Phone Screen", bg: "var(--status-phone-screen-bg)", text: "var(--status-phone-screen-text)" },
  interview: { label: "Interview", bg: "var(--status-interview-bg)", text: "var(--status-interview-text)" },
  offer: { label: "Offer", bg: "var(--status-offer-bg)", text: "var(--status-offer-text)" },
  rejected: { label: "Rejected", bg: "var(--status-rejected-bg)", text: "var(--status-rejected-text)" },
  withdrew: { label: "Withdrew", bg: "var(--status-withdrew-bg)", text: "var(--status-withdrew-text)" },
  ghosted: { label: "Ghosted", bg: "var(--status-ghosted-bg)", text: "var(--status-ghosted-text)" },
};

interface StatusPillProps {
  status: ApplicationStatus;
  size?: "sm" | "md";
}

export function StatusPill({ status, size = "sm" }: StatusPillProps) {
  const config = statusConfig[status];
  const sizeClasses = size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${sizeClasses}`}
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      {config.label}
    </span>
  );
}

export { statusConfig };
