import type { Application, ApplicationStatus, GmailSyncSettings, JobSource } from './types';
import { WINTER_2026_SEED } from './winter2026Seed';
import type { SeedRecord } from './winter2026Seed';

export const KNOWN_CYCLES = ['Summer 2025', 'Winter 2026', 'Summer 2026'] as const;

const KEY = 'lane_applications';
const GMAIL_SETTINGS_KEY = 'lane_gmail_settings';
const CYCLE_SYNC_KEY = 'lane_cycle_sync_state';
const MANUAL_OUTCOMES_KEY = 'lane_manual_outcomes';
const CYCLE_LAYOUT_KEY = 'lane_cycle_layout';
const TRUSTED_OUTCOMES_KEY = 'lane_trusted_outcomes';

export type CycleSyncState = Record<string, { lastSyncedAt: string; lastScanned: number; lastUpdated: number }>;
export interface CycleLayout {
  order: string[];
  hidden: string[];
}
export type ManualOutcomeType = 'interview' | 'offer';
export interface ManualOutcome {
  id: string;
  cycle: string;
  company: string;
  type: ManualOutcomeType;
  created_at: string;
}

export const DEFAULT_GMAIL_SETTINGS: GmailSyncSettings = {
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
};

export async function getApplications(): Promise<Application[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(KEY, (result) => {
      resolve(result[KEY] ?? []);
    });
  });
}

export async function saveApplication(app: Application): Promise<void> {
  const apps = await getApplications();
  const idx = apps.findIndex((a) => a.id === app.id);
  if (idx >= 0) {
    apps[idx] = app;
  } else {
    apps.push(app);
  }
  return replaceApplications(apps);
}

export async function findByUrl(url: string): Promise<Application | null> {
  const apps = await getApplications();
  const normalize = (u: string) => {
    try {
      const p = new URL(u);
      return p.hostname + p.pathname.replace(/\/$/, '');
    } catch {
      return u;
    }
  };
  const target = normalize(url);
  return apps.find((a) => normalize(a.job_url) === target) ?? null;
}

export async function updateApplication(id: string, updates: Partial<Application>): Promise<void> {
  const apps = await getApplications();
  const idx = apps.findIndex((a) => a.id === id);
  if (idx < 0) return;
  apps[idx] = { ...apps[idx], ...updates, updated_at: new Date().toISOString() };
  return replaceApplications(apps);
}

export async function replaceApplications(apps: Application[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [KEY]: apps }, resolve);
  });
}

export async function getGmailSettings(): Promise<GmailSyncSettings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(GMAIL_SETTINGS_KEY, (result) => {
      const saved = result[GMAIL_SETTINGS_KEY] ?? {};
      const migrated = {
        ...DEFAULT_GMAIL_SETTINGS,
        ...saved,
      };
      migrated.labelRoot = saved.labelRoot ?? saved.labelPrefix ?? DEFAULT_GMAIL_SETTINGS.labelRoot;
      migrated.labelPrefix = migrated.labelRoot;
      if (!saved.rejectedLabelName || saved.rejectedLabelName === '{cycle} rejections') {
        migrated.rejectedLabelName = DEFAULT_GMAIL_SETTINGS.rejectedLabelName;
      }
      if (!saved.sentLabelName || saved.sentLabelName === 'Email Sent') {
        migrated.sentLabelName = DEFAULT_GMAIL_SETTINGS.sentLabelName;
      }
      migrated.autoLabel = saved.autoLabel ?? DEFAULT_GMAIL_SETTINGS.autoLabel;
      migrated.syncExistingFoldersOnly = saved.syncExistingFoldersOnly ?? DEFAULT_GMAIL_SETTINGS.syncExistingFoldersOnly;
      if (typeof saved.lookbackDays === 'number' && saved.lookbackDays < 500) {
        migrated.lookbackDays = 500;
      }
      resolve(migrated);
    });
  });
}

export async function saveGmailSettings(settings: GmailSyncSettings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [GMAIL_SETTINGS_KEY]: settings }, resolve);
  });
}

export async function getCycleSyncState(): Promise<CycleSyncState> {
  return new Promise((resolve) => {
    chrome.storage.local.get(CYCLE_SYNC_KEY, (result) => {
      resolve(result[CYCLE_SYNC_KEY] ?? {});
    });
  });
}

export async function setCycleSyncForCycle(cycle: string, state: { lastSyncedAt: string; lastScanned: number; lastUpdated: number }): Promise<void> {
  const current = await getCycleSyncState();
  return new Promise((resolve) => {
    chrome.storage.local.set({ [CYCLE_SYNC_KEY]: { ...current, [cycle]: state } }, resolve);
  });
}

export async function clearCycleSync(cycle: string): Promise<void> {
  const current = await getCycleSyncState();
  const next = { ...current };
  delete next[cycle];
  return new Promise((resolve) => {
    chrome.storage.local.set({ [CYCLE_SYNC_KEY]: next }, resolve);
  });
}

function cleanCycleName(cycle: string): string {
  return cycle.replace(/\s+/g, ' ').trim();
}

function dedupeCycles(cycles: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  cycles.forEach((cycle) => {
    const clean = cleanCycleName(cycle);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) return;
    seen.add(key);
    result.push(clean);
  });
  return result;
}

export async function getCycleLayout(): Promise<CycleLayout> {
  return new Promise((resolve) => {
    chrome.storage.local.get(CYCLE_LAYOUT_KEY, (result) => {
      const saved = result[CYCLE_LAYOUT_KEY] ?? {};
      resolve({
        order: dedupeCycles(saved.order ?? []),
        hidden: dedupeCycles(saved.hidden ?? []),
      });
    });
  });
}

export async function saveCycleLayout(layout: CycleLayout): Promise<void> {
  const next: CycleLayout = {
    order: dedupeCycles(layout.order),
    hidden: dedupeCycles(layout.hidden),
  };
  return new Promise((resolve) => {
    chrome.storage.local.set({ [CYCLE_LAYOUT_KEY]: next }, resolve);
  });
}

export async function getManualOutcomes(): Promise<ManualOutcome[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(MANUAL_OUTCOMES_KEY, (result) => {
      resolve(result[MANUAL_OUTCOMES_KEY] ?? []);
    });
  });
}

export async function addManualOutcome(input: { cycle: string; company: string; type: ManualOutcomeType }): Promise<ManualOutcome> {
  const outcomes = await getManualOutcomes();
  const company = input.company.trim();
  const cycle = input.cycle.trim();
  const existing = outcomes.find((outcome) =>
    outcome.cycle.trim().toLowerCase() === cycle.toLowerCase() &&
    outcome.company.trim().toLowerCase() === company.toLowerCase() &&
    outcome.type === input.type
  );
  if (existing) return existing;

  const outcome: ManualOutcome = {
    id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
    cycle,
    company,
    type: input.type,
    created_at: new Date().toISOString(),
  };
  return new Promise((resolve) => {
    chrome.storage.local.set({ [MANUAL_OUTCOMES_KEY]: [...outcomes, outcome] }, () => resolve(outcome));
  });
}

export async function removeManualOutcome(id: string): Promise<void> {
  const outcomes = await getManualOutcomes();
  return new Promise((resolve) => {
    chrome.storage.local.set({ [MANUAL_OUTCOMES_KEY]: outcomes.filter((outcome) => outcome.id !== id) }, resolve);
  });
}

export async function getTrustedOutcomes<T = Record<string, unknown>>(): Promise<T> {
  return new Promise((resolve) => {
    chrome.storage.local.get(TRUSTED_OUTCOMES_KEY, (result) => {
      resolve((result[TRUSTED_OUTCOMES_KEY] ?? {}) as T);
    });
  });
}

export async function saveTrustedOutcomes(outcomes: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [TRUSTED_OUTCOMES_KEY]: outcomes }, resolve);
  });
}

function seedKey(app: Pick<Application, 'company' | 'role'> & { recruitment_cycle?: string | null }): string {
  return [
    app.recruitment_cycle ?? 'Unassigned',
    app.company.trim().toLowerCase(),
    app.role.trim().toLowerCase(),
  ].join('|');
}

function normalized(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function seedExactKey(cycle: string, company: string, role: string): string {
  return [cycle, normalized(company), normalized(role)].join('|');
}

function statusResembles(current: ApplicationStatus, target: ApplicationStatus): boolean {
  if (current === target) return true;
  if (target === 'interview') return current === 'phone_screen';
  if (target === 'rejected') return current === 'ghosted';
  return false;
}

function seedNotes(existing: string, record: SeedRecord): string {
  const additions = [
    record.interview_at ? `Interview: ${record.interview_at}` : '',
    record.notes ?? '',
  ].filter(Boolean);
  if (additions.length === 0) return existing;

  const parts = existing ? [existing] : [];
  additions.forEach((note) => {
    if (!existing.toLowerCase().includes(note.toLowerCase())) parts.push(note);
  });
  return parts.join('\n').trim();
}

function backupApplications(apps: Application[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [`lane_seed_backup_${Date.now()}`]: apps }, resolve);
  });
}

export async function seedKnownApplications(cycle: string, records: SeedRecord[]): Promise<{ imported: number; updated: number; total: number }> {
  const apps = await getApplications();
  await backupApplications(apps);

  const now = new Date().toISOString();
  const claimed = new Set<number>();
  const exact = new Map<string, number[]>();
  const byCompany = new Map<string, number[]>();

  apps.forEach((app, index) => {
    if ((app.recruitment_cycle ?? 'Unassigned') !== cycle) return;
    const companyKey = normalized(app.company);
    const exactKey = seedExactKey(cycle, app.company, app.role);
    exact.set(exactKey, [...(exact.get(exactKey) ?? []), index]);
    byCompany.set(companyKey, [...(byCompany.get(companyKey) ?? []), index]);
  });

  function pickIndex(record: SeedRecord): number | undefined {
    const role = record.role?.trim();
    const candidates = role
      ? exact.get(seedExactKey(cycle, record.company, role)) ?? []
      : byCompany.get(normalized(record.company)) ?? [];
    const available = candidates.filter((index) => !claimed.has(index));
    if (available.length === 0) return undefined;
    return available.find((index) => statusResembles(apps[index].status, record.status)) ?? available[0];
  }

  let imported = 0;
  let updated = 0;

  for (const record of records) {
    const idx = pickIndex(record);
    if (idx !== undefined) {
      claimed.add(idx);
      const existing = apps[idx];
      apps[idx] = {
        ...existing,
        status: record.status,
        status_source: 'manual',
        applied_at: existing.applied_at ?? record.applied_at ?? null,
        notes: seedNotes(existing.notes ?? '', record),
        updated_at: now,
      };
      updated += 1;
      continue;
    }

    const role = record.role?.trim() || 'Role not specified';
    apps.push({
      id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
      company: record.company,
      role,
      location: null,
      job_url: '',
      source: 'other',
      detection_tier: 'manual',
      status: record.status,
      resume_version: null,
      notes: seedNotes('', record),
      applied_at: record.applied_at ?? null,
      captured_at: now,
      updated_at: now,
      next_followup_at: null,
      recruitment_cycle: cycle,
      status_source: 'manual',
    });
    const newIndex = apps.length - 1;
    claimed.add(newIndex);
    const companyKey = normalized(record.company);
    exact.set(seedExactKey(cycle, record.company, role), [...(exact.get(seedExactKey(cycle, record.company, role)) ?? []), newIndex]);
    byCompany.set(companyKey, [...(byCompany.get(companyKey) ?? []), newIndex]);
    imported += 1;
  }

  await replaceApplications(apps);
  return { imported, updated, total: apps.length };
}

export async function importWinter2026WorkbookSeed(): Promise<{ imported: number; updated: number; total: number }> {
  const apps = await getApplications();
  const byKey = new Map(apps.map((app, index) => [seedKey(app), index]));
  let imported = 0;
  let updated = 0;
  const now = new Date().toISOString();

  for (const record of WINTER_2026_SEED) {
    const key = seedKey(record);
    const notes = [
      record.notes,
      `Workbook status: ${record.rawStatus}`,
      record.interview_at ? `Interview date: ${record.interview_at}` : '',
    ].filter(Boolean).join(' | ');
    const existingIndex = byKey.get(key);

    if (existingIndex === undefined) {
      apps.push({
        id: record.id,
        company: record.company,
        role: record.role,
        location: null,
        job_url: '',
        source: 'other',
        detection_tier: 'manual',
        status: record.status,
        resume_version: null,
        notes,
        applied_at: record.applied_at,
        captured_at: record.applied_at ? new Date(record.applied_at).toISOString() : now,
        updated_at: now,
        next_followup_at: null,
        recruitment_cycle: 'Winter 2026',
        status_source: 'manual',
      });
      byKey.set(key, apps.length - 1);
      imported += 1;
      continue;
    }

    const existing = apps[existingIndex];
    apps[existingIndex] = {
      ...existing,
      status: existing.status === 'offer' ? existing.status : record.status,
      recruitment_cycle: 'Winter 2026',
      applied_at: existing.applied_at ?? record.applied_at,
      notes: existing.notes || notes,
      updated_at: now,
    };
    updated += 1;
  }

  await replaceApplications(apps);
  return { imported, updated, total: apps.length };
}

export async function padCycleApplied(cycle: string, targetTotal: number): Promise<{ added: number; total: number }> {
  const apps = await getApplications();
  const cycleCount = apps.filter((a) => (a.recruitment_cycle ?? 'Unassigned') === cycle).length;
  const toAdd = Math.max(0, targetTotal - cycleCount);
  if (toAdd === 0) return { added: 0, total: cycleCount };
  const now = new Date().toISOString();
  for (let i = 0; i < toAdd; i++) {
    apps.push({
      id: crypto.randomUUID(),
      company: '—',
      role: 'Application',
      location: null,
      job_url: '',
      source: 'other',
      detection_tier: 'manual',
      status: 'applied',
      resume_version: null,
      notes: '',
      applied_at: null,
      captured_at: now,
      updated_at: now,
      next_followup_at: null,
      recruitment_cycle: cycle,
      status_source: 'manual',
    });
  }
  await replaceApplications(apps);
  return { added: toAdd, total: apps.filter((a) => (a.recruitment_cycle ?? 'Unassigned') === cycle).length };
}

// ---------------------------------------------------------------------------
// CSV export / import
// ---------------------------------------------------------------------------

const CSV_COLS = [
  'id', 'company', 'role', 'location', 'job_url', 'status',
  'resume_version', 'notes', 'applied_at', 'recruitment_cycle', 'source',
] as const;

function csvQuote(value: unknown): string {
  const str = value == null ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current);
  return result;
}

export function exportApplicationsToCSV(apps: Application[]): string {
  const header = CSV_COLS.join(',');
  const rows = apps.map((app) =>
    CSV_COLS.map((col) => csvQuote((app as Record<string, unknown>)[col])).join(','),
  );
  return [header, ...rows].join('\n');
}

const VALID_STATUSES = new Set<string>([
  'saved', 'applied', 'phone_screen', 'interview', 'offer', 'rejected', 'withdrew', 'ghosted',
]);
const VALID_SOURCES = new Set<string>([
  'linkedin', 'indeed', 'greenhouse', 'lever', 'workday', 'ashby', 'company_site', 'other',
]);

export async function importFromCSV(csvText: string): Promise<{ imported: number; updated: number; errors: string[] }> {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length < 2) return { imported: 0, updated: 0, errors: ['File empty or has no data rows'] };

  const headers = parseCSVRow(lines[0]);
  const apps = await getApplications();
  const now = new Date().toISOString();
  let imported = 0;
  let updated = 0;
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const values = parseCSVRow(line);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h.trim()] = (values[idx] ?? '').trim(); });

      const company = row.company;
      const role = row.role;
      if (!company) { errors.push(`Row ${i + 1}: missing company`); continue; }

      const status = row.status;
      if (status && !VALID_STATUSES.has(status)) {
        errors.push(`Row ${i + 1}: invalid status "${status}" — skipped`);
        continue;
      }
      const source = row.source;
      if (source && !VALID_SOURCES.has(source)) {
        errors.push(`Row ${i + 1}: invalid source "${source}" — using "other"`);
      }

      // Match by id first, then company+role+cycle
      let idx = row.id ? apps.findIndex((a) => a.id === row.id) : -1;
      if (idx < 0 && company && role) {
        const cycle = row.recruitment_cycle || null;
        idx = apps.findIndex((a) =>
          a.company.trim().toLowerCase() === company.toLowerCase() &&
          a.role.trim().toLowerCase() === role.toLowerCase() &&
          (cycle ? (a.recruitment_cycle ?? 'Unassigned') === cycle : true),
        );
      }

      if (idx >= 0) {
        const ex = apps[idx];
        apps[idx] = {
          ...ex,
          company: company || ex.company,
          role: role || ex.role,
          location: row.location || ex.location,
          job_url: row.job_url || ex.job_url,
          status: (VALID_STATUSES.has(status) ? status : ex.status) as ApplicationStatus,
          resume_version: row.resume_version || ex.resume_version,
          notes: row.notes !== undefined && row.notes !== '' ? row.notes : ex.notes,
          applied_at: row.applied_at || ex.applied_at,
          recruitment_cycle: row.recruitment_cycle || ex.recruitment_cycle,
          source: (VALID_SOURCES.has(source) ? source : ex.source) as JobSource,
          updated_at: now,
        };
        updated++;
      } else {
        apps.push({
          id: row.id || (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)),
          company,
          role: role || 'Unknown role',
          location: row.location || null,
          job_url: row.job_url || '',
          source: (VALID_SOURCES.has(source) ? source : 'other') as JobSource,
          detection_tier: 'manual',
          status: (VALID_STATUSES.has(status) ? status : 'applied') as ApplicationStatus,
          resume_version: row.resume_version || null,
          notes: row.notes || '',
          applied_at: row.applied_at || null,
          captured_at: now,
          updated_at: now,
          next_followup_at: null,
          recruitment_cycle: row.recruitment_cycle || null,
          status_source: 'manual',
        });
        imported++;
      }
    } catch (e) {
      errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : 'parse error'}`);
    }
  }

  await replaceApplications(apps);
  return { imported, updated, errors };
}
