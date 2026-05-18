// ============================================================
// Lane — Fake Data for UI Development
// ============================================================
// Realistic sample data for an engineering student in Montreal.
// This file is imported during development and replaced with
// real Supabase queries once the UI is polished.
// ============================================================

export type ApplicationStatus =
  | "saved"
  | "applied"
  | "phone_screen"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrew"
  | "ghosted";

export type ApplicationSource =
  | "linkedin"
  | "indeed"
  | "greenhouse"
  | "lever"
  | "workday"
  | "ashby"
  | "company_site"
  | "other";

export interface Application {
  id: string;
  company: string;
  role: string;
  location: string;
  status: ApplicationStatus;
  source: ApplicationSource;
  applied_at: string | null;
  captured_at: string;
  resume_version: string;
  notes: string;
  next_followup_at: string | null;
  job_url: string;
  job_description?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  response_received_at?: string | null;
  interview_at?: string | null;
  offer_at?: string | null;
  rejected_at?: string | null;
}

export interface EmailMatch {
  id: string;
  application_id: string;
  from_name: string;
  from_email: string;
  subject: string;
  snippet: string;
  received_at: string;
  suggested_status: ApplicationStatus | null;
  is_read: boolean;
}

export interface ActivityEntry {
  id: string;
  application_id: string;
  action: string;
  company: string;
  role: string;
  details?: Record<string, string>;
  subject?: string;
  created_at: string;
}

export interface ResumeVersion {
  id: string;
  label: string;
  file_path: string | null;
  is_default: boolean;
  created_at: string;
}

// -----------------------------------------------------------
// Resume Versions
// -----------------------------------------------------------
export const fakeResumes: ResumeVersion[] = [
  { id: "r1", label: "v3-mechanical-focused", file_path: null, is_default: true, created_at: "2026-04-01T10:00:00Z" },
  { id: "r2", label: "v2-aerospace-focused", file_path: null, is_default: false, created_at: "2026-03-15T10:00:00Z" },
  { id: "r3", label: "v1-general-engineering", file_path: null, is_default: false, created_at: "2026-02-20T10:00:00Z" },
];

// -----------------------------------------------------------
// Applications (20 entries)
// -----------------------------------------------------------
export const fakeApplications: Application[] = [
  {
    id: "1",
    company: "Tesla",
    role: "Mechanical Engineer Intern",
    location: "Fremont, CA",
    status: "interview",
    source: "company_site",
    applied_at: "2026-04-15T09:00:00Z",
    captured_at: "2026-04-15T09:00:00Z",
    resume_version: "v3-mechanical-focused",
    notes: "Referred by Jake from capstone team. Technical phone screen went well.",
    next_followup_at: null,
    job_url: "https://careers.tesla.com/jobs/12345",
    response_received_at: "2026-04-22T14:30:00Z",
    interview_at: "2026-05-20T15:00:00Z",
  },
  {
    id: "2",
    company: "Pratt & Whitney",
    role: "Thermal Analyst Co-op",
    location: "Longueuil, QC",
    status: "applied",
    source: "company_site",
    applied_at: "2026-05-01T10:00:00Z",
    captured_at: "2026-05-01T10:00:00Z",
    resume_version: "v2-aerospace-focused",
    notes: "",
    next_followup_at: "2026-05-08T10:00:00Z",
    job_url: "https://careers.rtx.com/pw-thermal-analyst",
  },
  {
    id: "3",
    company: "Bombardier",
    role: "Stress Engineer Intern",
    location: "Dorval, QC",
    status: "phone_screen",
    source: "linkedin",
    applied_at: "2026-04-20T08:00:00Z",
    captured_at: "2026-04-20T08:00:00Z",
    resume_version: "v3-mechanical-focused",
    notes: "HR called May 2, technical screen next week",
    next_followup_at: null,
    job_url: "https://www.linkedin.com/jobs/view/bombardier-stress",
    response_received_at: "2026-05-02T11:00:00Z",
  },
  {
    id: "4",
    company: "SpaceX",
    role: "Propulsion Engineer Intern",
    location: "Hawthorne, CA",
    status: "rejected",
    source: "company_site",
    applied_at: "2026-03-10T09:00:00Z",
    captured_at: "2026-03-10T09:00:00Z",
    resume_version: "v2-aerospace-focused",
    notes: "Got the generic rejection email after 3 weeks",
    next_followup_at: null,
    job_url: "https://www.spacex.com/careers/propulsion-intern",
    rejected_at: "2026-04-01T09:00:00Z",
  },
  {
    id: "5",
    company: "CAE",
    role: "Systems Engineer Intern",
    location: "Saint-Laurent, QC",
    status: "applied",
    source: "indeed",
    applied_at: "2026-05-10T10:00:00Z",
    captured_at: "2026-05-10T10:00:00Z",
    resume_version: "v3-mechanical-focused",
    notes: "",
    next_followup_at: "2026-05-14T10:00:00Z",
    job_url: "https://www.indeed.com/viewjob?jk=cae-systems",
  },
  {
    id: "6",
    company: "Google",
    role: "Hardware Engineer Intern",
    location: "Mountain View, CA",
    status: "applied",
    source: "company_site",
    applied_at: "2026-05-05T14:00:00Z",
    captured_at: "2026-05-05T14:00:00Z",
    resume_version: "v3-mechanical-focused",
    notes: "Applied through referral portal",
    next_followup_at: "2026-05-12T14:00:00Z",
    job_url: "https://careers.google.com/jobs/results/hw-intern",
  },
  {
    id: "7",
    company: "Shopify",
    role: "Production Engineer Intern",
    location: "Remote, Canada",
    status: "offer",
    source: "greenhouse",
    applied_at: "2026-03-25T10:00:00Z",
    captured_at: "2026-03-25T10:00:00Z",
    resume_version: "v3-mechanical-focused",
    notes: "$32/hr, 4-month term, starts September. Need to decide by May 25.",
    next_followup_at: null,
    job_url: "https://boards.greenhouse.io/shopify/prod-eng",
    response_received_at: "2026-04-05T15:00:00Z",
    offer_at: "2026-05-10T10:00:00Z",
    salary_min: 32,
    salary_max: 32,
    salary_currency: "CAD",
  },
  {
    id: "8",
    company: "Lockheed Martin",
    role: "Structural Analyst Intern",
    location: "Fort Worth, TX",
    status: "applied",
    source: "workday",
    applied_at: "2026-05-12T09:00:00Z",
    captured_at: "2026-05-12T09:00:00Z",
    resume_version: "v2-aerospace-focused",
    notes: "",
    next_followup_at: "2026-05-19T09:00:00Z",
    job_url: "https://lockheedmartin.wd5.myworkdayjobs.com/structural",
  },
  {
    id: "9",
    company: "Boeing",
    role: "Manufacturing Engineer Intern",
    location: "Everett, WA",
    status: "ghosted",
    source: "company_site",
    applied_at: "2026-03-01T11:00:00Z",
    captured_at: "2026-03-01T11:00:00Z",
    resume_version: "v1-general-engineering",
    notes: "No response after 2+ months. Moving on.",
    next_followup_at: null,
    job_url: "https://jobs.boeing.com/manufacturing-intern",
  },
  {
    id: "10",
    company: "ABB",
    role: "Robotics Engineer Co-op",
    location: "Montreal, QC",
    status: "saved",
    source: "linkedin",
    applied_at: null,
    captured_at: "2026-05-16T20:00:00Z",
    resume_version: "v3-mechanical-focused",
    notes: "Looks interesting — need to tailor resume for robotics",
    next_followup_at: null,
    job_url: "https://www.linkedin.com/jobs/view/abb-robotics",
  },
  {
    id: "11",
    company: "Siemens",
    role: "Controls Engineer Intern",
    location: "Montreal, QC",
    status: "saved",
    source: "indeed",
    applied_at: null,
    captured_at: "2026-05-15T18:00:00Z",
    resume_version: "v3-mechanical-focused",
    notes: "",
    next_followup_at: null,
    job_url: "https://www.indeed.com/viewjob?jk=siemens-controls",
  },
  {
    id: "12",
    company: "Schneider Electric",
    role: "Product Design Intern",
    location: "Brossard, QC",
    status: "applied",
    source: "company_site",
    applied_at: "2026-04-28T09:00:00Z",
    captured_at: "2026-04-28T09:00:00Z",
    resume_version: "v3-mechanical-focused",
    notes: "Applied through campus portal",
    next_followup_at: "2026-05-05T09:00:00Z",
    job_url: "https://careers.se.com/product-design-intern",
  },
  {
    id: "13",
    company: "WSP",
    role: "Mechanical EIT",
    location: "Montreal, QC",
    status: "interview",
    source: "company_site",
    applied_at: "2026-04-10T08:00:00Z",
    captured_at: "2026-04-10T08:00:00Z",
    resume_version: "v3-mechanical-focused",
    notes: "Panel interview with 3 engineers. Asked about HVAC experience.",
    next_followup_at: null,
    job_url: "https://careers.wsp.com/mechanical-eit",
    response_received_at: "2026-04-18T10:00:00Z",
    interview_at: "2026-05-18T14:00:00Z",
  },
  {
    id: "14",
    company: "Hatch",
    role: "Mechanical Engineer Intern",
    location: "Montreal, QC",
    status: "withdrew",
    source: "linkedin",
    applied_at: "2026-03-20T10:00:00Z",
    captured_at: "2026-03-20T10:00:00Z",
    resume_version: "v1-general-engineering",
    notes: "Withdrew after getting Shopify offer",
    next_followup_at: null,
    job_url: "https://www.linkedin.com/jobs/view/hatch-mech",
  },
  {
    id: "15",
    company: "Wealthsimple",
    role: "Platform Engineer Intern",
    location: "Remote, Canada",
    status: "applied",
    source: "lever",
    applied_at: "2026-05-14T16:00:00Z",
    captured_at: "2026-05-14T16:00:00Z",
    resume_version: "v3-mechanical-focused",
    notes: "Stretch role — more software focused",
    next_followup_at: "2026-05-21T16:00:00Z",
    job_url: "https://jobs.lever.co/wealthsimple/platform-eng",
  },
  {
    id: "16",
    company: "Microsoft",
    role: "Hardware Engineering Intern",
    location: "Redmond, WA",
    status: "phone_screen",
    source: "company_site",
    applied_at: "2026-04-25T10:00:00Z",
    captured_at: "2026-04-25T10:00:00Z",
    resume_version: "v3-mechanical-focused",
    notes: "Recruiter reached out via LinkedIn after application",
    next_followup_at: null,
    job_url: "https://careers.microsoft.com/hw-eng-intern",
    response_received_at: "2026-05-08T09:00:00Z",
  },
  {
    id: "17",
    company: "Northrop Grumman",
    role: "Systems Engineer Co-op",
    location: "Baltimore, MD",
    status: "applied",
    source: "workday",
    applied_at: "2026-05-06T11:00:00Z",
    captured_at: "2026-05-06T11:00:00Z",
    resume_version: "v2-aerospace-focused",
    notes: "Requires US citizenship — need to follow up on eligibility",
    next_followup_at: "2026-05-13T11:00:00Z",
    job_url: "https://ngc.wd1.myworkdayjobs.com/systems-coop",
  },
  {
    id: "18",
    company: "Raytheon",
    role: "Thermal Engineer Intern",
    location: "Tucson, AZ",
    status: "rejected",
    source: "company_site",
    applied_at: "2026-03-15T09:00:00Z",
    captured_at: "2026-03-15T09:00:00Z",
    resume_version: "v2-aerospace-focused",
    notes: "Citizenship requirement — auto-rejected",
    next_followup_at: null,
    job_url: "https://careers.rtx.com/raytheon-thermal",
    rejected_at: "2026-03-16T08:00:00Z",
  },
  {
    id: "19",
    company: "Lightspeed Commerce",
    role: "DevOps Intern",
    location: "Montreal, QC",
    status: "saved",
    source: "greenhouse",
    applied_at: null,
    captured_at: "2026-05-17T10:00:00Z",
    resume_version: "v3-mechanical-focused",
    notes: "Deadline is May 25 — bookmark for now",
    next_followup_at: null,
    job_url: "https://boards.greenhouse.io/lightspeed/devops",
  },
  {
    id: "20",
    company: "Stantec",
    role: "Mechanical Designer Co-op",
    location: "Montreal, QC",
    status: "applied",
    source: "company_site",
    applied_at: "2026-05-15T10:00:00Z",
    captured_at: "2026-05-15T10:00:00Z",
    resume_version: "v3-mechanical-focused",
    notes: "",
    next_followup_at: "2026-05-22T10:00:00Z",
    job_url: "https://careers.stantec.com/mech-designer",
  },
];

// -----------------------------------------------------------
// Email Matches
// -----------------------------------------------------------
export const fakeEmails: EmailMatch[] = [
  {
    id: "e1",
    application_id: "1",
    from_name: "Tesla Recruiting",
    from_email: "recruiting@tesla.com",
    subject: "Next Steps — Mechanical Engineer Intern Position",
    snippet: "Thank you for your interest in Tesla. We would like to schedule a technical phone screen with the team lead...",
    received_at: "2026-05-15T14:30:00Z",
    suggested_status: "phone_screen",
    is_read: false,
  },
  {
    id: "e2",
    application_id: "4",
    from_name: "SpaceX Talent",
    from_email: "talent@spacex.com",
    subject: "Update on Your Application",
    snippet: "Thank you for taking the time to apply. After careful consideration, we have decided to move forward with other candidates...",
    received_at: "2026-04-01T09:00:00Z",
    suggested_status: "rejected",
    is_read: true,
  },
  {
    id: "e3",
    application_id: "3",
    from_name: "Bombardier HR",
    from_email: "hr@bombardier.com",
    subject: "Phone Screen — Stress Engineer Intern",
    snippet: "Hi, I hope this message finds you well. I'd like to schedule a brief introductory call to discuss the role...",
    received_at: "2026-05-02T11:00:00Z",
    suggested_status: "phone_screen",
    is_read: false,
  },
  {
    id: "e4",
    application_id: "7",
    from_name: "Shopify Talent Team",
    from_email: "careers@shopify.com",
    subject: "Offer Letter — Production Engineer Intern",
    snippet: "Congratulations! We're pleased to extend an offer for the Production Engineer Intern role. Please find the details...",
    received_at: "2026-05-10T10:00:00Z",
    suggested_status: "offer",
    is_read: true,
  },
  {
    id: "e5",
    application_id: "16",
    from_name: "Microsoft Recruiting",
    from_email: "staffing@microsoft.com",
    subject: "Let's Connect — Hardware Engineering Intern",
    snippet: "I'm reaching out regarding your application. I'd love to set up a 30-minute call to discuss the position...",
    received_at: "2026-05-08T09:00:00Z",
    suggested_status: "phone_screen",
    is_read: false,
  },
  {
    id: "e6",
    application_id: "12",
    from_name: "Schneider Electric",
    from_email: "careers@se.com",
    subject: "Application Received — Product Design Intern",
    snippet: "Thank you for applying to Schneider Electric. Your application has been received and is under review...",
    received_at: "2026-04-29T08:00:00Z",
    suggested_status: null,
    is_read: true,
  },
];

// -----------------------------------------------------------
// Activity Log
// -----------------------------------------------------------
export const fakeActivity: ActivityEntry[] = [
  { id: "a1", application_id: "19", action: "created", company: "Lightspeed Commerce", role: "DevOps Intern", created_at: "2026-05-17T10:00:00Z" },
  { id: "a2", application_id: "20", action: "created", company: "Stantec", role: "Mechanical Designer Co-op", created_at: "2026-05-15T10:00:00Z" },
  { id: "a3", application_id: "1", action: "status_change", company: "Tesla", role: "Mechanical Engineer Intern", details: { from: "phone_screen", to: "interview" }, created_at: "2026-05-14T16:00:00Z" },
  { id: "a4", application_id: "15", action: "created", company: "Wealthsimple", role: "Platform Engineer Intern", created_at: "2026-05-14T16:00:00Z" },
  { id: "a5", application_id: "8", action: "created", company: "Lockheed Martin", role: "Structural Analyst Intern", created_at: "2026-05-12T09:00:00Z" },
  { id: "a6", application_id: "7", action: "status_change", company: "Shopify", role: "Production Engineer Intern", details: { from: "interview", to: "offer" }, created_at: "2026-05-10T10:00:00Z" },
  { id: "a7", application_id: "5", action: "created", company: "CAE", role: "Systems Engineer Intern", created_at: "2026-05-10T10:00:00Z" },
  { id: "a8", application_id: "16", action: "email_detected", company: "Microsoft", role: "Hardware Engineering Intern", subject: "Let's Connect", created_at: "2026-05-08T09:00:00Z" },
  { id: "a9", application_id: "17", action: "created", company: "Northrop Grumman", role: "Systems Engineer Co-op", created_at: "2026-05-06T11:00:00Z" },
  { id: "a10", application_id: "6", action: "created", company: "Google", role: "Hardware Engineer Intern", created_at: "2026-05-05T14:00:00Z" },
  { id: "a11", application_id: "3", action: "email_detected", company: "Bombardier", role: "Stress Engineer Intern", subject: "Phone Screen — Stress Engineer", created_at: "2026-05-02T11:00:00Z" },
  { id: "a12", application_id: "2", action: "created", company: "Pratt & Whitney", role: "Thermal Analyst Co-op", created_at: "2026-05-01T10:00:00Z" },
  { id: "a13", application_id: "12", action: "created", company: "Schneider Electric", role: "Product Design Intern", created_at: "2026-04-28T09:00:00Z" },
  { id: "a14", application_id: "16", action: "created", company: "Microsoft", role: "Hardware Engineering Intern", created_at: "2026-04-25T10:00:00Z" },
  { id: "a15", application_id: "1", action: "email_detected", company: "Tesla", role: "Mechanical Engineer Intern", subject: "Next Steps", created_at: "2026-04-22T14:30:00Z" },
];

// -----------------------------------------------------------
// Computed helpers
// -----------------------------------------------------------
export function getApplicationsByStatus(status: ApplicationStatus): Application[] {
  return fakeApplications.filter((a) => a.status === status);
}

export function getUnreadEmails(): EmailMatch[] {
  return fakeEmails.filter((e) => !e.is_read);
}

export function getOverdueFollowups(): Application[] {
  const now = new Date();
  return fakeApplications.filter(
    (a) =>
      a.next_followup_at &&
      new Date(a.next_followup_at) <= now &&
      ["applied", "phone_screen", "interview"].includes(a.status)
  );
}

export function getApplicationById(id: string): Application | undefined {
  return fakeApplications.find((a) => a.id === id);
}

export function getEmailsForApplication(applicationId: string): EmailMatch[] {
  return fakeEmails.filter((e) => e.application_id === applicationId);
}

export function getActivityForApplication(applicationId: string): ActivityEntry[] {
  return fakeActivity.filter((a) => a.application_id === applicationId);
}

export function getCompanyForEmail(emailMatch: EmailMatch): Application | undefined {
  return fakeApplications.find((a) => a.id === emailMatch.application_id);
}

// Stats
export function getStats() {
  const applied = fakeApplications.filter((a) => a.status !== "saved");
  const ghosted = fakeApplications.filter((a) => a.status === "ghosted");
  const interviewed = fakeApplications.filter((a) =>
    ["interview", "offer"].includes(a.status)
  );
  const offers = fakeApplications.filter((a) => a.status === "offer");

  const interviewRate = applied.length > 0
    ? Math.round((interviewed.length / applied.length) * 100)
    : 0;

  const offerRate = applied.length > 0
    ? Math.round((offers.length / applied.length) * 100)
    : 0;

  const appsWithResponse = fakeApplications.filter(
    (a) => a.response_received_at && a.applied_at
  );
  const avgDays = appsWithResponse.length > 0
    ? (
      appsWithResponse.reduce((sum, a) => {
        const diff =
          new Date(a.response_received_at!).getTime() -
          new Date(a.applied_at!).getTime();
        return sum + diff / (1000 * 60 * 60 * 24);
      }, 0) / appsWithResponse.length
    ).toFixed(1)
    : "—";

  return {
    totalApplied: applied.length,
    ghosted: ghosted.length,
    interviewRate,
    avgDaysToResponse: avgDays,
    offerRate,
  };
}

// -----------------------------------------------------------
// Analytics Helpers
// -----------------------------------------------------------

/** Weekly application volume for bar chart */
export function getWeeklyVolume(): { week: string; applications: number; responses: number }[] {
  // Generate 8 weeks of data ending at current week
  const weeks: { week: string; weekStart: Date; applications: number; responses: number }[] = [];

  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (i * 7 + weekStart.getDay()));
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const label = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const apps = fakeApplications.filter((a) => {
      const date = a.applied_at ? new Date(a.applied_at) : null;
      return date && date >= weekStart && date < weekEnd;
    }).length;

    const resp = fakeApplications.filter((a) => {
      const date = a.response_received_at ? new Date(a.response_received_at) : null;
      return date && date >= weekStart && date < weekEnd;
    }).length;

    weeks.push({ week: label, weekStart, applications: apps, responses: resp });
  }

  return weeks.map(({ week, applications, responses }) => ({ week, applications, responses }));
}

/** Funnel conversion rates */
export function getFunnelData() {
  const total = fakeApplications.filter((a) => a.status !== "saved").length;
  const gotResponse = fakeApplications.filter((a) =>
    ["phone_screen", "interview", "offer", "rejected", "withdrew"].includes(a.status)
  ).length;
  const phonedScreened = fakeApplications.filter((a) =>
    ["phone_screen", "interview", "offer"].includes(a.status)
  ).length;
  const interviewed = fakeApplications.filter((a) =>
    ["interview", "offer"].includes(a.status)
  ).length;
  const offered = fakeApplications.filter((a) => a.status === "offer").length;

  return [
    { stage: "Applied", count: total, rate: 100, fill: "var(--status-applied-text)" },
    { stage: "Got Response", count: gotResponse, rate: total > 0 ? Math.round((gotResponse / total) * 100) : 0, fill: "var(--status-phone-screen-text)" },
    { stage: "Phone Screen", count: phonedScreened, rate: total > 0 ? Math.round((phonedScreened / total) * 100) : 0, fill: "var(--status-interview-text)" },
    { stage: "Interview", count: interviewed, rate: total > 0 ? Math.round((interviewed / total) * 100) : 0, fill: "var(--status-offer-text)" },
    { stage: "Offer", count: offered, rate: total > 0 ? Math.round((offered / total) * 100) : 0, fill: "#1f5a3a" },
  ];
}

/** Status distribution for donut chart */
export function getStatusDistribution() {
  const counts: Record<string, number> = {};
  for (const app of fakeApplications) {
    counts[app.status] = (counts[app.status] || 0) + 1;
  }
  const statusColors: Record<string, string> = {
    saved: "var(--status-saved-text)",
    applied: "var(--status-applied-text)",
    phone_screen: "var(--status-phone-screen-text)",
    interview: "var(--status-interview-text)",
    offer: "var(--status-offer-text)",
    rejected: "var(--status-rejected-text)",
    withdrew: "var(--status-withdrew-text)",
    ghosted: "var(--status-ghosted-text)",
  };
  const statusLabels: Record<string, string> = {
    saved: "Saved",
    applied: "Applied",
    phone_screen: "Phone Screen",
    interview: "Interview",
    offer: "Offer",
    rejected: "Rejected",
    withdrew: "Withdrew",
    ghosted: "Ghosted",
  };
  return Object.entries(counts).map(([status, count]) => ({
    name: statusLabels[status] || status,
    value: count,
    fill: statusColors[status] || "#9a9388",
  }));
}

/** Source breakdown */
export function getSourceBreakdown() {
  const counts: Record<string, number> = {};
  for (const app of fakeApplications) {
    counts[app.source] = (counts[app.source] || 0) + 1;
  }
  const sourceLabels: Record<string, string> = {
    linkedin: "LinkedIn",
    indeed: "Indeed",
    greenhouse: "Greenhouse",
    lever: "Lever",
    workday: "Workday",
    ashby: "Ashby",
    company_site: "Company Site",
    other: "Other",
  };
  return Object.entries(counts)
    .map(([source, count]) => ({
      name: sourceLabels[source] || source,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

/** Location breakdown */
export function getLocationBreakdown() {
  const counts: Record<string, number> = {};
  for (const app of fakeApplications) {
    // Group by region (province/state)
    const parts = app.location.split(", ");
    const region = parts.length > 1 ? parts[parts.length - 1] : app.location;
    counts[region] = (counts[region] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count);
}

/** Get all unique locations */
export function getUniqueLocations(): string[] {
  const locations = new Set(fakeApplications.map((a) => a.location));
  return [...locations].sort();
}

/** Get all unique roles */
export function getUniqueRoles(): string[] {
  const roles = new Set(fakeApplications.map((a) => a.role));
  return [...roles].sort();
}
