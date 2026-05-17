# First Prompt — Paste this into your vibe coding platform

> **Instructions:** Paste everything below as your first message. Attach the PRD document (lane_job_tracker_prd_v2.md) as a file alongside this prompt. The platform will read both.

---

## What we're building

We're building **Lane** — a job application tracking tool for engineering students and new grads who are actively applying to internships and full-time roles. It has two parts that share one backend:

1. **A Chrome extension** that detects when the user is on a job posting page (LinkedIn, Indeed, Greenhouse, Lever, Workday, Ashby, or ANY company career site like Tesla, Pratt & Whitney, Bombardier, CAE, SpaceX, etc.) and lets them save the application in one click.

2. **A web dashboard** (the part we're building first) where the user sees their entire application pipeline — how many they've applied to, which companies have replied, which ones need follow-up, and where each application stands in the process (saved → applied → phone screen → interview → offer/rejected).

The tool also connects to Gmail (read-only) to automatically detect replies from companies the user has applied to, so they never miss an interview invite or rejection buried in their inbox.

## Who this is for

The primary user is a university engineering student (mechanical, electrical, software — any discipline) who is applying to 20-100+ jobs over the course of an internship or job search season. Their current workflow is chaos: they apply on LinkedIn, Indeed, company career pages, Workday portals, and lose track of what they applied to, when, which resume they used, and whether the company ever responded. They resort to messy spreadsheets or just memory, both of which fail past ~15 applications.

Lane replaces the spreadsheet with something that:
- **Captures automatically** from the page they're already on (no manual data entry)
- **Tracks the full lifecycle** from "saved this posting" to "got the offer" or "got ghosted"
- **Catches email replies** they'd otherwise miss
- **Reminds them to follow up** at the right time
- **Looks beautiful enough to show a recruiter** as a portfolio piece

## The attached PRD

I've attached a detailed PRD document (`lane_job_tracker_prd_v2.md`). It contains:
- The full database schema (Supabase Postgres) — use it exactly as written
- The complete visual design system (colors, typography, spacing, status colors)
- Every route and page layout specified in detail
- The Chrome extension spec (build this AFTER the dashboard)
- The Gmail integration spec (build this AFTER the extension)
- A prioritized build order

**Read the entire PRD before writing any code.** It is the source of truth for every decision.

## What to build RIGHT NOW (Phase 1 — Dashboard)

In this first phase, build ONLY the web dashboard. Do NOT build the Chrome extension or Gmail integration yet. Those come in later phases.

### Step 1: Set up the project

- Scaffold a **Next.js 15** project using the **App Router** with **TypeScript**
- Install and configure **Tailwind CSS** and **shadcn/ui**
- Set up the **Supabase** client with environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- The database schema is in Section 4 of the PRD — run that SQL in the Supabase SQL editor to create all tables, indexes, RLS policies, and triggers
- Create two Supabase Storage buckets: `screenshots` (private) and `resumes` (private)

### Step 2: Authentication

- Implement `/login` page with Supabase magic link authentication (email only, no passwords, no social logins)
- Implement `/extension-auth` page (a simple page that will later handle auth handoff to the Chrome extension — for now, just create the route with a placeholder)
- Add protected route middleware: redirect to `/login` if no active Supabase session
- After login, redirect to `/dashboard`

### Step 3: Build the dashboard layout with realistic fake data FIRST

**This is critical: build the entire UI with hardcoded fake data before wiring up Supabase queries.** The visual design must look right before we touch real data.

Create a file called `lib/fake-data.ts` with at least 15-20 realistic job applications spanning all statuses. Use real company names that an engineering student would apply to:

```ts
// Example entries (create 15-20 of these with variety)
const fakeApplications = [
  {
    id: '1',
    company: 'Tesla',
    role: 'Mechanical Engineer Intern',
    location: 'Fremont, CA',
    status: 'interview',
    source: 'company_site',
    applied_at: '2026-04-15',
    resume_version: 'v3-mechanical-focused',
    notes: 'Referred by Jake from capstone team',
    next_followup_at: null,
  },
  {
    id: '2',
    company: 'Pratt & Whitney',
    role: 'Thermal Analyst Co-op',
    location: 'Longueuil, QC',
    status: 'applied',
    source: 'company_site',
    applied_at: '2026-05-01',
    resume_version: 'v2-aerospace-focused',
    notes: '',
    next_followup_at: '2026-05-08',
  },
  {
    id: '3',
    company: 'Bombardier',
    role: 'Stress Engineer Intern',
    location: 'Dorval, QC',
    status: 'phone_screen',
    source: 'linkedin',
    applied_at: '2026-04-20',
    resume_version: 'v3-mechanical-focused',
    notes: 'HR called May 2, technical screen next week',
    next_followup_at: null,
  },
  {
    id: '4',
    company: 'SpaceX',
    role: 'Propulsion Engineer Intern',
    location: 'Hawthorne, CA',
    status: 'rejected',
    source: 'company_site',
    applied_at: '2026-03-10',
    resume_version: 'v2-aerospace-focused',
    notes: 'Got the generic rejection email after 3 weeks',
    next_followup_at: null,
  },
  {
    id: '5',
    company: 'CAE',
    role: 'Systems Engineer Intern',
    location: 'Saint-Laurent, QC',
    status: 'applied',
    source: 'indeed',
    applied_at: '2026-05-10',
    resume_version: 'v3-mechanical-focused',
    notes: '',
    next_followup_at: '2026-05-17',
  },
  // ... add 10-15 more with companies like:
  // Google, Apple, Amazon, Microsoft, Meta (for SWE roles)
  // Lockheed Martin, Boeing, Northrop Grumman, Raytheon (aerospace)
  // Hatch, WSP, SNC-Lavalin, Stantec (consulting/civil)
  // ABB, Siemens, Schneider Electric (industrial)
  // Shopify, Wealthsimple, Lightspeed (Canadian tech)
  // Use a mix of statuses: saved, applied, phone_screen, interview, offer, rejected, ghosted, withdrew
  // Use a mix of sources: linkedin, indeed, greenhouse, lever, workday, company_site
  // Some should have next_followup_at in the past (overdue), some in the future, most null
];

const fakeEmails = [
  {
    id: '1',
    application_id: '1',
    from_name: 'Tesla Recruiting',
    from_email: 'recruiting@tesla.com',
    subject: 'Next Steps — Mechanical Engineer Intern Position',
    snippet: 'Thank you for your interest in Tesla. We would like to schedule a technical phone screen with the team...',
    received_at: '2026-05-15T14:30:00Z',
    suggested_status: 'phone_screen',
    is_read: false,
  },
  {
    id: '2',
    application_id: '4',
    from_name: 'SpaceX Talent',
    from_email: 'talent@spacex.com',
    subject: 'Update on Your Application',
    snippet: 'Thank you for taking the time to apply. After careful consideration, we have decided to move forward with other candidates...',
    received_at: '2026-04-01T09:00:00Z',
    suggested_status: 'rejected',
    is_read: true,
  },
  // Add 3-5 more
];

const fakeActivity = [
  { action: 'created', company: 'CAE', role: 'Systems Engineer Intern', created_at: '2026-05-10T10:00:00Z' },
  { action: 'status_change', company: 'Tesla', role: 'Mechanical Engineer Intern', details: { from: 'phone_screen', to: 'interview' }, created_at: '2026-05-14T16:00:00Z' },
  { action: 'email_detected', company: 'Tesla', subject: 'Next Steps', created_at: '2026-05-15T14:30:00Z' },
  { action: 'status_change', company: 'SpaceX', role: 'Propulsion Engineer Intern', details: { from: 'applied', to: 'rejected' }, created_at: '2026-04-01T09:00:00Z' },
  // Add 5-10 more
];
```

### Step 4: Build the `/dashboard` page

This is the hero page. It must be visually stunning — this is what the user shows recruiters.

**Follow the exact layout from PRD Section 6.3.** In order from top to bottom:

1. **Top bar** with "Lane" wordmark (left), search bar with Cmd-K shortcut (right), and a small avatar/menu
2. **Alert bar** (conditional) — shows only if there are unread emails or overdue followups
3. **Hero stats row** — five stats in a horizontal strip, each in its own card:
   - Total applied
   - Active pipeline
   - Response rate (as percentage)
   - Avg days to first response
   - Offers received
4. **Pipeline Kanban** — horizontal row of 5 columns (Saved, Applied, Phone Screen, Interview, Offer), each showing recent application cards. Cards show company name, role, days since last update, and source icon. Negative outcomes (Rejected, Withdrew, Ghosted) are NOT shown here — they're in the full table.
5. **Company replies section** — unread email matches with accept/dismiss buttons for status suggestions
6. **Needs followup section** — overdue followups with done/snooze actions
7. **Recent activity timeline** — last 10 status changes and email detections

**Design requirements:**
- Use the exact color tokens from PRD Section 6.2
- Status pills use the exact colors from the status color table
- Cards have 12px border-radius, 1px border in `--border` color
- The overall feel should be warm and calm — cream backgrounds, soft shadows, no harsh whites or blacks except for primary text and buttons
- Mobile responsive: stats become 2x2 grid, pipeline becomes vertical accordion
- Add smooth transitions (200ms ease-out) on hover states and card interactions

### Step 5: Build `/applications` page

Full table view of all applications. Follow PRD Section 6.4.

- Sortable columns: Company, Role, Status, Source, Applied date, Last update, Followup, Emails count
- Filter bar at top: status multi-select chips (with counts), source filter, search input
- "+" button for manual application entry (opens a modal with fields: Company, Role, Location, URL, Status, Resume version, Notes, Applied date)
- Click any row to navigate to `/applications/[id]`
- Mobile: render as cards instead of table

### Step 6: Build `/applications/[id]` detail page

Follow PRD Section 6.5. The most information-dense page.

- Sticky header: Company + Role (large), status pill (clickable to change), location, source
- Timeline view combining activity log entries and email matches in chronological order — this is the centerpiece
- Job description section (collapsible, shows full captured text)
- Notes section (large textarea, autosaves on blur with "Saved" toast)
- Screenshot section (if available — expandable image)
- Sidebar (desktop) / footer (mobile): key dates, resume version, salary range, followup, delete button

### Step 7: Build `/settings` page

Follow PRD Section 6.6.

- Resume versions: list, upload new (PDF), set default, delete
- Followup defaults: interval in days, auto-ghost threshold
- Gmail connection status (placeholder for now — will wire up in Phase 3)
- Account: email display, log out, delete all data

### Step 8: Wire up real Supabase queries

Replace all fake data with real Supabase queries. For each page:
- `/dashboard`: aggregate queries for stats, recent applications per status, unread emails, overdue followups, recent activity
- `/applications`: paginated query with filters and sorting
- `/applications/[id]`: single application with joined activity log and email matches
- `/settings`: CRUD for resume versions

Add proper loading states (skeleton screens matching the layout) and empty states (friendly messages with calls to action like "No applications yet — install the Chrome extension to start tracking").

### Step 9: Deploy

- Deploy to Vercel
- Connect custom domain if available, otherwise use the Vercel subdomain
- Verify all pages work on mobile

---

## Design principles to follow throughout

1. **Warm, not clinical.** The background is cream (`#fafaf7`), not pure white. Borders are soft (`#ebe6db`), not gray. The app should feel like a well-designed notebook, not a corporate dashboard.

2. **Information density done right.** The dashboard shows a lot of data but never feels cluttered. Use whitespace generously. Cards breathe. Stats are large and scannable. The user should be able to glance at the dashboard for 3 seconds and know: how many active applications, any company replies, any overdue followups.

3. **Status colors are the primary visual language.** The warm amber of "Applied", the calm sage of "Interview", the soft rose of "Rejected" — these colors should be the thing the user's eye is drawn to first on any screen. They tell the story without reading text.

4. **Mobile is not an afterthought.** Many users will check this on their phone between classes or on the commute. The pipeline view must work as a vertical accordion on mobile. Cards must be tappable. The followup section must be easy to act on with one thumb.

5. **Speed over features.** If something takes longer than 1.5 seconds to load, it's broken. Use optimistic UI updates (show the change immediately, sync in background). Skeleton screens during data fetches.

6. **No AI features.** The status suggestions from Gmail are keyword-based pattern matching, not AI. The app doesn't generate cover letters, rewrite resumes, or use any LLM. The value is in the tracking and surfacing, not in generation.

---

## After this phase

Once the dashboard is working and deployed, we will build:
- **Phase 2:** The Chrome extension (job page detection, one-click capture, popup UI)
- **Phase 3:** Gmail integration (OAuth, email scanning, company matching, status suggestions)
- **Phase 4:** Polish, empty states, error handling, Chrome Web Store submission

Do not build anything from Phases 2-4 in this phase. Focus entirely on making the dashboard beautiful and functional with manual data entry and the ability to add applications through the UI.

---

**Start building. Begin with Step 1 (project scaffold and Supabase setup), then move through each step in order. Show me the result after each step before moving to the next.**
