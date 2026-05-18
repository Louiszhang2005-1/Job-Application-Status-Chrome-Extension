# Lane — Job Application Tracker Chrome Extension

A Chrome extension for tracking internship and job applications across recruitment cycles. Built for high-volume applicants who want real stats, not spreadsheets.

---

## Features

- **Cycle-based tracking** — organize applications by recruitment cycle (Summer 2025, Winter 2026, Summer 2026, etc.)
- **Gmail sync** — automatically pulls application and rejection emails from Gmail labels into the tracker
- **Pipeline Sankey chart** — visual flow from applications → interviews → offers / no offer / withdrawn
- **Outcome dashboard** — locked stats for completed cycles (total applications, interview rate, offer rate, no offer)
- **CSV export / import** — full data portability; export any cycle as CSV
- **Manual outcome logging** — add interviews and offers that Gmail missed
- **Status tracking** — Saved · Applied · Phone Screen · Interview · Offer · Rejected · Withdrew · Ghosted

---

## Stats (as of Summer 2026)

| Cycle | Applications | Interviews | Offers | Withdrawn | No Offer |
|---|---|---|---|---|---|
| Summer 2025 | 383 | 7 | 1 | 1 | 5 |
| Winter 2026 | 351 | 18 | 4 | 9 | 5 |
| Summer 2026 | 312 | 4 | 1 | 0 | 3 |
| **All cycles** | **1,046** | **29** | **6** | **10** | **13** |

---

## Tech stack

- **React** + **TypeScript** (Vite build)
- **Recharts** for pipeline charts
- **Chrome Extensions Manifest V3**
- `chrome.storage.local` for persistence
- Gmail OAuth via `chrome.identity`

---

## Project structure

```
lane-extension/
├── src/
│   ├── dashboard/      # Main dashboard UI (App.tsx)
│   ├── popup/          # Extension popup
│   ├── background/     # Service worker
│   ├── content/        # Page detector
│   └── lib/            # Storage, Gmail sync, types, seed data
├── dist/               # Built extension (load this in Chrome)
└── vite.config.ts
```

---

## Installation (dev)

```bash
cd lane-extension
npm install
npm run build
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `lane-extension/dist`

---

## Gmail setup

1. Create a Gmail label root (default: `Internships applications`)
2. Create sub-labels per cycle: `Internships applications/Summer 2026/Applications`, `/Rejections`
3. In the extension dashboard → Gmail Sync panel → Connect Gmail → Sync

Interviews and offers are **manual-only** — Gmail sync covers applications and rejections only.

---

## Data safety

- Export CSVs regularly via the **Export CSV** button in the dashboard
- CSVs and personal data files are gitignored — never committed
- Locked cycle stats are hardcoded in `TRUSTED_CYCLE_OUTCOMES` in `App.tsx` and survive storage resets
