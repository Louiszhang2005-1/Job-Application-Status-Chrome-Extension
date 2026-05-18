import type { ApplicationStatus } from './types';

export interface SeedRecord {
  company: string;
  role?: string;
  status: ApplicationStatus;
  applied_at?: string | null;
  interview_at?: string | null;
  notes?: string;
}

export interface Winter2026SeedRecord {
  id: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  rawStatus: string;
  applied_at: string | null;
  interview_at: string | null;
  notes: string;
  source: string;
  recruitment_cycle: 'Winter 2026';
}

// Seed data removed from public source. Import via CSV or Data Tools in the dashboard.
export const WINTER_2026_SEED: Winter2026SeedRecord[] = [];

export const SUMMER_2025_KNOWN: SeedRecord[] = [];

export const WINTER_2026_KNOWN: SeedRecord[] = [];

export const SUMMER_2026_KNOWN: SeedRecord[] = [];
