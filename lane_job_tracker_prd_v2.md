# Lane — Job Application Tracker (v2 PRD)

> Build me **Lane**: a Chrome extension paired with a web dashboard that automatically detects when I'm on ANY job posting page — whether it's LinkedIn, Indeed, Tesla's career site, Pratt & Whitney, or a random startup — captures the application in one click, records which resume I used, and tracks the full lifecycle of my application including email replies from companies via Gmail integration. The dashboard shows me a beautiful summary of my entire pipeline. Built for one user (me), architected so multi-user is a flip of a switch later.

---

## 1. The problem this solves

I'm applying to engineering internships and full-time roles. I lose track of:
- Which companies I've applied to and when
- What the original job posting said (postings get taken down after closing)
- Which version of my resume I sent to which company
- Where I am in each pipeline (applied → heard back → interview → offer/rejected)
- Whether a company ever replied (buried in 500 other emails)
- When I should follow up (and whether I already did)

Existing tools (Huntr, Teal, Simplify) are either freemium-paywalled, too feature-heavy, or only work on major job boards. I want a quiet, one-click tool that works on ANY job posting page — LinkedIn, Indeed, or a company's own career site — and connects to my Gmail so I never miss a reply.

---

## 2. Architecture overview

Three pieces, one backend:

- **Chrome extension** (Manifest V3, React via Vite-CRX). Lives in toolbar. Detects job posting pages. One-click capture. Also has Gmail read permission to scan for company replies.
- **Web dashboard** (Next.js 15 App Router + Tailwind + shadcn/ui, deployed on Vercel). The beautiful summary view.
- **Backend:** Supabase (Postgres + Auth + Storage). Single database both clients share.

---

## 3. Stack

**Extension:**
- Manifest V3
- Vite + CRXJS plugin (`@crxjs/vite-plugin`) for React + TypeScript
- Tailwind CSS for popup and sidebar UIs
- Supabase JS client for data operations
- Google OAuth2 for Gmail API access (scoped to read-only email)

**Dashboard:**
- Next.js 15 (App Router) + TypeScript
- Tailwind + shadcn/ui
- Supabase Auth (magic link)
- Recharts for pipeline visualizations
- Deployed on Vercel

**Backend:**
- Supabase Postgres + Auth + Storage
- Supabase Edge Function for periodic Gmail scan (optional — can also run client-side from extension)

---

## 4. Database schema

```sql
-- All rows scoped by user_id = auth.uid().

-- ==================
-- APPLICATIONS TABLE
-- ==================
create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  
  -- Core captured data
  company text not null,
  role text not null,
  location text,
  job_url text not null,
  job_description text, -- full text of the posting at capture time
  source text not null default 'other',
  -- source values: 'linkedin', 'indeed', 'greenhouse', 'lever', 'workday', 'ashby', 'company_site', 'other'
  
  -- Detection metadata
  detection_tier text not null default 'manual',
  -- 'tier1' = specific parser matched, 'tier2' = generic detector, 'manual' = user typed it in
  
  -- Screenshot
  screenshot_path text, -- path in Supabase storage
  
  -- Resume tracking
  resume_version text, -- label like "v3-mechanical-focused"
  resume_file_path text, -- path in Supabase storage to the actual PDF used
  
  -- Pipeline status
  status text not null default 'applied' check (status in (
    'saved',         -- bookmarked, haven't applied yet
    'applied',       -- submitted application
    'phone_screen',  -- recruiter call
    'interview',     -- technical or panel interview
    'offer',         -- received offer
    'rejected',      -- rejected by company
    'withdrew',      -- I withdrew
    'ghosted'        -- 30+ days, no response
  )),
  
  -- User notes
  notes text default '',
  
  -- Salary (optional)
  salary_min int,
  salary_max int,
  salary_currency text default 'CAD',
  
  -- Date tracking
  applied_at timestamptz, -- when I actually submitted (set when status moves to 'applied')
  response_received_at timestamptz, -- first email reply detected from this company
  interview_at timestamptz, -- scheduled interview date
  offer_at timestamptz, -- date offer was received
  rejected_at timestamptz, -- date rejection came in
  last_status_change_at timestamptz default now(),
  next_followup_at timestamptz, -- "remind me to follow up"
  
  -- Auto-ghosting: if status = 'applied' and now() - applied_at > 30 days, dashboard shows ghost icon
  
  -- Metadata
  captured_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index applications_user_status_idx on applications (user_id, status);
create index applications_user_captured_idx on applications (user_id, captured_at desc);
create index applications_user_followup_idx on applications (user_id, next_followup_at) where next_followup_at is not null;
create index applications_company_idx on applications (user_id, lower(company));

-- ==================
-- EMAIL MATCHES TABLE
-- ==================
-- Stores emails detected from companies I've applied to
create table email_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references applications(id) on delete cascade,
  
  gmail_message_id text not null unique, -- Gmail message ID to avoid duplicates
  gmail_thread_id text, -- Gmail thread ID for grouping
  
  from_email text not null,
  from_name text,
  subject text not null,
  snippet text, -- first 200 chars of the email body
  received_at timestamptz not null,
  
  -- Status suggestion
  suggested_status text, -- 'phone_screen', 'interview', 'rejected', null if unclear
  status_applied boolean not null default false, -- whether the user accepted the suggestion
  
  is_read boolean not null default false, -- has user seen this in the dashboard
  
  created_at timestamptz not null default now()
);

create index email_matches_user_app_idx on email_matches (user_id, application_id);
create index email_matches_user_unread_idx on email_matches (user_id) where is_read = false;

-- ==================
-- RESUME VERSIONS TABLE
-- ==================
create table resume_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null, -- "v3-mechanical-focused"
  file_path text, -- path in Supabase storage
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- ==================
-- ACTIVITY LOG TABLE
-- ==================
-- Every status change, note edit, email detection gets logged
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references applications(id) on delete cascade,
  
  action text not null, -- 'status_change', 'note_added', 'email_detected', 'followup_set', 'created'
  details jsonb, -- e.g., {"from": "applied", "to": "phone_screen"} or {"subject": "Next steps..."}
  
  created_at timestamptz not null default now()
);

create index activity_log_user_app_idx on activity_log (user_id, application_id, created_at desc);
create index activity_log_user_recent_idx on activity_log (user_id, created_at desc);

-- ==================
-- TRIGGERS
-- ==================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger applications_updated_at
before update on applications
for each row execute function update_updated_at_column();

-- ==================
-- RLS
-- ==================
alter table applications enable row level security;
alter table email_matches enable row level security;
alter table resume_versions enable row level security;
alter table activity_log enable row level security;

create policy "users see own applications" on applications for all using (auth.uid() = user_id);
create policy "users see own emails" on email_matches for all using (auth.uid() = user_id);
create policy "users see own resumes" on resume_versions for all using (auth.uid() = user_id);
create policy "users see own activity" on activity_log for all using (auth.uid() = user_id);
```

### Supabase Storage

Two buckets, both **private**:

- `screenshots` — posting screenshots. Path: `{user_id}/{application_id}.png`
- `resumes` — resume PDFs. Path: `{user_id}/{resume_version_id}.pdf`

Generate signed URLs (1-hour expiry) when rendering.

---

## 5. Chrome extension — detailed spec

### 5.1 Manifest

```json
{
  "manifest_version": 3,
  "name": "Lane",
  "version": "1.0.0",
  "description": "One-click job application tracker that works on any career page",
  "permissions": [
    "activeTab",
    "storage",
    "scripting",
    "identity",
    "alarms"
  ],
  "host_permissions": [
    "https://www.linkedin.com/*",
    "https://www.indeed.com/*",
    "https://*.greenhouse.io/*",
    "https://jobs.lever.co/*",
    "https://*.myworkdayjobs.com/*",
    "https://*.ashbyhq.com/*",
    "https://mail.google.com/*",
    "https://www.googleapis.com/*",
    "<all_urls>"
  ],
  "oauth2": {
    "client_id": "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
    "scopes": ["https://www.googleapis.com/auth/gmail.readonly"]
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": { "16": "icon-16.png", "48": "icon-48.png", "128": "icon-128.png" }
  },
  "background": { "service_worker": "background.js" },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content-detector.js"],
      "run_at": "document_idle"
    }
  ],
  "icons": { "16": "icon-16.png", "48": "icon-48.png", "128": "icon-128.png" }
}
```

### 5.2 Two-tier job detection system

This is the core innovation. The extension must work on ANY job page, not just the big boards.

**Tier 1 — Specific parsers (high confidence, structured extraction):**

Build one extraction module per platform. Each returns:
```ts
interface JobData {
  company: string;
  role: string;
  location: string | null;
  description: string;
  url: string;
  source: string;
  confidence: 'high'; // Tier 1 always high
}
```

| Platform | URL match pattern | Key selectors |
|---|---|---|
| LinkedIn | `linkedin.com/jobs/view/*` | `.job-details-jobs-unified-top-card__job-title`, company name selector, location |
| Indeed | `indeed.com/viewjob*` or `indeed.com/jobs*` | `h1[data-testid="jobsearch-JobInfoHeader-title"]`, company selector |
| Greenhouse | `*.greenhouse.io/*` or `boards.greenhouse.io/*` | `.app-title`, `.company-name` |
| Lever | `jobs.lever.co/*/*` | `.posting-headline h2`, company from subdomain |
| Workday | `*.myworkdayjobs.com/*` or `*.wd5.myworkdayjobs.com/*` | `[data-automation-id="jobPostingHeader"]` |
| Ashby | `*.ashbyhq.com/*` or `jobs.ashbyhq.com/*` | Job title `h1`, company from branding |

**Important:** Selectors WILL break when these sites update. Each extractor must be wrapped in try-catch. If any selector fails, that field returns `null` and the popup lets the user fill it manually. Never block capture because extraction failed.

**Tier 2 — Generic career page detector (medium confidence):**

This is what makes Lane work on Tesla, Pratt & Whitney, Bombardier, CAE, or any company career page.

The content script (`content-detector.js`) runs on every page at `document_idle` and scores the page on career-page signals:

```ts
// Scoring signals (each worth points, threshold triggers detection)
const signals = {
  // URL signals (3 points each)
  urlContainsCareer: /\/(careers?|jobs?|openings?|positions?|vacancies|employment|hiring|opportunities|recruit)/i,
  urlContainsJobId: /\/(job|position|opening|req)[_-]?\d+/i,
  urlContainsApply: /\/apply/i,
  
  // Page content signals (2 points each)
  hasApplyButton: () => !!document.querySelector(
    'a[href*="apply"], button[class*="apply"], input[value*="Apply"], a[class*="apply"], [data-action*="apply"]'
  ),
  hasJobTitle: () => {
    const h1 = document.querySelector('h1');
    if (!h1) return false;
    const text = h1.textContent.toLowerCase();
    return /engineer|designer|analyst|developer|manager|intern|specialist|coordinator|technician/.test(text);
  },
  hasCompanyBranding: () => !!document.querySelector('meta[property="og:site_name"]'),
  hasLocationField: () => {
    const text = document.body.innerText;
    return /location\s*:/i.test(text) || /remote|hybrid|on-?site/i.test(text);
  },
  hasJobDescriptionMarkers: () => {
    const text = document.body.innerText.toLowerCase();
    return (
      (text.includes('responsibilities') || text.includes('qualifications') || text.includes('requirements')) &&
      (text.includes('experience') || text.includes('skills'))
    );
  },
  
  // Meta signals (2 points each)
  hasJobPostingSchema: () => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        if (data['@type'] === 'JobPosting' || data?.['@graph']?.some(i => i['@type'] === 'JobPosting')) return true;
      } catch {}
    }
    return false;
  },
  
  // ATS platform signals (3 points — these are career page platforms)
  isKnownATS: () => {
    const html = document.documentElement.innerHTML.toLowerCase();
    return /icims|taleo|successfactors|jobvite|smartrecruiters|bamboohr|jazz\.co|breezy\.hr|recruitee|teamtailor|personio/.test(html);
  }
};
```

**Scoring:** Sum the points. If score >= 6, the page is likely a job posting. The content script sends a message to the background worker: `{ type: 'JOB_DETECTED', score, url }`. The extension icon gets a small green dot badge indicating "job detected."

**Tier 2 extraction:** When Tier 2 fires, extract what we can:
```ts
interface GenericJobData {
  company: string | null;    // from og:site_name, or domain name cleaned up
  role: string | null;       // from <title> or first <h1>
  location: string | null;   // regex scan for "Location: ..." patterns
  description: string;       // innerText of main content area
  url: string;               // window.location.href
  source: 'company_site';
  confidence: 'medium';
}
```

**Company name extraction for unknown sites** (this is important for matching Gmail later):
1. First try: `<meta property="og:site_name">` content
2. Second try: structured data `JobPosting.hiringOrganization.name`
3. Third try: clean the domain name (`careers.prattwhitney.com` → `Pratt Whitney` → user confirms/edits)
4. Last resort: ask the user to type it

### 5.3 Extension popup UI

**State 1: Job detected (Tier 1 or Tier 2), not yet saved**

```
┌─────────────────────────────────────┐
│  Lane                    [≡]   ✕    │
│                                     │
│  ┌─ 🟢 Job detected ────────────┐  │
│  │  Mechanical Engineer Intern   │  │
│  │  Tesla · Fremont, CA          │  │
│  │  ── via company career page ──│  │
│  └───────────────────────────────┘  │
│                                     │
│  Edit details if anything's wrong ▼ │
│  ┌───────────────────────────────┐  │
│  │ Company: [Tesla             ] │  │
│  │ Role:    [Mech Eng Intern   ] │  │
│  │ Location:[Fremont, CA       ] │  │
│  └───────────────────────────────┘  │
│                                     │
│  STATUS                             │
│  [ Saved ] [ Applied ● ]            │
│                                     │
│  RESUME USED                        │
│  [ v3-mech-focused    ▼ ]           │
│  or attach new: [Upload PDF]        │
│                                     │
│  APPLIED DATE                       │
│  [ Today, May 17 ▼ ]               │
│                                     │
│  NOTES                              │
│  [ Referred by Jake             ]   │
│                                     │
│  ☑ Screenshot this posting          │
│  ☑ Auto-set followup (7 days)       │
│                                     │
│  [     ✓  Save to Lane           ]  │
│                                     │
│  ─── 47 applications tracked ───    │
│  Open dashboard →                   │
└─────────────────────────────────────┘
```

Key behaviors:
- Edit details section is collapsed by default when Tier 1 extraction succeeds (high confidence). Expanded by default when Tier 2 (medium confidence) so the user can verify/fix.
- "Resume used" dropdown is populated from the `resume_versions` table. "Upload PDF" opens a file picker; the PDF is uploaded to Supabase Storage and a new resume version is created.
- "Applied date" defaults to today but is editable (for cases where you applied yesterday but are capturing today).
- Screenshot checkbox is on by default. Uses `chrome.tabs.captureVisibleTab()`.
- Auto-followup checkbox auto-sets `next_followup_at` to `applied_at + 7 days` (interval configurable in settings).
- On save: write to Supabase, log to `activity_log`, show brief "✓ Saved" confirmation, auto-close popup after 1 second.

**State 2: Already saved (URL found in database)**

```
┌─────────────────────────────────────┐
│  Lane                          ✕    │
│                                     │
│  ✓ Tracked · saved 3 days ago       │
│                                     │
│  Tesla · Mech Engineer Intern       │
│  Status: Applied                    │
│                                     │
│  UPDATE STATUS                      │
│  [Applied ▼] → [Phone Screen ▼]    │
│                                     │
│  FOLLOWUP                           │
│  Due in 4 days · [Snooze 3 days]    │
│                                     │
│  📧 1 new email from Tesla          │
│  "Thank you for applying..."        │
│  [View in dashboard →]              │
│                                     │
│  [    Update    ]  [ Dashboard ↗ ]  │
└─────────────────────────────────────┘
```

**State 3: No job detected (random page)**

```
┌─────────────────────────────────────┐
│  Lane                          ✕    │
│                                     │
│  No job posting detected.           │
│                                     │
│  [+ Add manually]  [Dashboard ↗]    │
│                                     │
│  ─── 47 applications tracked ───    │
└─────────────────────────────────────┘
```

"Add manually" opens a full manual entry form (Company, Role, Location, URL pre-filled from current tab, Status, Resume version, Notes, Date).

### 5.4 Gmail integration

**How it works:**

1. User connects Gmail once via Google OAuth2 (`chrome.identity.getAuthToken`). Scope: `gmail.readonly` (read-only, never sends or modifies emails).
2. Extension's background service worker runs a scan every 30 minutes (via `chrome.alarms`).
3. The scan:
   a. Gets the list of companies from the user's applications (from Supabase).
   b. Queries Gmail API: `GET /gmail/v1/users/me/messages?q=from:({company1} OR {company2} OR ...) newer_than:1d`
   c. For each matching email, checks if `gmail_message_id` already exists in `email_matches`. If not, inserts it.
   d. Attempts a simple status suggestion based on subject/snippet keywords:
      - Contains "schedule", "interview", "call", "meet" → suggest `phone_screen` or `interview`
      - Contains "unfortunately", "other candidates", "not moving forward", "regret" → suggest `rejected`
      - Contains "offer", "compensation", "package", "congratulations" → suggest `offer`
      - Otherwise → `null` (no suggestion, just surface the email)

4. When new email matches are found, the extension badge shows a count (e.g., red badge "2" on the Lane icon).

**Gmail query construction — matching companies to emails:**

This is the tricky part. Company names don't always match email domains. Tesla emails come from `tesla.com`, but Pratt & Whitney might email from `pwc.ca` or `rtx.com` or `collins.com`.

Strategy:
```ts
// For each application, build search terms:
// 1. Company name as-is: "Tesla"
// 2. Company domain extracted from job_url: "tesla.com"
// 3. Common email domain patterns from the job page

function buildGmailQuery(applications: Application[]): string {
  const terms = applications.flatMap(app => {
    const companyName = app.company.toLowerCase().replace(/[^a-z0-9 ]/g, '');
    const domain = new URL(app.job_url).hostname.replace('www.', '').replace('careers.', '').replace('jobs.', '');
    return [`from:${domain}`, `"${companyName}"`];
  });
  // Gmail search: group with OR, limit to recent
  return `(${[...new Set(terms)].join(' OR ')}) newer_than:7d`;
}
```

This will over-match (you might get non-job emails from tesla.com). That's fine — false positives are cheap (user ignores them), false negatives are expensive (miss an interview invite). Err toward catching everything.

**Dashboard integration:** emails show up in two places:
1. The `/dashboard` page gets a "New emails" section above the pipeline
2. The `/applications/[id]` detail page shows all matched emails in a timeline

### 5.5 Auth

**Supabase auth (for data sync):**
- First time opening extension, popup shows "Sign in to Lane" button
- Clicking opens `https://lane-app.vercel.app/extension-auth` in a new tab
- User enters email, receives magic link, clicks it
- The `/extension-auth` page captures the Supabase session and writes the access/refresh tokens to `chrome.storage.local` via a bridge script
- Extension reads tokens on next open and is authenticated
- Background worker refreshes tokens silently using `supabase.auth.refreshSession()`

**Google OAuth (for Gmail):**
- Separate from Supabase auth
- Uses `chrome.identity.getAuthToken({ interactive: true })` which triggers Chrome's native Google sign-in
- Token stored in Chrome's internal identity system (not in storage — Chrome manages it)
- First time: user sees Google's consent screen asking for gmail.readonly permission
- Revocable at any time from the extension's settings

---

## 6. Web dashboard — detailed spec

### 6.1 Routes

| Route | Purpose |
|---|---|
| `/login` | Magic-link sign in |
| `/extension-auth` | Auth handoff page for Chrome extension |
| `/dashboard` | Hero view: stats, pipeline, emails, followups |
| `/applications` | Full table with filtering, sorting, search |
| `/applications/[id]` | Detail page with timeline, emails, notes |
| `/settings` | Resume versions, followup interval, Gmail status |

### 6.2 Visual direction

Warm, quiet, design-forward. The dashboard a recruiter sees should make them pause.

**Colors:**

| Token | Value | Use |
|---|---|---|
| `--bg-base` | `#fafaf7` | Page background |
| `--surface` | `#ffffff` | Cards |
| `--surface-muted` | `#f7f3eb` | Inset blocks, hover |
| `--border` | `#ebe6db` | Borders |
| `--text-primary` | `#1a1a1a` | Headings |
| `--text-secondary` | `#5a5246` | Body |
| `--text-tertiary` | `#9a9388` | Meta/timestamps |
| `--accent` | `#1f1d1a` | Primary buttons |

**Status pill colors:**

| Status | Bg | Text |
|---|---|---|
| Saved | `#e3e8ed` | `#3a5a78` |
| Applied | `#fde9d6` | `#a8632a` |
| Phone screen | `#e8e2f0` | `#6b4ea0` |
| Interview | `#e0eede` | `#3d6b3a` |
| Offer | `#d4e8dc` | `#1f5a3a` |
| Rejected | `#e8c9c9` | `#7a3a3a` |
| Withdrew | `#e0d8c9` | `#7a6b48` |
| Ghosted | `#d4d4d4` | `#5a5246` |

**Typography:** `-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif`. Titles 28px/700, labels 11px/600 uppercase, body 15px, stats 36px/700.

### 6.3 `/dashboard`

**Desktop layout, top to bottom:**

**1. Top bar**
- Left: "Lane" wordmark (subtle, not a logo — just clean type)
- Right: search bar (Cmd-K), notification dot if unread emails, settings gear, profile menu

**2. Alert bar (conditional, only shows when relevant)**
- Urgent items in a horizontal strip: "📧 2 new company replies" · "⏰ 3 followups overdue"
- Each is clickable and scrolls to the relevant section below

**3. Hero stats row — five numbers in a single horizontal strip:**

| Stat | Calculation | Format |
|---|---|---|
| Total applied | count where status != 'saved' | "47" |
| Active pipeline | count where status in ('applied', 'phone_screen', 'interview') | "12" |
| Response rate | (count status not in ('applied', 'ghosted')) / (count status != 'saved') × 100 | "34%" |
| Avg days to response | avg(response_received_at - applied_at) where response_received_at is not null | "8.2 days" |
| Offers | count where status = 'offer' | "2" |

Each stat: large number (36px, bold), small uppercase label (11px) below. Subtle card background. On hover, show a tiny sparkline of the stat over the last 30 days (optional — nice polish, not essential for v1).

**4. Pipeline Kanban**

Horizontal scrolling row of columns:

| Saved | Applied | Phone Screen | Interview | Offer |
|---|---|---|---|---|

Each column:
- Header: status name + count pill
- Below: cards for the 5 most recent applications in that status
- Each card: company name (bold, 14px), role (12px, secondary), "applied 3 days ago" or "interview in 2 days" (12px, tertiary), small source icon (LinkedIn logo, Indeed logo, or generic globe for company sites)
- Click card → `/applications/[id]`
- Bottom of column: "View all (N) →"
- Drag-and-drop between columns to change status (if using `@dnd-kit/sortable` — optional for v1, can just use click-to-change)

**Rejected, Withdrew, Ghosted** are NOT shown as columns. They live in a collapsible "Closed" section below the pipeline, or in the full `/applications` table.

**5. Email inbox section: "Company replies"**

A clean list of recent `email_matches` where `is_read = false`:

```
┌─────────────────────────────────────────────────┐
│ 📧 Company replies                    Mark all read │
│                                                 │
│  Tesla · "Next Steps — Mechanical Eng Intern"   │
│  2 hours ago · Suggested: Phone Screen          │
│  [Accept ✓] [Dismiss] [View email ↗]            │
│                                                 │
│  Bombardier · "Application Received"            │
│  yesterday · No action needed                   │
│  [Mark read] [View email ↗]                     │
│                                                 │
│  Pratt & Whitney · "Unfortunately..."           │
│  3 days ago · Suggested: Rejected               │
│  [Accept ✓] [Dismiss]                           │
└─────────────────────────────────────────────────┘
```

When user clicks "Accept ✓" on a status suggestion:
- Update `applications.status` to the suggested value
- Set appropriate date field (`rejected_at`, `interview_at`, etc.)
- Log to `activity_log`
- Mark the email as read in `email_matches`

"View email ↗" opens the Gmail message in a new tab: `https://mail.google.com/mail/u/0/#inbox/{gmail_message_id}`

**6. Needs followup section**

Applications where `next_followup_at <= now()` and status in ('applied', 'phone_screen', 'interview'):

```
│  ⏰ Follow up                                    │
│                                                   │
│  CAE · Systems Engineer Intern                    │
│  Applied 12 days ago · followup 5 days overdue    │
│  [✓ Done] [Snooze 3 days] [Draft email ↗]        │
│                                                   │
│  Bombardier · Stress Analyst Co-op                │
│  Applied 9 days ago · followup 2 days overdue     │
│  [✓ Done] [Snooze 3 days]                         │
```

"Done" clears `next_followup_at` and logs "followed up" in activity. "Snooze" pushes `next_followup_at` forward by N days. "Draft email ↗" opens Gmail compose with a pre-filled recipient if we have the recruiter's email from `email_matches`.

**7. Recent activity timeline**

Last 10 entries from `activity_log`, formatted:
```
│  Today                                           │
│  · Tesla → Phone Screen (from email suggestion)  │
│  · Saved: SpaceX Propulsion Intern               │
│                                                   │
│  Yesterday                                        │
│  · Applied: Pratt & Whitney Thermal Analyst      │
│  · 📧 Bombardier replied: "Application Received" │
```

**Mobile layout:**
- Stats become 2x2 + 1 grid
- Pipeline becomes vertical accordion (tap status name to expand cards)
- Email and followup sections stack vertically
- Everything scrollable

### 6.4 `/applications` — full table

Sortable, filterable, searchable table.

**Columns:** Company, Role, Status (colored pill), Source, Applied date, Last update, Followup, Emails (count), Resume version

**Top bar:**
- Search input (searches company, role, notes — Postgres `ilike`)
- Status filter (multi-select chips with counts)
- Source filter (multi-select: LinkedIn, Indeed, Company site, etc.)
- Date range filter
- Sort by: Applied date, Last update, Company name
- "+ Add manually" button

**Click any row → `/applications/[id]`**

**Mobile:** cards instead of table rows, same filtering.

### 6.5 `/applications/[id]` — detail page

**Header (sticky):**
- Company · Role (32px, bold)
- Status pill (clickable → dropdown to change, logs to activity)
- Location · Source · Resume version used
- "Open original posting ↗" button (opens `job_url`)

**Left column (desktop) / main column (mobile):**

**Timeline** — the single most useful view. Combines activity log + email matches into one chronological stream:

```
│  May 17 · Saved from Tesla careers page           │
│  May 17 · Applied (resume: v3-mech-focused)        │
│  May 17 · Auto-followup set for May 24             │
│  May 20 · 📧 "Application Received" from Tesla     │
│  May 24 · ⏰ Followup due                           │
│  May 25 · Followed up via email                     │
│  May 28 · 📧 "Next Steps" from Tesla               │
│  May 28 · Status → Phone Screen                    │
```

**Below timeline:**
- **Job description** (collapsible) — full text captured at save time
- **Screenshot** (if taken) — expandable, zoomable
- **Notes** — large textarea, autosaves on blur

**Right sidebar (desktop) / below notes (mobile):**
- Key dates card: Applied, First response, Interview, Followup due
- Resume used (with "view PDF" link)
- Salary range (if entered)
- Delete button (with confirmation)

### 6.6 `/settings`

**Resume versions:**
- List of versions with label + upload date + file size
- Upload new version (PDF), give it a label
- Set one as default (pre-selected in extension popup)
- Delete old versions

**Followup defaults:**
- Default interval in days (default: 7)
- Auto-ghosted threshold in days (default: 30) — applications past this without response get a ghost icon

**Gmail connection:**
- Status: Connected as `louis@gmail.com` / Not connected
- "Connect Gmail" / "Disconnect" button
- Last scan: "2 minutes ago"
- Manual "Scan now" button

**Account:**
- Email
- Log out
- Delete all data (with "type DELETE to confirm")

---

## 7. Build order

**Weekend 1 — Backend + Dashboard MVP (10-12 hours):**

1. Create Supabase project. Run the full schema SQL above.
2. Scaffold Next.js + Tailwind + shadcn/ui
3. Implement `/login` with Supabase magic link
4. Build `/dashboard` layout with **hardcoded fake data** — get every section looking right visually before touching real data
5. Build `/applications` table view (fake data)
6. Build `/applications/[id]` detail page (fake data)
7. Wire up real Supabase queries
8. Deploy to Vercel
9. Test: manually insert 5-10 fake applications via Supabase dashboard, verify everything renders

**Weekend 2 — Chrome extension core (10-12 hours):**

1. Scaffold extension with Vite + CRXJS
2. Build Tier 1 extractor for LinkedIn only — get one working end-to-end
3. Build popup UI (React + Tailwind)
4. Implement Supabase auth handoff between dashboard and extension
5. Implement save flow with screenshot capture
6. Implement "already saved" detection
7. Add Tier 1 extractors: Indeed, Greenhouse, Lever, Workday, Ashby — one at a time
8. Build Tier 2 generic detector with scoring system
9. Implement manual entry fallback
10. Test on 10 real job postings across different sites

**Weekend 3 — Gmail + resume management (8-10 hours):**

1. Set up Google Cloud project with OAuth consent screen (gmail.readonly scope)
2. Implement `chrome.identity.getAuthToken` flow
3. Build Gmail scanning logic in background service worker
4. Build company-to-email matching
5. Build email_matches insert flow with status suggestions
6. Wire emails into dashboard (company replies section + application detail timeline)
7. Build resume version management (upload, label, set default)
8. Wire resume selection into extension popup

**Weekend 4 — Polish + dogfood (6-8 hours):**

1. Settings page
2. Followup system (auto-set on save, overdue detection, snooze)
3. Activity log (auto-log all status changes, email detections)
4. Timeline view on application detail page
5. Empty states everywhere
6. Loading skeletons
7. Error handling (what if Gmail token expires, what if Supabase is down, what if extraction fails)
8. Use it for real for one full week before publishing

---

## 8. What's NOT in v1

Do not build:
- AI cover letter generation
- AI resume tailoring
- Salary benchmarking against external data
- Interview scheduling with calendar integration
- Automated application submission (filling forms for you)
- Multi-user teams or sharing
- Firefox or Safari extension versions
- Mobile app
- Export to CSV/PDF
- Charts beyond the hero stats
- Custom statuses beyond the 8 built-in ones
- Tags or labels on applications
- Drag-and-drop reorder within pipeline columns (change status via click is fine for v1)
- Email sending (we only READ Gmail, never send)
- Recruiter contact management / address book
- Company research / Glassdoor enrichment
- Notification push to phone
- Browser extension sidebar panel (popup is enough)

---

## 9. Privacy and data handling

This is important because the extension reads Gmail and captures job posting content.

- Gmail scope is `readonly` — the extension can NEVER send, delete, or modify emails
- Email content is NOT stored — only `from`, `subject`, `snippet` (first 200 chars), and `received_at` are saved to the database
- Job descriptions are stored as plain text for the user's own reference
- Screenshots are stored in a private Supabase bucket accessible only by the authenticated user
- Resume PDFs are stored in a private bucket, never shared
- All data is scoped by `user_id` via RLS — even if multi-user is added later, users can never see each other's data
- The extension badge is the ONLY ambient signal — no desktop notifications, no popups, no interruptions

State this clearly in the Chrome Web Store listing and in a `/privacy` page on the dashboard.

---

## 10. Success criteria

**Technical:**
- Tier 1 detection works on LinkedIn, Indeed, Greenhouse, Lever, Workday with >90% accuracy
- Tier 2 detection correctly identifies job posting pages with >70% accuracy (false positives are acceptable, false negatives are not)
- Gmail scan finds relevant company replies within 30 minutes of receipt
- Full capture flow (detect → fill → save) takes < 5 seconds
- Dashboard loads in < 1.5 seconds

**Personal:**
- I capture every application I make for 30 consecutive days using Lane
- I check the dashboard at least 3 times per week
- I never miss a company reply because it was buried in my inbox
- I never have a "wait, did I apply there?" moment
- Zero applications fall through the cracks during my internship search

If all five are true after 30 days, publish to Chrome Web Store and share with classmates.

---

*End of PRD. Build exactly this. Ask before adding anything not listed.*
