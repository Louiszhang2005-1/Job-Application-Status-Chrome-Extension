import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Application, ApplicationStatus, GmailAuthDiagnostics, GmailSyncResult, GmailSyncSettings } from '../lib/types';
import type { CycleLayout, CycleSyncState, ManualOutcome, ManualOutcomeType } from '../lib/storage';
import { addManualOutcome, clearCycleSync, exportApplicationsToCSV, getApplications, getCycleLayout, getCycleSyncState, getGmailSettings, getManualOutcomes, importFromCSV, padCycleApplied, removeManualOutcome, saveCycleLayout, saveGmailSettings, seedKnownApplications, updateApplication } from '../lib/storage';
import { connectGmail, disconnectGmail, getGmailAuthDiagnostics, syncGmail } from '../lib/gmail';
import { SUMMER_2025_KNOWN, SUMMER_2026_KNOWN, WINTER_2026_KNOWN } from '../lib/winter2026Seed';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STATUS_META: Record<ApplicationStatus, { label: string; color: string; soft: string }> = {
  saved: { label: 'Saved', color: '#64748b', soft: '#eef2f7' },
  applied: { label: 'Applied', color: '#f59e0b', soft: '#fff3d6' },
  phone_screen: { label: 'Phone Screen', color: '#8b5cf6', soft: '#f0e9ff' },
  interview: { label: 'Interview', color: '#2563eb', soft: '#dbeafe' },
  offer: { label: 'Offer', color: '#16a34a', soft: '#dcfce7' },
  rejected: { label: 'Rejected', color: '#e11d48', soft: '#ffe4e6' },
  withdrew: { label: 'Withdrew', color: '#78716c', soft: '#f5f5f4' },
  ghosted: { label: 'Ghosted', color: '#475569', soft: '#e2e8f0' },
};

const STATUSES = Object.keys(STATUS_META) as ApplicationStatus[];
const PIPELINE: ApplicationStatus[] = ['applied', 'phone_screen', 'interview', 'offer', 'rejected'];
const SEASON_ORDER: Record<string, number> = { Fall: 4, Autumn: 4, Summer: 3, Spring: 2, Winter: 1 };

type OutcomeCompany = { company: string; count: number };
type TrustedOutcomeData = {
  applications?: number;
  interviewTotal: number;
  offerTotal: number;
  interviewCompanies: OutcomeCompany[];
  offerCompanies: OutcomeCompany[];
  withdrawnTotal?: number;
  withdrawnCompanies?: OutcomeCompany[];
};

const TRUSTED_CYCLE_OUTCOMES: Record<string, TrustedOutcomeData> = {
  'Summer 2025': {
    applications: 383,
    interviewTotal: 6,
    offerTotal: 1,
    interviewCompanies: toCompanyCounts([
      'Ville de Montréal',
      'ABB',
      'ArcelorMittal Produits Longs Canada',
      'Lelièvre, Lelièvre et Lemoignan Ltée',
      'Vantage Canada Marketing',
      'Pratt & Whitney',
    ]),
    offerCompanies: toCompanyCounts(['Ville de Montréal']),
    withdrawnTotal: 1,
    withdrawnCompanies: toCompanyCounts(['Collineo']),
  },
  'Summer 2026': {
    interviewTotal: 4,
    offerTotal: 1,
    interviewCompanies: toCompanyCounts([
      'Tesla',
      'Tesla',
      'Hylight (YC S23)',
      'Reditus Space (YC W25)',
    ]),
    offerCompanies: toCompanyCounts(['Tesla']),
  },
  'Winter 2026': {
    // User attended 9 interviews (9 others were withdrawn by user).
    interviewTotal: 9,
    offerTotal: 4,
    // Only include the companies for the interviews actually attended (first 9 entries).
    interviewCompanies: toCompanyCounts([
      'Pratt & Whitney',
      'Pratt & Whitney',
      'Cascades',
      'Airbus',
      'Airbus',
      'Lockheed Martin',
      'Airbus',
      'Airbus',
      'Evident Canada (Olympus NDT)',
    ]),
    offerCompanies: toCompanyCounts([
      'Pratt & Whitney',
      'Cascades',
      'Lockheed Martin',
      'Airbus',
    ]),
    // Withdrawn interviews (user withdrew / declined interview requests)
    withdrawnTotal: 9,
    withdrawnCompanies: toCompanyCounts([
      'Airbus',
      'Airbus',
      'Airbus',
      'Airbus',
      'Airbus',
      'Bombardier',
      'Metaltech-Omega',
      'De Havilland',
      'GF Vernova',
    ]),
  },
};

TRUSTED_CYCLE_OUTCOMES['Summer 2025'] = {
  applications: 383,
  interviewTotal: 6,
  offerTotal: 1,
  interviewCompanies: toCompanyCounts([
    'Ville de Montréal',
    'ABB',
    'ArcelorMittal Produits Longs Canada',
    'Lelièvre, Lelièvre et Lemoignan Ltée',
    'Vantage Canada Marketing',
    'Pratt & Whitney',
  ]),
  offerCompanies: toCompanyCounts(['Ville de Montréal']),
  withdrawnTotal: 1,
  withdrawnCompanies: toCompanyCounts(['Collineo']),
};

function injectStyles() {
  if (document.getElementById('lane-dashboard-styles')) return;
  const style = document.createElement('style');
  style.id = 'lane-dashboard-styles';
  style.textContent = `
    * { box-sizing: border-box; }
    html, body { margin: 0; background: #d6eef6; color: #0f172a; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    button, input, select { font: inherit; }
    button { cursor: pointer; }
    .lane-shell { min-height: 100vh; background: linear-gradient(180deg, #f8fbff 0, #eaf7fb 38%, #c8e8f2 100%); }
    .lane-frame { display: grid; grid-template-columns: 236px minmax(0, 1fr); gap: 18px; max-width: 1440px; margin: 0 auto; padding: 18px; }
    .lane-sidebar { background: rgba(255,255,255,.78); border: 1px solid rgba(15,23,42,.08); border-radius: 24px; padding: 18px; min-height: calc(100vh - 36px); box-shadow: 0 24px 70px rgba(15,23,42,.08); position: sticky; top: 18px; }
    .lane-main { min-width: 0; }
    .lane-topbar { height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
    .lane-card { background: rgba(255,255,255,.88); border: 1px solid rgba(15,23,42,.08); border-radius: 22px; box-shadow: 0 18px 50px rgba(15,23,42,.08); }
    .lane-panel { background: #ffffff; border: 1px solid rgba(15,23,42,.08); border-radius: 18px; }
    .lane-kicker { color: #64748b; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .lane-btn { border: 0; border-radius: 999px; padding: 10px 15px; font-weight: 800; background: #07091f; color: white; }
    .lane-btn.secondary { background: #eef6fb; color: #0f172a; border: 1px solid rgba(15,23,42,.08); }
    .lane-icon-btn { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 999px; border: 1px solid rgba(15,23,42,.08); background: #fff; color: #0f172a; }
    .lane-input { min-height: 38px; border: 1px solid rgba(15,23,42,.12); border-radius: 12px; padding: 0 12px; background: #fff; color: #0f172a; outline: none; }
    .lane-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
    .lane-table { width: 100%; border-collapse: collapse; }
    .lane-table th { color: #64748b; font-size: 11px; letter-spacing: .07em; text-transform: uppercase; text-align: left; padding: 13px 16px; background: #f8fafc; white-space: nowrap; }
    .lane-table td { padding: 14px 16px; border-top: 1px solid #eef2f7; font-size: 13px; vertical-align: middle; }
    .lane-table tr:hover td { background: #f8fbff; }
    .lane-dashboard-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(340px, .7fr); gap: 14px; margin-bottom: 14px; align-items: start; }
    @media (max-width: 980px) { .lane-frame { grid-template-columns: 1fr; } .lane-sidebar { min-height: auto; position: static; } .lane-dashboard-grid { grid-template-columns: 1fr; } }
  `;
  document.head.appendChild(style);
}

function pct(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function fmtDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function cycleSortScore(cycle: string): number {
  if (cycle === 'Unassigned') return -1;
  const match = cycle.match(/^(Spring|Summer|Fall|Autumn|Winter)\s+(20\d{2})$/i);
  if (!match) return 0;
  const season = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
  return Number(match[2]) * 10 + (SEASON_ORDER[season] ?? 0);
}

function sortCycles(cycles: string[]): string[] {
  return [...cycles].sort((a, b) => {
    const scoreDiff = cycleSortScore(b) - cycleSortScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return a.localeCompare(b);
  });
}

function cleanCycleName(cycle: string): string {
  return cycle.replace(/\s+/g, ' ').trim();
}

function cycleKey(cycle: string): string {
  return cleanCycleName(cycle).toLowerCase();
}

function uniqueCycles(cycles: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  cycles.forEach((cycle) => {
    const clean = cleanCycleName(cycle);
    const key = cycleKey(clean);
    if (!clean || seen.has(key)) return;
    seen.add(key);
    result.push(clean);
  });
  return result;
}

function applyCycleOrder(cycles: string[], order: string[]): string[] {
  const unique = uniqueCycles(cycles);
  const byKey = new Map(unique.map((cycle) => [cycleKey(cycle), cycle]));
  const ordered = uniqueCycles(order)
    .map((cycle) => byKey.get(cycleKey(cycle)))
    .filter((cycle): cycle is string => !!cycle && cycle !== 'Unassigned');
  const orderedKeys = new Set(ordered.map(cycleKey));
  const unplaced = unique
    .filter((cycle) => cycle !== 'Unassigned' && !orderedKeys.has(cycleKey(cycle)));
  const hasUnassigned = unique.includes('Unassigned');
  return [
    ...ordered,
    ...sortCycles(unplaced),
    ...(hasUnassigned ? ['Unassigned'] : []),
  ];
}

function toCompanyCounts(companies: string[]): OutcomeCompany[] {
  const counts = new Map<string, number>();
  companies.forEach((company) => counts.set(company, (counts.get(company) ?? 0) + 1));
  return Array.from(counts.entries())
    .map(([company, count]) => ({ company, count }))
    .sort((a, b) => a.company.localeCompare(b.company));
}

function mergeManualOutcomes(base: TrustedOutcomeData, cycle: string, manualOutcomes: ManualOutcome[]): TrustedOutcomeData {
  const cycleManual = manualOutcomes.filter((outcome) => outcome.cycle === cycle);
  if (cycleManual.length === 0) return base;
  const baseInterview = base.interviewCompanies ?? [];
  const baseOffer = base.offerCompanies ?? [];
  const baseWithdrawn = base.withdrawnCompanies ?? [];

  const interviewCompanies = [
    ...baseInterview.flatMap((item) => Array.from({ length: item.count }, () => item.company)),
    ...cycleManual.filter((outcome) => outcome.type === 'interview').map((outcome) => outcome.company),
    ...cycleManual.filter((outcome) => outcome.type === 'offer').map((outcome) => outcome.company),
  ];

  const offerCompanies = [
    ...baseOffer.flatMap((item) => Array.from({ length: item.count }, () => item.company)),
    ...cycleManual.filter((outcome) => outcome.type === 'offer').map((outcome) => outcome.company),
  ];

  const withdrawnCompanies = [
    ...baseWithdrawn.flatMap((item) => Array.from({ length: item.count }, () => item.company)),
    ...cycleManual.filter((outcome) => (outcome as any).type === 'withdrew').map((outcome) => outcome.company),
  ];

  return {
    interviewTotal: interviewCompanies.length,
    offerTotal: offerCompanies.length,
    withdrawnTotal: withdrawnCompanies.length,
    applications: base.applications,
    interviewCompanies: toCompanyCounts(interviewCompanies),
    offerCompanies: toCompanyCounts(offerCompanies),
    withdrawnCompanies: toCompanyCounts(withdrawnCompanies),
  };
}

function trustedOutcomeData(cycle: string, apps: Application[], manualOutcomes: ManualOutcome[]): TrustedOutcomeData {
  const trusted = TRUSTED_CYCLE_OUTCOMES[cycle];
  if (trusted) return mergeManualOutcomes(trusted, cycle, manualOutcomes);

  const interviewCompanies = apps
    .filter((app) => ['phone_screen', 'interview', 'offer'].includes(app.status))
    .map((app) => app.company);
  const offerCompanies = apps
    .filter((app) => app.status === 'offer')
    .map((app) => app.company);
  const withdrawnCompanies = apps
    .filter((app) => app.status === 'withdrew')
    .map((app) => app.company);
  return mergeManualOutcomes({
    interviewTotal: interviewCompanies.length,
    offerTotal: offerCompanies.length,
    withdrawnTotal: withdrawnCompanies.length,
    applications: apps.length,
    interviewCompanies: toCompanyCounts(interviewCompanies),
    offerCompanies: toCompanyCounts(offerCompanies),
    withdrawnCompanies: toCompanyCounts(withdrawnCompanies),
  }, cycle, manualOutcomes);
}

function outcomeDataForView(cycle: string, apps: Application[], manualOutcomes: ManualOutcome[]): TrustedOutcomeData {
  if (cycle !== 'all') return trustedOutcomeData(cycle, apps, manualOutcomes);

  const cycles = new Set<string>();
  apps.forEach((app) => cycles.add(app.recruitment_cycle ?? 'Unassigned'));
  manualOutcomes.forEach((outcome) => cycles.add(outcome.cycle));

  let interviewTotal = 0;
  let offerTotal = 0;
  let withdrawnTotal = 0;
  let applications = 0;
  const interviewCompanies: string[] = [];
  const offerCompanies: string[] = [];
  const withdrawnCompanies: string[] = [];
  cycles.forEach((entryCycle) => {
    const cycleApps = apps.filter((app) => (app.recruitment_cycle ?? 'Unassigned') === entryCycle);
    const data = trustedOutcomeData(entryCycle, cycleApps, manualOutcomes);
    interviewTotal += data.interviewTotal;
    offerTotal += data.offerTotal;
    withdrawnTotal += data.withdrawnTotal ?? 0;
    applications += data.applications ?? cycleApps.length;
    data.interviewCompanies.forEach((item) => interviewCompanies.push(...Array.from({ length: item.count }, () => item.company)));
    data.offerCompanies.forEach((item) => offerCompanies.push(...Array.from({ length: item.count }, () => item.company)));
    (data.withdrawnCompanies ?? []).forEach((item) => withdrawnCompanies.push(...Array.from({ length: item.count }, () => item.company)));
  });

  return {
    applications,
    interviewTotal,
    offerTotal,
    withdrawnTotal,
    interviewCompanies: toCompanyCounts(interviewCompanies),
    offerCompanies: toCompanyCounts(offerCompanies),
    withdrawnCompanies: toCompanyCounts(withdrawnCompanies),
  };
}

function LabelChips({ label, values, color }: { label: string; values: string[]; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'start', flexWrap: 'wrap', fontSize: 12, color: '#64748b' }}>
      <strong style={{ color: '#334155', minWidth: 92 }}>{label}</strong>
      {values.length === 0 ? (
        <span>-</span>
      ) : values.map((value) => (
        <span
          key={value}
          style={{
            maxWidth: 260,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            borderRadius: 999,
            padding: '4px 8px',
            background: `${color}14`,
            color,
            fontWeight: 800,
          }}
          title={value}
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: ApplicationStatus }) {
  const meta = STATUS_META[status];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      borderRadius: 999,
      padding: '5px 9px',
      fontSize: 11,
      fontWeight: 800,
      color: meta.color,
      background: meta.soft,
      whiteSpace: 'nowrap',
    }}>
      {meta.label}
    </span>
  );
}

function StatCard({ title, value, detail, color }: { title: string; value: string | number; detail: string; color: string }) {
  return (
    <div className="lane-card" style={{ padding: 18, minHeight: 126, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="lane-kicker">{title}</div>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: color, boxShadow: `0 0 0 6px ${color}1f` }} />
      </div>
      <div>
        <div style={{ fontSize: 38, lineHeight: 1, fontWeight: 900, letterSpacing: '-.03em' }}>{value}</div>
        <div style={{ color: '#64748b', fontSize: 12, marginTop: 7 }}>{detail}</div>
      </div>
    </div>
  );
}

function EditModal({
  app,
  cycleOptions,
  onSave,
  onClose,
}: {
  app: Application;
  cycleOptions: string[];
  onSave: (updates: Partial<Application>) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Application>({ ...app });

  function set<K extends keyof Application>(key: K, value: Application[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function Label({ children }: { children: string }) {
    return <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em' }}>{children}</span>;
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="lane-card" style={{ width: 540, maxHeight: '92vh', overflow: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 20 }}>
          <div>
            <div className="lane-kicker">Edit Application</div>
            <h2 style={{ margin: '4px 0 0', fontSize: 18, letterSpacing: '-.03em' }}>{app.company}</h2>
          </div>
          <button className="lane-icon-btn" onClick={onClose} style={{ fontSize: 16, flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'grid', gap: 5 }}>
              <Label>Company</Label>
              <input className="lane-input" value={draft.company} onChange={(e) => set('company', e.target.value)} />
            </label>
            <label style={{ display: 'grid', gap: 5 }}>
              <Label>Status</Label>
              <select className="lane-input" value={draft.status} onChange={(e) => set('status', e.target.value as ApplicationStatus)}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
            </label>
          </div>

          <label style={{ display: 'grid', gap: 5 }}>
            <Label>Role</Label>
            <input className="lane-input" value={draft.role} onChange={(e) => set('role', e.target.value)} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'grid', gap: 5 }}>
              <Label>Location</Label>
              <input className="lane-input" value={draft.location ?? ''} onChange={(e) => set('location', e.target.value || null)} />
            </label>
            <label style={{ display: 'grid', gap: 5 }}>
              <Label>Applied at</Label>
              <input
                className="lane-input"
                type="date"
                value={draft.applied_at ? draft.applied_at.slice(0, 10) : ''}
                onChange={(e) => set('applied_at', e.target.value ? new Date(e.target.value + 'T12:00:00.000Z').toISOString() : null)}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'grid', gap: 5 }}>
              <Label>Recruitment cycle</Label>
              <input
                className="lane-input"
                list="edit-cycle-options"
                value={draft.recruitment_cycle ?? ''}
                onChange={(e) => set('recruitment_cycle', e.target.value || null)}
              />
              <datalist id="edit-cycle-options">
                {cycleOptions.map((c) => <option key={c} value={c} />)}
              </datalist>
            </label>
            <label style={{ display: 'grid', gap: 5 }}>
              <Label>Resume version</Label>
              <input className="lane-input" value={draft.resume_version ?? ''} onChange={(e) => set('resume_version', e.target.value || null)} />
            </label>
          </div>

          <label style={{ display: 'grid', gap: 5 }}>
            <Label>Job URL</Label>
            <input className="lane-input" type="url" value={draft.job_url ?? ''} onChange={(e) => set('job_url', e.target.value)} />
          </label>

          <label style={{ display: 'grid', gap: 5 }}>
            <Label>Notes</Label>
            <textarea
              className="lane-input"
              value={draft.notes ?? ''}
              rows={3}
              style={{ resize: 'vertical', padding: '8px 12px', lineHeight: 1.5 }}
              onChange={(e) => set('notes', e.target.value)}
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="lane-btn secondary" onClick={onClose}>Cancel</button>
          <button className="lane-btn" onClick={() => onSave(draft)}>Save changes</button>
        </div>
      </div>
    </div>
  );
}

type BucketNode = { id: string; label: string; color: string; count: number; y: number; height: number };
type Col3Node = { label: string; count: number; color: string; sourceId: string; y: number; height: number };

function PipelineSankey({ apps, trustedOutcomes }: { apps: Application[]; trustedOutcomes: TrustedOutcomeData }) {
  const submitted = apps.filter((a) => !['saved', 'withdrew', 'ghosted'].includes(a.status));
  if (submitted.length < 3) return null;

  const SVG_H = 460;
  const NW = 14;
  const GAP = 8;
  const LPad = 150;
  const c1x = LPad;
  const c2x = LPad + 198;
  const c3x = LPad + 415;
  const VW = c3x + NW + 224;

  const interviewTotal = trustedOutcomes.interviewTotal;
  const offerTotal = trustedOutcomes.offerTotal;
  const withdrawnTotal = trustedOutcomes.withdrawnTotal ?? submitted.filter((a) => a.status === 'withdrew').length;
  const appliedTotal = submitted.filter((a) => a.status === 'applied').length;
  const rejectedTotal = submitted.filter((a) => a.status === 'rejected').length;

  const totalCount = trustedOutcomes.applications ?? submitted.length;
  const displayedInterviews = interviewTotal + (withdrawnTotal ?? 0);

  const summaryCards = [
    { label: 'Applications', value: totalCount, color: '#1e3a8a' },
    { label: 'Applied', value: appliedTotal, color: '#f59e0b' },
    { label: 'Rejected', value: rejectedTotal, color: '#e11d48' },
    { label: 'Withdrawn interviews', value: withdrawnTotal, color: '#78716c' },
    { label: 'Interviews', value: interviewTotal + (withdrawnTotal ?? 0), color: '#2563eb' },
    { label: 'Offers', value: offerTotal, color: '#16a34a' },
  ];

  const renderOutcomeList = (title: string, items: OutcomeCompany[], color: string) => (
    <div>
      <div style={{ fontSize: 12, fontWeight: 900, color: '#334155', marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {items.length === 0 ? (
          <span style={{ color: '#94a3b8', fontSize: 13 }}>-</span>
        ) : items.map((item) => (
          <span
            key={`${title}-${item.company}`}
            style={{
              borderRadius: 999,
              padding: '6px 10px',
              background: `${color}14`,
              color,
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            {item.company}{item.count > 1 ? ` (${item.count})` : ''}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div className="lane-card" style={{ padding: 20, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 18 }}>
        <div>
          <div className="lane-kicker">Pipeline Flow</div>
          <h2 style={{ margin: '6px 0 0', fontSize: 20, letterSpacing: '-.03em' }}>Cycle outcomes</h2>
        </div>
        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 800 }}>
          {displayedInterviews} interview{displayedInterviews !== 1 ? 's' : ''} - {offerTotal} offer{offerTotal !== 1 ? 's' : ''}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(100px, 1fr))', gap: 10, marginBottom: 18 }}>
        {summaryCards.map((card) => (
          <div key={card.label} style={{ border: '1px solid #eef2f7', borderRadius: 14, padding: 12, background: '#f8fafc' }}>
            <div style={{ width: 10, height: 10, borderRadius: 999, background: card.color, marginBottom: 10 }} />
            <div style={{ fontSize: 22, fontWeight: 950, color: '#0f172a' }}>{card.value}</div>
            <div style={{ color: '#64748b', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>{card.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {renderOutcomeList('Interviewed at', trustedOutcomes.interviewCompanies, '#2563eb')}
        {renderOutcomeList('Offered by', trustedOutcomes.offerCompanies, '#16a34a')}
      </div>
    </div>
  );

  const rawBuckets: Array<{ id: string; label: string; color: string; count: number }> = [
    { id: 'rejected', label: 'Rejected', color: '#e11d48', count: submitted.filter((a) => a.status === 'rejected').length },
    // combine withdrawn into the interview node so withdrawn visually branches off from interviews
    { id: 'interview', label: 'Interview', color: '#2563eb', count: interviewTotal + (withdrawnTotal ?? 0) },
    { id: 'offer', label: 'Offer', color: '#16a34a', count: offerTotal },
    { id: 'applied', label: 'Applied', color: '#f59e0b', count: submitted.filter((a) => a.status === 'applied').length },
  ].filter((b) => b.count > 0);

  const interviewItems = trustedOutcomes.interviewCompanies
    .map(({ company, count }) => ({ label: company, count }))
    .map((n) => ({ ...n, color: '#2563eb', sourceId: 'interview' }));
  const offerItems = trustedOutcomes.offerCompanies
    .map(({ company, count }) => ({ label: company, count }))
    .map((n) => ({ ...n, color: '#16a34a', sourceId: 'offer' }));
  const col3Raw = [
    // aggregated withdrawn node so it visually branches off from the interview source
    ...(withdrawnTotal ? [{ label: 'Withdrawn interviews', count: withdrawnTotal, color: '#78716c', sourceId: 'interview' }] : []),
    ...interviewItems,
    ...offerItems,
  ];

  // Layout col2
  const col2TotalH = SVG_H * 0.88;
  const col2OffY = (SVG_H - col2TotalH) / 2;
  const col2TotalGap = GAP * Math.max(0, rawBuckets.length - 1);
  const col2Scale = col2TotalH > col2TotalGap ? (col2TotalH - col2TotalGap) / totalCount : 1;
  let col2Y = col2OffY;
  const col2Laid: BucketNode[] = rawBuckets.map((b) => {
    const height = Math.max(b.count * col2Scale, 6);
    const node: BucketNode = { ...b, y: col2Y, height };
    col2Y += height + GAP;
    return node;
  });
  const col1Y = col2OffY;
  const col1H = col2Laid[col2Laid.length - 1].y + col2Laid[col2Laid.length - 1].height - col2OffY;

  // Col3 heights derived from col2 source node
  // compute heights for col3 items relative to their source node; interview-sourced items
  // should use the interview node total that includes withdrawn so the branch lines match.
  const interviewSourceTotal = interviewTotal + (withdrawnTotal ?? 0);
  const col3WithH = col3Raw.map((n) => {
    const src = col2Laid.find((c) => c.id === n.sourceId);
    const srcTotal = n.sourceId === 'interview' ? interviewSourceTotal : offerTotal;
    const height = Math.max(((n.count / Math.max(srcTotal, 1)) * (src?.height ?? 40)), 6);
    return { ...n, height };
  });
  const col3TotalH = col3WithH.reduce((s, n) => s + n.height, 0) + GAP * Math.max(0, col3WithH.length - 1);
  let col3Y = Math.max(0, (SVG_H - col3TotalH) / 2);
  const col3Laid: Col3Node[] = col3WithH.map((n) => {
    const node: Col3Node = { ...n, y: col3Y };
    col3Y += n.height + GAP;
    return node;
  });

  // Links col1 → col2
  let src12Off = 0;
  const links12 = col2Laid.map((n) => {
    const sh = (n.count / totalCount) * col1H;
    const link = { sy: col1Y + src12Off, ty: n.y, sh, th: n.height, color: n.color };
    src12Off += sh;
    return link;
  });

  // Links col2 → col3
  const c2off: Record<string, number> = {};
  const links23 = col3Laid.map((n) => {
    const src = col2Laid.find((c) => c.id === n.sourceId);
    if (!src) return null;
    c2off[n.sourceId] = c2off[n.sourceId] ?? 0;
    const link = { sy: src.y + c2off[n.sourceId], ty: n.y, sh: n.height, th: n.height, color: n.color };
    c2off[n.sourceId] += n.height;
    return link;
  });

  function ribbon(x0: number, x1: number, sy: number, ty: number, sh: number, th: number) {
    const cx = (x0 + x1) / 2;
    return `M ${x0} ${sy} C ${cx} ${sy} ${cx} ${ty} ${x1} ${ty} L ${x1} ${ty + th} C ${cx} ${ty + th} ${cx} ${sy + sh} ${x0} ${sy + sh} Z`;
  }

  function trunc(s: string, max = 30) {
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  return (
    <div className="lane-card" style={{ padding: 20, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
        <div>
          <div className="lane-kicker">Pipeline Flow</div>
          <h2 style={{ margin: '6px 0 0', fontSize: 20, letterSpacing: '-.03em' }}>Application Sankey</h2>
        </div>
        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>
          {displayedInterviews} interview{displayedInterviews !== 1 ? 's' : ''} · {offerTotal} offer{offerTotal !== 1 ? 's' : ''}
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${VW} ${SVG_H}`} style={{ display: 'block', overflow: 'visible' }}>
        {links12.map((l, i) => (
          <path key={`l12-${i}`} d={ribbon(c1x + NW, c2x, l.sy, l.ty, l.sh, l.th)} fill={l.color} opacity={0.28} />
        ))}
        {links23.map((l, i) => l && (
          <path key={`l23-${i}`} d={ribbon(c2x + NW, c3x, l.sy, l.ty, l.sh, l.th)} fill={l.color} opacity={0.28} />
        ))}

        {/* Col 1 */}
        <rect x={c1x} y={col1Y} width={NW} height={col1H} fill="#1e3a8a" rx={3} />
        <text x={c1x - 8} y={col1Y + col1H / 2 - 8} textAnchor="end" dominantBaseline="middle" fontSize={12} fontWeight={700} fill="#1e293b">All Applications</text>
        <text x={c1x - 8} y={col1Y + col1H / 2 + 8} textAnchor="end" dominantBaseline="middle" fontSize={12} fill="#64748b">{totalCount}</text>

        {/* Col 2 */}
        {col2Laid.map((n) => (
          <g key={n.id}>
            <rect x={c2x} y={n.y} width={NW} height={n.height} fill={n.color} rx={3} />
            {n.height >= 18 && <>
              <text x={c2x + NW + 7} y={n.y + n.height / 2 - 7} dominantBaseline="middle" fontSize={12} fontWeight={700} fill={n.color}>{n.label}</text>
              <text x={c2x + NW + 7} y={n.y + n.height / 2 + 9} dominantBaseline="middle" fontSize={11} fill="#64748b">{n.count}</text>
            </>}
          </g>
        ))}

        {/* Col 3 */}
        {(() => {
          const interviewOffset = withdrawnTotal ? 1 : 0;
          return (
            <>
              {interviewItems.length > 0 && (
                <text x={c3x + NW + 7} y={Math.max(12, (col3Laid[interviewOffset]?.y ?? 18) - 10)} dominantBaseline="middle" fontSize={11} fontWeight={800} fill="#1e293b">
                  Interviewed at:
                </text>
              )}
              {offerItems.length > 0 && (
                <text
                  x={c3x + NW + 7}
                  y={Math.max(12, (col3Laid[interviewOffset + interviewItems.length]?.y ?? 18) - 10)}
                  dominantBaseline="middle"
                  fontSize={11}
                  fontWeight={800}
                  fill="#1e293b"
                >
                  Offered by:
                </text>
              )}
            </>
          );
        })()}
        {col3Laid.map((n, i) => (
          <g key={`c3-${i}`}>
            <rect x={c3x} y={n.y} width={NW} height={n.height} fill={n.color} rx={3} />
            <>
              <text x={c3x + NW + 7} y={n.y + n.height / 2 - 6} dominantBaseline="middle" fontSize={11} fontWeight={700} fill={n.color}>{trunc(n.label)}</text>
              <text x={c3x + NW + 7} y={n.y + n.height / 2 + 8} dominantBaseline="middle" fontSize={10} fill="#64748b">
                {n.count} {n.sourceId === 'offer' ? 'offer' : (n.label === 'Withdrawn interviews' ? 'withdrawn' : 'interview')}{n.count > 1 ? 's' : ''}
              </text>
            </>
          </g>
        ))}
      </svg>
    </div>
  );
}

function getOutcomeSummary(apps: Application[], trustedOutcomes: TrustedOutcomeData) {
  const applications = trustedOutcomes.applications ?? apps.length;
  const rejected = apps.filter((app) => app.status === 'rejected').length;
  const interviews = trustedOutcomes.interviewTotal;
  const offers = trustedOutcomes.offerTotal;
  const withdrawn = trustedOutcomes.withdrawnTotal ?? apps.filter((app) => app.status === 'withdrew').length;
  const pending = Math.max(applications - rejected - interviews - withdrawn, 0);
  const noOffer = Math.max(interviews - offers, 0);
  const interviews_with_withdrawn = interviews + (withdrawn ?? 0);
  return { applications, pending, rejected, interviews, offers, noOffer, withdrawn, interviews_with_withdrawn };
}

function OutcomeDashboardCard({
  apps,
  trustedOutcomes,
  interviewCompanies,
  offerCompanies,
  withdrawnCompanies,
  cycleName,
}: {
  apps: Application[];
  trustedOutcomes: TrustedOutcomeData;
  interviewCompanies: string[];
  offerCompanies: string[];
  withdrawnCompanies?: string[];
  cycleName: string;
}) {
  const summary = getOutcomeSummary(apps, trustedOutcomes);
  const displayedInterviews = summary.interviews_with_withdrawn ?? (summary.interviews + (summary.withdrawn ?? 0));
  const responseProgress = pct(displayedInterviews, Math.max(summary.applications, 1));
  const offerYield = pct(summary.offers, Math.max(summary.interviews, 1));
  const nextFocus = summary.applications === 0
    ? { value: 'Ready to sync', detail: 'Create Gmail folders or import rows to start this cycle.' }
    : summary.pending > 0
      ? { value: `${summary.pending} pending`, detail: 'Follow the applications still waiting for a reply.' }
      : summary.interviews > summary.offers
        ? { value: `${summary.noOffer} no offer`, detail: 'Review interview outcomes and add missing offers manually.' }
        : summary.offers > 0
          ? { value: `${summary.offers} offer${summary.offers === 1 ? '' : 's'}`, detail: 'Offers are logged. Keep the cycle history tidy.' }
          : { value: `${summary.rejected} rejected`, detail: 'No pending applications left in this view.' };
  const cards = [
    { label: 'Applications', value: summary.applications, color: '#1e3a8a', soft: '#dbeafe' },
    { label: 'Ghosted', value: summary.pending, color: '#f59e0b', soft: '#fff7ed' },
    { label: 'Rejected', value: summary.rejected, color: '#e11d48', soft: '#ffe4e6' },
    { label: 'Withdrawn interviews', value: summary.withdrawn, color: '#78716c', soft: '#f5f5f4' },
    { label: 'Interviews', value: displayedInterviews, color: '#2563eb', soft: '#dbeafe' },
    { label: 'Offers', value: summary.offers, color: '#16a34a', soft: '#dcfce7' },
  ];

  return (
    <div className="lane-card" style={{ padding: 20, display: 'grid', gap: 16, alignContent: 'start' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
        <div>
          <div className="lane-kicker">Dashboard</div>
          <h2 style={{ margin: '6px 0 0', fontSize: 20, letterSpacing: '-.03em' }}>Outcome dashboard</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', fontSize: 12, fontWeight: 800 }}>
          <span style={{ borderRadius: 999, padding: '6px 9px', background: '#eef6fb', color: '#2563eb', border: '1px solid #dbeafe' }}>{cycleName}</span>
          <span style={{ color: '#64748b' }}>{displayedInterviews} interviews - {summary.offers} offers</span>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <div className="lane-kicker">Cycle insights</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.25fr) repeat(3, minmax(118px, .6fr))', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #eef2f7', borderRadius: 18, padding: 14, background: 'linear-gradient(135deg, #f8fbff, #eef6ff)' }}>
            <div style={{ width: 46, height: 46, borderRadius: 16, background: '#07091f', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 950, boxShadow: '0 12px 26px rgba(15,23,42,.16)', flexShrink: 0 }}>L</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#64748b', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>Next focus</div>
              <div style={{ marginTop: 4, fontSize: 16, fontWeight: 950, letterSpacing: '-.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nextFocus.value}</div>
              <div style={{ marginTop: 3, color: '#64748b', fontSize: 12, lineHeight: 1.35 }}>{nextFocus.detail}</div>
            </div>
          </div>
          {[
            { label: 'Interview rate', value: `${responseProgress}%`, detail: `${displayedInterviews} of ${summary.applications} reached interview`, color: '#2563eb' },
            { label: 'Offer rate', value: `${offerYield}%`, detail: `${summary.offers} of ${summary.interviews} interviews converted`, color: '#16a34a' },
            { label: 'No offer', value: summary.noOffer, detail: 'Interview paths without an offer', color: '#64748b' },
          ].map((item) => (
            <div key={item.label} style={{ border: '1px solid #eef2f7', borderRadius: 18, padding: 14, background: '#fff', minWidth: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: 999, background: item.color, marginBottom: 12 }} />
              <div style={{ color: '#0f172a', fontSize: 24, lineHeight: 1, fontWeight: 950 }}>{item.value}</div>
              <div style={{ marginTop: 5, color: '#64748b', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>{item.label}</div>
              <div style={{ marginTop: 5, color: '#64748b', fontSize: 11, lineHeight: 1.35 }}>{item.detail}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(92px, 1fr))', gap: 10 }}>
        {cards.map((card) => (
          <div key={card.label} style={{ border: '1px solid #eef2f7', borderRadius: 16, padding: 12, background: card.soft }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12, minHeight: 36 }}>
              <span style={{ color: '#475569', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>{card.label}</span>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: card.color }} />
            </div>
            <div style={{ color: '#0f172a', fontSize: 28, lineHeight: 1, fontWeight: 950, display: 'flex', justifyContent: 'center' }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 10, paddingTop: 2 }}>
        <LabelChips label="Interviewed at:" values={interviewCompanies} color="#2563eb" />
        <LabelChips label="Offered by:" values={offerCompanies} color="#16a34a" />
        <LabelChips label="Withdrawn interviews:" values={withdrawnCompanies ?? []} color="#78716c" />
      </div>
    </div>
  );
}

function BottomPipelineSankey({ apps, trustedOutcomes, cycleName }: { apps: Application[]; trustedOutcomes: TrustedOutcomeData; cycleName: string }) {
  const summary = getOutcomeSummary(apps, trustedOutcomes);
  if (summary.applications < 1) {
    const emptyLegend = [
      { label: 'Applications', value: 0, color: '#1e3a8a' },
      { label: 'Ghosted', value: 0, color: '#f59e0b' },
      { label: 'Rejected', value: 0, color: '#e11d48' },
      { label: 'Interviews', value: 0, color: '#2563eb' },
      { label: 'Offers', value: 0, color: '#16a34a' },
      { label: 'No Offer', value: 0, color: '#94a3b8' },
    ];

    return (
      <div className="lane-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 14 }}>
          <div>
            <div className="lane-kicker">Flow</div>
            <h2 style={{ margin: '6px 0 0', fontSize: 20, letterSpacing: '-.03em' }}>Pipeline Sankey</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', fontSize: 12, fontWeight: 800 }}>
            <span style={{ borderRadius: 999, padding: '6px 9px', background: '#eef6fb', color: '#2563eb', border: '1px solid #dbeafe' }}>{cycleName}</span>
            <span style={{ color: '#64748b' }}>0 interviews - 0 offers</span>
          </div>
        </div>
        <div style={{ minHeight: 210, border: '1px dashed #cbd5e1', borderRadius: 18, background: '#f8fafc', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 20 }}>
          <div>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: '#07091f', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 950, margin: '0 auto 12px' }}>L</div>
            <div style={{ fontSize: 18, fontWeight: 950, letterSpacing: '-.03em' }}>Ready to sync this cycle</div>
            <div style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>Gmail applications and rejections will form the Sankey once this cycle has rows.</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(96px, 1fr))', gap: 10, marginTop: 12 }}>
          {emptyLegend.map((item) => (
            <div key={`empty-sankey-summary-${item.label}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: '1px solid #eef2f7', borderRadius: 14, padding: '9px 10px', background: '#f8fafc' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#334155', fontSize: 11, fontWeight: 900 }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: item.color }} />
                {item.label}
              </span>
              <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 950 }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const width = 980;
  const height = 460;
  const nodeW = 16;
  const sourceX = 96;
  const middleX = 455;
  const rightX = 770;
  const stageTop = 60;
  const stageH = 320;
  const gap = 18;
  // Make the interviews node include withdrawn, and have withdrawn branch off from interviews
  const middleRaw = [
    { key: 'interviews', label: 'Interviews', value: summary.interviews_with_withdrawn ?? (summary.interviews + (summary.withdrawn ?? 0)), color: '#2563eb' },
    { key: 'rejected', label: 'Rejected', value: summary.rejected, color: '#e11d48' },
    { key: 'pending', label: 'Ghosted', value: summary.pending, color: '#f59e0b' },
  ].filter((stage) => stage.value > 0);
  const rightRaw = [
    { key: 'offers', label: 'Offers', value: summary.offers, color: '#16a34a' },
    { key: 'no-offer', label: 'No Offer', value: summary.noOffer, color: '#94a3b8' },
    { key: 'withdrawn', label: 'Withdrawn interviews', value: summary.withdrawn ?? 0, color: '#78716c' },
  ].filter((stage) => stage.value > 0);
  const flowTotal = Math.max(summary.applications, middleRaw.reduce((sum, stage) => sum + stage.value, 0), 1);

  function layoutNodes<T extends { value: number }>(items: T[], total: number, minHeight: number) {
    const available = stageH - gap * Math.max(0, items.length - 1);
    const nodes = items.map((item) => ({
      ...item,
      h: Math.max(minHeight, (item.value / total) * available),
    }));
    const used = nodes.reduce((sum, node) => sum + node.h, 0) + gap * Math.max(0, nodes.length - 1);
    let y = stageTop + (stageH - used) / 2;
    return nodes.map((node) => {
      const laid = { ...node, y };
      y += node.h + gap;
      return laid;
    });
  }

  const middleNodes = layoutNodes(middleRaw, flowTotal, 24);
  const middleUsed = middleNodes.length
    ? middleNodes[middleNodes.length - 1].y + middleNodes[middleNodes.length - 1].h - middleNodes[0].y
    : 0;
  const source = {
    x: sourceX,
    y: middleNodes[0]?.y ?? stageTop,
    w: nodeW,
    h: Math.max(middleUsed, 34),
  };
  const interviewNode = middleNodes.find((node) => node.key === 'interviews');

  function layoutRightNodes<T extends { value: number }>(items: T[]) {
    const sourceH = Math.max(interviewNode?.h ?? 24, 40);
    const areaH = Math.max(sourceH * 3.2, sourceH + gap * Math.max(0, items.length - 1) + 80, 120);
    const available = areaH - gap * Math.max(0, items.length - 1);
    const interviewsDenom = summary.interviews_with_withdrawn ?? (summary.interviews + (summary.withdrawn ?? 0));
    const nodes = items.map((item) => ({
      ...item,
      h: Math.max(18, interviewsDenom > 0 ? (item.value / interviewsDenom) * available : 0),
    }));
    const used = nodes.reduce((sum, node) => sum + node.h, 0) + gap * Math.max(0, nodes.length - 1);
    const centerY = (interviewNode ? interviewNode.y + interviewNode.h / 2 : stageTop + stageH / 2);
    let y = Math.max(stageTop + 24, centerY - used / 2);
    return nodes.map((node) => {
      const laid = { ...node, y };
      y += node.h + gap;
      return laid;
    });
  }

  const shiftedRightNodes = layoutRightNodes(rightRaw);

  function ribbon(x0: number, x1: number, sy: number, ty: number, sh: number, th: number) {
    const cx = (x0 + x1) / 2;
    return `M ${x0} ${sy} C ${cx} ${sy} ${cx} ${ty} ${x1} ${ty} L ${x1} ${ty + th} C ${cx} ${ty + th} ${cx} ${sy + sh} ${x0} ${sy + sh} Z`;
  }

  let sourceOffset = 0;
  const middleLinks = middleNodes.map((node) => {
    const sh = Math.max(8, (node.value / flowTotal) * source.h);
    const link = { ...node, sy: source.y + sourceOffset, sh };
    sourceOffset += sh;
    return link;
  });

  let interviewOffset = 0;
  const rightLinks = shiftedRightNodes.map((node) => {
    const sourceH = interviewNode?.h ?? 0;
    const interviewsDenom = summary.interviews_with_withdrawn ?? (summary.interviews + (summary.withdrawn ?? 0));
    const sh = Math.max(6, interviewsDenom > 0 ? (node.value / interviewsDenom) * sourceH : 0);
    const link = { ...node, sy: (interviewNode?.y ?? 0) + interviewOffset, sh };
    interviewOffset += sh;
    return link;
  });

  const legend = [
    { label: 'Applications', value: summary.applications, color: '#1e3a8a' },
    { label: 'Ghosted', value: summary.pending, color: '#f59e0b' },
    { label: 'Rejected', value: summary.rejected, color: '#e11d48' },
    { label: 'Withdrawn interviews', value: summary.withdrawn ?? 0, color: '#78716c' },
    { label: 'Interviews', value: summary.interviews_with_withdrawn ?? (summary.interviews + (summary.withdrawn ?? 0)), color: '#2563eb' },
    { label: 'Offers', value: summary.offers, color: '#16a34a' },
    { label: 'No Offer', value: summary.noOffer, color: '#94a3b8' },
  ];

  function nodeLabel(x: number, y: number, label: string, value: number, color: string, anchor: 'start' | 'end' = 'start') {
    return (
      <>
        <text x={x} y={y - 7} textAnchor={anchor} fontSize={13} fontWeight={900} fill={color}>{label}</text>
        <text x={x} y={y + 12} textAnchor={anchor} fontSize={12} fill="#64748b">{value}</text>
      </>
    );
  }

  return (
    <div className="lane-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
        <div>
          <div className="lane-kicker">Flow</div>
          <h2 style={{ margin: '6px 0 0', fontSize: 20, letterSpacing: '-.03em' }}>Pipeline Sankey</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', fontSize: 12, fontWeight: 800 }}>
          <span style={{ borderRadius: 999, padding: '6px 9px', background: '#eef6fb', color: '#2563eb', border: '1px solid #dbeafe' }}>{cycleName}</span>
          <span style={{ color: '#64748b' }}>{summary.interviews_with_withdrawn ?? (summary.interviews + (summary.withdrawn ?? 0))} interviews - {summary.offers} offers</span>
        </div>
      </div>

      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
        {middleLinks.map((link) => (
          <path key={`from-apps-${link.key}`} d={ribbon(source.x + source.w, middleX, link.sy, link.y, link.sh, link.h)} fill={link.color} opacity={0.28} />
        ))}
        {interviewNode && rightLinks.map((link) => (
          <path key={`from-interviews-${link.key}`} d={ribbon(middleX + nodeW, rightX, link.sy, link.y, link.sh, link.h)} fill={link.color} opacity={0.28} />
        ))}

        <rect x={source.x} y={source.y} width={source.w} height={source.h} fill="#1e3a8a" rx={4} />
        {nodeLabel(source.x - 12, source.y + source.h / 2, 'Applications', summary.applications, '#0f172a', 'end')}

        {middleNodes.map((node) => (
          <g key={`middle-${node.key}`}>
            <rect x={middleX} y={node.y} width={nodeW} height={node.h} fill={node.color} rx={4} />
            {nodeLabel(middleX + nodeW + 12, node.y + node.h / 2, node.label, node.value, node.color)}
          </g>
        ))}

        {shiftedRightNodes.map((node) => (
          <g key={`right-${node.key}`}>
            <rect x={rightX} y={node.y} width={nodeW} height={node.h} fill={node.color} rx={4} />
            {nodeLabel(rightX + nodeW + 12, node.y + node.h / 2, node.label, node.value, node.color)}
          </g>
        ))}
      </svg>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(96px, 1fr))', gap: 10, marginTop: 8 }}>
        {legend.map((item) => (
          <div key={`sankey-summary-${item.label}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: '1px solid #eef2f7', borderRadius: 14, padding: '9px 10px', background: '#f8fafc' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#334155', fontSize: 11, fontWeight: 900 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: item.color }} />
              {item.label}
            </span>
            <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 950 }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GmailPanel({
  settings,
  setSettings,
  onSaveSettings,
  onSync,
  onConnect,
  onDisconnect,
  result,
  syncing,
  connecting,
  diagnostics,
  onDiagnostics,
  cycleSyncState,
  cycleOptions,
  onFullResync,
}: {
  settings: GmailSyncSettings;
  setSettings: (next: GmailSyncSettings) => void;
  onSaveSettings: () => void;
  onSync: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  result: GmailSyncResult | null;
  syncing: boolean;
  connecting: boolean;
  diagnostics: GmailAuthDiagnostics | null;
  onDiagnostics: () => void;
  cycleSyncState: CycleSyncState;
  cycleOptions: string[];
  onFullResync: (cycle: string) => void;
}) {
  return (
    <div className="lane-card" style={{ padding: 20, display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="lane-kicker">Gmail Sync</div>
          <h2 style={{ margin: '6px 0 4px', fontSize: 20, letterSpacing: '-.03em' }}>Sync applications and rejections</h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>
            Job Tracker scans the selected cycle only. Interviews and offers stay manual.
          </p>
        </div>
        <button className="lane-icon-btn" title="Gmail">M</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 10 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ color: '#64748b', fontSize: 12, fontWeight: 700 }}>Label root</span>
          <input
            className="lane-input"
            value={settings.labelRoot}
            onChange={(event) => setSettings({ ...settings, labelRoot: event.target.value, labelPrefix: event.target.value })}
            placeholder="Internships applications"
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ color: '#64748b', fontSize: 12, fontWeight: 700 }}>Days</span>
          <input
            className="lane-input"
            type="number"
            min={1}
            max={730}
            value={settings.lookbackDays}
            onChange={(event) => setSettings({ ...settings, lookbackDays: Number(event.target.value) })}
          />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ color: '#64748b', fontSize: 12, fontWeight: 700 }}>Cycle to sync</span>
          <select
            className="lane-input"
            value={settings.activeCycle}
            onChange={(event) => setSettings({ ...settings, activeCycle: event.target.value })}
          >
            {cycleOptions.map((cycle) => <option key={cycle} value={cycle}>{cycle}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ color: '#64748b', fontSize: 12, fontWeight: 700 }}>Applications folder</span>
          <input
            className="lane-input"
            value={settings.sentLabelName}
            onChange={(event) => setSettings({ ...settings, sentLabelName: event.target.value })}
            placeholder="Applications"
          />
        </label>
      </div>

      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ color: '#64748b', fontSize: 12, fontWeight: 700 }}>Rejection folder</span>
        <input
          className="lane-input"
          value={settings.rejectedLabelName}
          onChange={(event) => setSettings({ ...settings, rejectedLabelName: event.target.value })}
          placeholder="Rejections"
        />
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#334155', fontSize: 13, fontWeight: 700 }}>
        <input
          type="checkbox"
          checked={settings.syncExistingFoldersOnly}
          onChange={(event) => setSettings({ ...settings, syncExistingFoldersOnly: event.target.checked, autoLabel: event.target.checked ? false : settings.autoLabel })}
        />
        Sync existing Gmail folders only
      </label>
      {!settings.syncExistingFoldersOnly && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#334155', fontSize: 13, fontWeight: 700 }}>
          <input
            type="checkbox"
            checked={settings.autoLabel}
            onChange={(event) => setSettings({ ...settings, autoLabel: event.target.checked })}
          />
          Create/apply missing Gmail labels
        </label>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#334155', fontSize: 13, fontWeight: 700 }}>
        <input
          type="checkbox"
          checked={settings.autoDetectCycle}
          onChange={(event) => setSettings({ ...settings, autoDetectCycle: event.target.checked })}
        />
        Auto-detect recruitment cycle from email text
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#334155', fontSize: 13, fontWeight: 700 }}>
        <input
          type="checkbox"
          checked={settings.createApplicationsFromEmail}
          onChange={(event) => setSettings({ ...settings, createApplicationsFromEmail: event.target.checked })}
        />
        Create missing applications from Gmail replies
      </label>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="lane-btn" onClick={onConnect} disabled={connecting}>{connecting ? 'Connecting...' : 'Connect Gmail'}</button>
        <button className="lane-btn secondary" onClick={onSync} disabled={syncing}>{syncing ? 'Syncing...' : `Sync ${settings.activeCycle}`}</button>
        <button className="lane-btn secondary" onClick={onSaveSettings}>Save settings</button>
        <button className="lane-btn secondary" onClick={onDisconnect}>Disconnect</button>
        <button className="lane-btn secondary" onClick={onDiagnostics}>Diagnose</button>
      </div>

      <div className="lane-panel" style={{ padding: 14, background: '#f8fafc' }}>
        {result?.error ? (
          <div style={{ color: '#e11d48', fontSize: 13, lineHeight: 1.45 }}>{result.error}</div>
        ) : result?.notice ? (
          <div style={{ color: '#16a34a', fontSize: 13, fontWeight: 800, lineHeight: 1.45 }}>{result.notice}</div>
        ) : result ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                ['Scanned', result.scanned],
                ['Matched', result.matched],
                ['Updated', result.updated],
                ['Labeled', result.labeled],
              ].map(([label, value]) => (
                <div key={label} style={{ background: '#fff', borderRadius: 14, padding: 12, border: '1px solid #eef2f7' }}>
                  <div style={{ color: '#64748b', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900 }}>{value}</div>
                </div>
              ))}
            </div>
            {result.cycleStats && Object.keys(result.cycleStats).length > 0 && (
              <div style={{ display: 'grid', gap: 4 }}>
                {Object.entries(result.cycleStats).map(([cycle, stats]) => (
                  <div key={cycle} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', padding: '4px 8px', background: '#fff', borderRadius: 8, border: '1px solid #eef2f7' }}>
                    <span style={{ fontWeight: 800 }}>{cycle}</span>
                    <span>{stats.scanned} scanned · {stats.updated} updated</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.45 }}>
            Sync reads only Applications and Rejections under the selected cycle. Interviews and offers are manual-only.
          </div>
        )}
      </div>

      {diagnostics && (
        <div className="lane-panel" style={{ padding: 12, background: '#fff', color: '#475569', fontSize: 11, lineHeight: 1.55, wordBreak: 'break-word' }}>
          <div><strong style={{ color: '#0f172a' }}>Client ID:</strong> {diagnostics.manifestClientId ? 'configured' : 'missing'}</div>
          <div><strong style={{ color: '#0f172a' }}>Redirect URL:</strong> {diagnostics.redirectUrl ? 'configured' : 'unavailable'}</div>
          <div><strong style={{ color: '#0f172a' }}>Identity API:</strong> {diagnostics.hasIdentityApi ? 'available' : 'missing'}</div>
          <div><strong style={{ color: '#0f172a' }}>Chrome profile:</strong> {diagnostics.profileEmail ?? 'unknown'}</div>
          <div><strong style={{ color: '#0f172a' }}>Scopes:</strong> {diagnostics.scopes.join(', ') || 'none'}</div>
          {diagnostics.error && <div style={{ color: '#e11d48' }}>{diagnostics.error}</div>}
        </div>
      )}

      {cycleOptions.length > 0 && (
        <div>
          <div className="lane-kicker" style={{ marginBottom: 8 }}>Per-cycle sync state</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {cycleOptions.map((cycle) => {
              const state = cycleSyncState[cycle];
              return (
                <div key={cycle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 12px', background: '#f8fafc', borderRadius: 12, border: '1px solid #eef2f7' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 12, color: '#0f172a' }}>{cycle}</div>
                    {state ? (
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        Last synced {timeAgo(state.lastSyncedAt)} · {state.lastScanned} scanned · {state.lastUpdated} updated
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Never synced — will do full import on next sync</div>
                    )}
                  </div>
                  <button
                    className="lane-btn secondary"
                    style={{ fontSize: 11, padding: '5px 10px', whiteSpace: 'nowrap' }}
                    onClick={() => onFullResync(cycle)}
                    disabled={syncing}
                  >
                    Full re-sync
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [apps, setApps] = useState<Application[]>([]);
  const [filter, setFilter] = useState<ApplicationStatus | 'all'>('all');
  const [cycleFilter, setCycleFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dataToolsOpen, setDataToolsOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [settings, setSettings] = useState<GmailSyncSettings>({
    labelPrefix: 'Internships applications',
    labelRoot: 'Internships applications',
    activeCycle: 'Summer 2026',
    interviewLabelName: 'Interviews',
    rejectedLabelName: 'Rejections',
    offerLabelName: 'Offers',
    sentLabelName: 'Applications',
    autoDetectCycle: true,
    createApplicationsFromEmail: true,
    lookbackDays: 500,
    autoLabel: false,
    syncExistingFoldersOnly: true,
  });
  const [syncResult, setSyncResult] = useState<GmailSyncResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [diagnostics, setDiagnostics] = useState<GmailAuthDiagnostics | null>(null);
  const [importNotice, setImportNotice] = useState('');
  const [cycleSyncState, setCycleSyncState] = useState<CycleSyncState>({});
  const [cycleLayout, setCycleLayout] = useState<CycleLayout>({ order: [], hidden: [] });
  const [newCycleName, setNewCycleName] = useState('');
  const [manualOutcomes, setManualOutcomes] = useState<ManualOutcome[]>([]);
  const [manualCompany, setManualCompany] = useState('');
  const [manualCycle, setManualCycle] = useState('Summer 2026');
  const [manualType, setManualType] = useState<ManualOutcomeType>('interview');

  async function load() {
    const [loadedApps, gmailSettings, syncState, outcomes, layout] = await Promise.all([
      getApplications(),
      getGmailSettings(),
      getCycleSyncState(),
      getManualOutcomes(),
      getCycleLayout(),
    ]);
    setApps(loadedApps);
    setSettings(gmailSettings);
    setCycleSyncState(syncState);
    setManualOutcomes(outcomes);
    setCycleLayout(layout);
    if (!manualCycle && gmailSettings.activeCycle.trim()) setManualCycle(gmailSettings.activeCycle.trim());
  }

  useEffect(() => {
    injectStyles();
    load();
  }, []);

  const hiddenCycleKeys = useMemo(() => new Set(cycleLayout.hidden.map(cycleKey)), [cycleLayout.hidden]);
  const visibleBaseApps = useMemo(() => (
    apps.filter((app) => !hiddenCycleKeys.has(cycleKey(app.recruitment_cycle ?? 'Unassigned')))
  ), [apps, hiddenCycleKeys]);
  const visibleManualOutcomes = useMemo(() => (
    manualOutcomes.filter((outcome) => !hiddenCycleKeys.has(cycleKey(outcome.cycle)))
  ), [manualOutcomes, hiddenCycleKeys]);

  const counts = useMemo(() => {
    const scopedApps = cycleFilter === 'all'
      ? visibleBaseApps
      : apps.filter((app) => (app.recruitment_cycle ?? 'Unassigned') === cycleFilter);
    const get = (status: ApplicationStatus) => scopedApps.filter((app) => app.status === status).length;
    const outcomes = outcomeDataForView(cycleFilter, scopedApps, visibleManualOutcomes);
    const submitted = scopedApps.filter((app) => app.status !== 'saved').length;
    const screened = outcomes.interviewTotal;
    const interviewed = outcomes.interviewTotal;
    return {
      total: outcomes.applications ?? scopedApps.length,
      saved: get('saved'),
      submitted,
      applied: get('applied') + Math.max(0, (outcomes.applications ?? scopedApps.length) - scopedApps.length),
      screened,
      interviewed,
      offers: outcomes.offerTotal,
      rejected: get('rejected'),
      ghosted: get('ghosted'),
    };
  }, [apps, cycleFilter, visibleBaseApps, visibleManualOutcomes]);

  const cycleOptions = useMemo(() => {
    const cycles = [
      ...cycleLayout.order,
      ...apps.map((app) => app.recruitment_cycle ?? 'Unassigned'),
      ...manualOutcomes.map((outcome) => outcome.cycle),
      settings.activeCycle.trim(),
    ].filter((cycle) => cycle && !hiddenCycleKeys.has(cycleKey(cycle)));
    return applyCycleOrder(cycles, cycleLayout.order);
  }, [apps, cycleLayout.order, hiddenCycleKeys, manualOutcomes, settings.activeCycle]);

  const cycleApps = useMemo(() => {
    return cycleFilter === 'all'
      ? visibleBaseApps
      : apps.filter((app) => (app.recruitment_cycle ?? 'Unassigned') === cycleFilter);
  }, [apps, cycleFilter, visibleBaseApps]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return cycleApps
      .filter((app) => filter === 'all' || app.status === filter)
      .filter((app) => !query || [app.company, app.role, app.location ?? '', app.notes, app.gmail_label_source ?? '', app.last_email_subject ?? ''].join(' ').toLowerCase().includes(query))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [cycleApps, filter, search]);

  const trustedOutcomes = useMemo(() => (
    outcomeDataForView(cycleFilter, cycleApps, visibleManualOutcomes)
  ), [cycleApps, cycleFilter, visibleManualOutcomes]);

  const pipelineData = PIPELINE.map((status) => ({
    name: STATUS_META[status].label,
    value: status === 'interview'
      ? trustedOutcomes.interviewTotal
      : status === 'offer'
        ? trustedOutcomes.offerTotal
        : cycleApps.filter((app) => app.status === status).length,
    color: STATUS_META[status].color,
  }));
  const interviewCompanies = trustedOutcomes.interviewCompanies.map((item) => item.count > 1 ? `${item.company} (${item.count})` : item.company);
  const offerCompanies = trustedOutcomes.offerCompanies.map((item) => item.count > 1 ? `${item.company} (${item.count})` : item.company);
  const withdrawnCompanies = (trustedOutcomes.withdrawnCompanies ?? []).map((item) => item.count > 1 ? `${item.company} (${item.count})` : item.company);
  const currentManualOutcomes = visibleManualOutcomes.filter((outcome) => cycleFilter === 'all' || outcome.cycle === cycleFilter);
  const currentCycleName = cycleFilter === 'all' ? 'All cycles' : cycleFilter;

  const weeklyData = useMemo(() => {
    const buckets = Array.from({ length: 8 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (7 - index) * 7);
      return { name: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), applications: 0, responses: 0 };
    });
    cycleApps.forEach((app) => {
      const date = new Date(app.captured_at);
      const diffWeeks = Math.floor((Date.now() - date.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const index = 7 - diffWeeks;
      if (index >= 0 && index < buckets.length) {
        buckets[index].applications += 1;
        if (['phone_screen', 'interview', 'offer', 'rejected'].includes(app.status)) buckets[index].responses += 1;
      }
    });
    return buckets;
  }, [cycleApps]);

  async function handleStatusChange(id: string, status: ApplicationStatus) {
    await updateApplication(id, { status, status_source: 'manual' });
    setEditingId(null);
    await load();
  }

  async function handleSaveEdit(updates: Partial<Application>) {
    if (!editingApp) return;
    await updateApplication(editingApp.id, { ...updates, status_source: updates.status !== editingApp.status ? 'manual' : editingApp.status_source ?? undefined });
    setEditingApp(null);
    await load();
  }

  async function handleSyncCycle(cycle = settings.activeCycle) {
    const activeCycle = cleanCycleName(cycle || settings.activeCycle);
    if (!activeCycle) return;
    setSyncing(true);
    const normalizedSettings = { ...settings, activeCycle, labelPrefix: settings.labelRoot };
    setSettings(normalizedSettings);
    await saveGmailSettings(normalizedSettings);
    const result = await syncGmail(normalizedSettings);
    setSyncResult(result);
    setCycleFilter(activeCycle);
    await load();
    setSyncing(false);
  }

  async function handleSync() {
    await handleSyncCycle(settings.activeCycle);
  }

  async function handleFullResync(cycle: string) {
    setSyncing(true);
    const normalizedSettings = {
      ...settings,
      activeCycle: cycle === '__all__' ? '' : cleanCycleName(cycle),
      labelPrefix: settings.labelRoot,
    };
    setSettings(normalizedSettings);
    await saveGmailSettings(normalizedSettings);
    const result = await syncGmail(normalizedSettings, { resetCycles: cycle === '__all__' ? cycleSyncState ? Object.keys(cycleSyncState) : [] : [cycle] });
    setSyncResult(result);
    if (cycle !== '__all__') setCycleFilter(cycle);
    await load();
    setSyncing(false);
  }

  async function handleConnect() {
    setConnecting(true);
    setSyncResult({ scanned: 0, matched: 0, updated: 0, labeled: 0, hits: [], notice: 'Opening Google sign-in...' });
    try {
      await connectGmail();
      setSyncResult({ scanned: 0, matched: 0, updated: 0, labeled: 0, hits: [], notice: 'Gmail connected. Click Sync now to scan replies.' });
    } catch (error) {
      setSyncResult({ scanned: 0, matched: 0, updated: 0, labeled: 0, hits: [], error: error instanceof Error ? error.message : 'Could not connect Gmail' });
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    await disconnectGmail();
    setSyncResult(null);
  }

  async function handleDiagnostics() {
    setDiagnostics(await getGmailAuthDiagnostics());
  }

  async function persistCycleLayout(next: CycleLayout) {
    await saveCycleLayout(next);
    setCycleLayout(next);
  }

  async function handleCreateCycle() {
    const cycle = cleanCycleName(newCycleName);
    if (!cycle) return;
    const nextLayout: CycleLayout = {
      order: uniqueCycles([cycle, ...cycleLayout.order]),
      hidden: cycleLayout.hidden.filter((hidden) => cycleKey(hidden) !== cycleKey(cycle)),
    };
    const nextSettings = { ...settings, activeCycle: cycle, labelPrefix: settings.labelRoot };
    await persistCycleLayout(nextLayout);
    await saveGmailSettings(nextSettings);
    setSettings(nextSettings);
    setManualCycle(cycle);
    setCycleFilter(cycle);
    setNewCycleName('');
    setImportNotice(`${cycle} created. Add Gmail labels under ${settings.labelRoot || 'Internships applications'}/${cycle}/Applications and /Rejections, then sync this cycle.`);
  }

  async function handleMoveCycle(cycle: string, direction: -1 | 1) {
    const movable = cycleOptions.filter((option) => option !== 'Unassigned');
    const index = movable.findIndex((option) => cycleKey(option) === cycleKey(cycle));
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= movable.length) return;
    const nextOrder = [...movable];
    [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];
    await persistCycleLayout({ ...cycleLayout, order: nextOrder });
  }

  async function handleDeleteCycle(cycle: string) {
    if (cycle === 'Unassigned') return;
    const nextLayout: CycleLayout = {
      order: cycleLayout.order.filter((item) => cycleKey(item) !== cycleKey(cycle)),
      hidden: uniqueCycles([...cycleLayout.hidden, cycle]),
    };
    const remainingCycles = cycleOptions.filter((option) => cycleKey(option) !== cycleKey(cycle));
    const nextActiveCycle = remainingCycles.find((option) => option !== 'Unassigned') ?? '';
    const nextSettings = cycleKey(settings.activeCycle) === cycleKey(cycle)
      ? { ...settings, activeCycle: nextActiveCycle, labelPrefix: settings.labelRoot }
      : settings;
    await persistCycleLayout(nextLayout);
    await clearCycleSync(cycle);
    if (nextSettings !== settings) {
      await saveGmailSettings(nextSettings);
      setSettings(nextSettings);
    }
    if (cycleKey(cycleFilter) === cycleKey(cycle)) setCycleFilter('all');
    if (cycleKey(manualCycle) === cycleKey(cycle)) setManualCycle(nextActiveCycle || 'Unassigned');
    setImportNotice(`${cycle} was removed from the cycle tabs. Existing rows were kept and hidden from All cycles.`);
    await load();
  }

  async function handleApplyCorrections(cycle: string) {
    const records = cycle === 'Summer 2025'
      ? SUMMER_2025_KNOWN
      : cycle === 'Winter 2026'
        ? WINTER_2026_KNOWN
        : SUMMER_2026_KNOWN;
    const result = await seedKnownApplications(cycle, records);
    setCycleFilter(cycle);
    setImportNotice(`${cycle}: imported ${result.imported}, updated ${result.updated}. Backup saved before changes.`);
    await load();
  }

  async function handlePadSummer2025() {
    const result = await padCycleApplied('Summer 2025', 383);
    setImportNotice(`Summer 2025: added ${result.added} applied rows → total ${result.total}.`);
    await load();
  }

  async function handleAddManualOutcome() {
    const company = manualCompany.trim();
    const cycle = manualCycle.trim();
    if (!company || !cycle) return;
    await addManualOutcome({ company, cycle, type: manualType });
    setManualCompany('');
    setCycleFilter(cycle);
    await load();
  }

  async function handleRemoveManualOutcome(id: string) {
    await removeManualOutcome(id);
    await load();
  }

  function handleExportCSV() {
    const csv = exportApplicationsToCSV(cycleFilter === 'all' ? apps : apps.filter((a) => (a.recruitment_cycle ?? 'Unassigned') === cycleFilter));
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lane-applications${cycleFilter !== 'all' ? `-${cycleFilter.replace(/\s+/g, '-')}` : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportCSVClick() {
    document.getElementById('lane-csv-import-input')?.click();
  }

  async function handleImportCSVFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = await importFromCSV(text);
    const msg = `CSV: ${result.imported} new, ${result.updated} updated${result.errors.length ? ` (${result.errors.length} errors)` : ''}.`;
    setImportNotice(msg);
    await load();
    event.target.value = '';
  }

  return (
    <>
    {editingApp && (
      <EditModal
        app={editingApp}
        cycleOptions={cycleOptions}
        onSave={handleSaveEdit}
        onClose={() => setEditingApp(null)}
      />
    )}
    <div className="lane-shell">
      <div className="lane-frame">
        <aside className="lane-sidebar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: '#07091f', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900 }}>JT</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: '-.04em' }}>Job Tracker</div>
              <div style={{ color: '#64748b', fontSize: 12 }}>Job pipeline</div>
            </div>
          </div>

          <div style={{ marginBottom: 22 }}>
            <div className="lane-kicker" style={{ marginBottom: 8 }}>Cycles</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, marginBottom: 10 }}>
              <input
                className="lane-input"
                value={newCycleName}
                onChange={(event) => setNewCycleName(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') handleCreateCycle(); }}
                placeholder="New cycle"
                style={{ minHeight: 34, fontSize: 12, borderRadius: 12 }}
              />
              <button className="lane-btn secondary" onClick={handleCreateCycle} style={{ padding: '7px 10px', fontSize: 12 }}>Add</button>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {['all', ...cycleOptions].map((cycle) => {
                const active = cycleFilter === cycle;
                if (cycle === 'all') {
                  const allData = outcomeDataForView('all', visibleBaseApps, visibleManualOutcomes);
                  const count = allData.applications ?? visibleBaseApps.length;
                  return (
                    <button
                      key={cycle}
                      onClick={() => setCycleFilter(cycle)}
                      style={{
                        minHeight: 38,
                        border: 0,
                        borderRadius: 14,
                        padding: '0 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: active ? '#dbeafe' : 'transparent',
                        color: active ? '#2563eb' : '#475569',
                        fontWeight: 800,
                      }}
                    >
                      <span>All cycles</span>
                      <span>{count}</span>
                    </button>
                  );
                }

                const cycleAppsList = apps.filter((app) => (app.recruitment_cycle ?? 'Unassigned') === cycle);
                const trusted = trustedOutcomeData(cycle, cycleAppsList, visibleManualOutcomes);
                const count = trusted.applications ?? cycleAppsList.length;

                return (
                  <div
                    key={cycle}
                    style={{
                      border: active ? '1px solid #bfdbfe' : '1px solid transparent',
                      borderRadius: 14,
                      padding: 8,
                      display: 'grid',
                      gap: 6,
                      background: active ? '#dbeafe' : 'transparent',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <button
                        onClick={() => {
                          setCycleFilter(cycle);
                          setSettings((prev) => ({ ...prev, activeCycle: cycle }));
                          setManualCycle(cycle);
                        }}
                        style={{
                          minHeight: 28,
                          minWidth: 0,
                          flex: 1,
                          border: 0,
                          borderRadius: 10,
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'transparent',
                          color: active ? '#2563eb' : '#475569',
                          fontWeight: 900,
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cycle}</span>
                        <span style={{ marginLeft: 8 }}>{count}</span>
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      <button className="lane-btn secondary" title={`Sync ${cycle}`} onClick={() => handleSyncCycle(cycle)} disabled={syncing} style={{ padding: '5px 8px', fontSize: 10 }}>Sync</button>
                      {cycle !== 'Unassigned' && (
                        <>
                          <button className="lane-icon-btn" title="Move up" onClick={() => handleMoveCycle(cycle, -1)} style={{ width: 24, height: 24, fontSize: 10 }}>^</button>
                          <button className="lane-icon-btn" title="Move down" onClick={() => handleMoveCycle(cycle, 1)} style={{ width: 24, height: 24, fontSize: 10 }}>v</button>
                          <button className="lane-icon-btn" title="Delete cycle tab" onClick={() => handleDeleteCycle(cycle)} style={{ width: 24, height: 24, fontSize: 10, color: '#e11d48' }}>x</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {(['all', ...STATUSES] as const).map((status) => {
              const active = filter === status;
              const count = status === 'all'
                ? trustedOutcomes.applications ?? cycleApps.length
                : status === 'interview'
                  ? trustedOutcomes.interviewTotal
                  : status === 'offer'
                    ? trustedOutcomes.offerTotal
                    : cycleApps.filter((app) => app.status === status).length;
              const meta = status === 'all' ? { label: 'All Applications', color: '#07091f', soft: '#eef2f7' } : STATUS_META[status];
              return (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  style={{
                    minHeight: 42,
                    border: 0,
                    borderRadius: 14,
                    padding: '0 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: active ? meta.soft : 'transparent',
                    color: active ? meta.color : '#475569',
                    fontWeight: 800,
                  }}
                >
                  <span>{meta.label}</span>
                  <span>{count}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="lane-main">
          <div className="lane-topbar">
            <div>
              <div className="lane-kicker">Dashboard</div>
              <h1 style={{ margin: '4px 0 0', fontSize: 34, lineHeight: 1, letterSpacing: '-.05em' }}>
                {cycleFilter === 'all' ? 'Application command center' : cycleFilter}
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="lane-input" style={{ width: 240 }} placeholder="Search company, role, note..." value={search} onChange={(event) => setSearch(event.target.value)} />
              <button className="lane-btn secondary" onClick={handleExportCSV} title={`Export ${cycleFilter === 'all' ? 'all' : cycleFilter} applications as CSV`}>Export CSV</button>
              <button className="lane-btn secondary" onClick={handleImportCSVClick}>Import CSV</button>
              <input id="lane-csv-import-input" type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleImportCSVFile} />
              <div style={{ position: 'relative' }}>
                <button
                  className="lane-btn secondary"
                  onClick={() => setDataToolsOpen((v) => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  Data tools
                  <span style={{ fontSize: 10, opacity: 0.6 }}>{dataToolsOpen ? '▲' : '▼'}</span>
                </button>
                {dataToolsOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50,
                    background: '#fff', border: '1px solid rgba(15,23,42,.1)', borderRadius: 14,
                    boxShadow: '0 12px 30px rgba(15,23,42,.12)', padding: 8, minWidth: 230,
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    {[
                      { label: 'Apply Summer 2025 corrections', action: () => { handleApplyCorrections('Summer 2025'); setDataToolsOpen(false); } },
                      { label: 'Pad Summer 2025 → 383', action: () => { handlePadSummer2025(); setDataToolsOpen(false); } },
                      { label: 'Apply Winter 2026 corrections', action: () => { handleApplyCorrections('Winter 2026'); setDataToolsOpen(false); } },
                      { label: 'Apply Summer 2026 corrections', action: () => { handleApplyCorrections('Summer 2026'); setDataToolsOpen(false); } },
                    ].map((item) => (
                      <button
                        key={item.label}
                        onClick={item.action}
                        style={{
                          border: 'none', background: 'none', textAlign: 'left', padding: '8px 12px',
                          borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#0f172a', cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="lane-btn" onClick={load}>Refresh</button>
            </div>
          </div>

          {importNotice && (
            <div className="lane-card" style={{ padding: '12px 16px', marginBottom: 14, color: '#2563eb', fontSize: 13, fontWeight: 800 }}>
              {importNotice}
            </div>
          )}

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))', gap: 14, marginBottom: 14 }}>
            <StatCard title="Tracked" value={counts.total} detail={`${counts.saved} saved, ${counts.submitted} submitted`} color="#0f172a" />
            <StatCard title="Response Rate" value={`${pct(counts.screened, counts.submitted)}%`} detail={`${counts.screened} reached screening`} color="#8b5cf6" />
            <StatCard title="Interview Rate" value={`${pct(counts.interviewed, counts.submitted)}%`} detail={`${counts.interviewed} interviews or offers`} color="#2563eb" />
            <StatCard title="Offer Rate" value={`${pct(counts.offers, Math.max(counts.screened, 1))}%`} detail={`${counts.offers} offers from screened`} color="#16a34a" />
          </section>

          <section className="lane-card" style={{ padding: 18, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 14, marginBottom: 12 }}>
              <div>
                <div className="lane-kicker">Manual outcomes</div>
                <h2 style={{ margin: '6px 0 0', fontSize: 20, letterSpacing: '-.03em' }}>Add interview or offer companies</h2>
              </div>
              <div style={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>
                Gmail sync skips interviews and offers
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '150px 150px minmax(180px, 1fr) auto', gap: 10, alignItems: 'center' }}>
              <select className="lane-input" value={manualCycle} onChange={(event) => setManualCycle(event.target.value)}>
                {cycleOptions.map((cycle) => <option key={cycle} value={cycle}>{cycle}</option>)}
              </select>
              <select className="lane-input" value={manualType} onChange={(event) => setManualType(event.target.value as ManualOutcomeType)}>
                <option value="interview">Interview</option>
                <option value="offer">Offer</option>
              </select>
              <input className="lane-input" value={manualCompany} onChange={(event) => setManualCompany(event.target.value)} placeholder="Company name" />
              <button className="lane-btn" onClick={handleAddManualOutcome}>Add</button>
            </div>
            {currentManualOutcomes.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {currentManualOutcomes.map((outcome) => (
                  <span key={outcome.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 999, padding: '6px 9px', background: outcome.type === 'offer' ? '#dcfce7' : '#dbeafe', color: outcome.type === 'offer' ? '#16a34a' : '#2563eb', fontSize: 12, fontWeight: 900 }}>
                    {outcome.cycle}: {outcome.company} ({outcome.type})
                    <button onClick={() => handleRemoveManualOutcome(outcome.id)} style={{ border: 0, background: 'transparent', color: 'inherit', fontWeight: 900, padding: 0 }}>x</button>
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="lane-dashboard-grid">
            <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
              <OutcomeDashboardCard
                apps={cycleApps}
                trustedOutcomes={trustedOutcomes}
                interviewCompanies={interviewCompanies}
                offerCompanies={offerCompanies}
                withdrawnCompanies={withdrawnCompanies}
                cycleName={currentCycleName}
              />
              <BottomPipelineSankey apps={cycleApps} trustedOutcomes={trustedOutcomes} cycleName={currentCycleName} />
            </div>
            <GmailPanel
              settings={settings}
              setSettings={setSettings}
              onSaveSettings={() => saveGmailSettings({ ...settings, labelPrefix: settings.labelRoot })}
              onSync={handleSync}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              result={syncResult}
              syncing={syncing}
              connecting={connecting}
              diagnostics={diagnostics}
              onDiagnostics={handleDiagnostics}
              cycleSyncState={cycleSyncState}
              cycleOptions={cycleOptions}
              onFullResync={handleFullResync}
            />
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 14, marginBottom: 14 }}>
            <div className="lane-card" style={{ padding: 20, minHeight: 280 }}>
              <div className="lane-kicker">Activity</div>
              <h2 style={{ margin: '6px 0 14px', fontSize: 20, letterSpacing: '-.03em' }}>Weekly trend</h2>
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={weeklyData}>
                  <defs>
                    <linearGradient id="apps" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip />
                  <Area type="monotone" dataKey="applications" stroke="#2563eb" fill="url(#apps)" strokeWidth={3} />
                  <Area type="monotone" dataKey="responses" stroke="#16a34a" fill="#dcfce7" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="lane-card" style={{ padding: 20, minHeight: 280 }}>
              <div className="lane-kicker">Mix</div>
              <h2 style={{ margin: '6px 0 14px', fontSize: 20, letterSpacing: '-.03em' }}>Status split</h2>
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={pipelineData.filter((item) => item.value > 0)} dataKey="value" innerRadius={58} outerRadius={88} paddingAngle={4}>
                    {pipelineData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="lane-card" style={{ overflow: 'hidden', marginBottom: 18 }}>
            <div style={{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="lane-kicker">Applications</div>
                <h2 style={{ margin: '6px 0 0', fontSize: 20, letterSpacing: '-.03em' }}>{visible.length} visible records</h2>
              </div>
              <button className="lane-btn secondary" onClick={load}>Reload data</button>
            </div>

            {visible.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>No applications match this view.</div>
            ) : (
              <table className="lane-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Cycle</th>
                    <th>Location</th>
                    <th>Applied</th>
                    <th>Source folder</th>
                    <th>Last email</th>
                    <th>Resume</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((app) => (
                    <tr key={app.id}>
                      <td>
                        <a href={app.job_url} target="_blank" rel="noreferrer" style={{ color: '#0f172a', fontWeight: 900, textDecoration: 'none' }}>
                          {app.company}
                        </a>
                      </td>
                      <td style={{ color: '#475569', maxWidth: 280 }}>
                        <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontWeight: 700 }}>{app.role}</div>
                        {app.notes && <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{app.notes}</div>}
                      </td>
                      <td>
                        {editingId === app.id ? (
                          <select className="lane-input" autoFocus value={app.status} onChange={(event) => handleStatusChange(app.id, event.target.value as ApplicationStatus)} onBlur={() => setEditingId(null)}>
                            {STATUSES.map((status) => <option key={status} value={status}>{STATUS_META[status].label}</option>)}
                          </select>
                        ) : (
                          <button onClick={() => setEditingId(app.id)} style={{ border: 0, background: 'transparent', padding: 0 }}>
                            <StatusPill status={app.status} />
                          </button>
                        )}
                      </td>
                      <td style={{ color: '#64748b', fontWeight: 700 }}>{app.recruitment_cycle ?? '-'}</td>
                      <td style={{ color: '#64748b' }}>{app.location ?? '-'}</td>
                      <td style={{ color: '#64748b' }}>{fmtDate(app.applied_at || app.captured_at)}</td>
                      <td style={{ color: '#64748b', maxWidth: 220 }}>
                        <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{app.gmail_label_source ?? '-'}</div>
                      </td>
                      <td style={{ color: '#64748b', maxWidth: 220 }}>
                        <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{app.last_email_subject ?? '-'}</div>
                        {app.status_source === 'gmail' && <div style={{ color: '#2563eb', fontSize: 11, fontWeight: 800, marginTop: 3 }}>Updated by Gmail</div>}
                      </td>
                      <td style={{ color: '#64748b' }}>{app.resume_version ?? '-'}</td>
                      <td>
                        <button
                          className="lane-btn secondary"
                          style={{ padding: '5px 10px', fontSize: 12 }}
                          onClick={() => setEditingApp(app)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </main>
      </div>
    </div>
    </>
  );
}
