export type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'phone_screen'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'withdrew'
  | 'ghosted';

export type DetectionTier = 'tier1' | 'tier2' | 'manual';
export type JobSource = 'linkedin' | 'indeed' | 'greenhouse' | 'lever' | 'workday' | 'ashby' | 'company_site' | 'other';

export interface DetectedJob {
  company: string | null;
  role: string | null;
  location: string | null;
  description: string;
  url: string;
  source: JobSource;
  tier: DetectionTier;
}

export interface Application {
  id: string;
  company: string;
  role: string;
  location: string | null;
  job_url: string;
  source: JobSource;
  detection_tier: DetectionTier;
  status: ApplicationStatus;
  resume_version: string | null;
  notes: string;
  applied_at: string | null;
  captured_at: string;
  updated_at: string;
  next_followup_at: string | null;
  recruitment_cycle?: string | null;
  gmail_message_id?: string | null;
  gmail_thread_id?: string | null;
  gmail_label_source?: string | null;
  status_source?: 'manual' | 'detector' | 'gmail' | null;
  last_email_subject?: string | null;
  last_email_from?: string | null;
  last_email_at?: string | null;
}

export interface GmailSyncSettings {
  labelPrefix: string;
  labelRoot: string;
  activeCycle: string;
  interviewLabelName: string;
  rejectedLabelName: string;
  offerLabelName: string;
  sentLabelName: string;
  autoDetectCycle: boolean;
  createApplicationsFromEmail: boolean;
  lookbackDays: number;
  autoLabel: boolean;
  syncExistingFoldersOnly: boolean;
}

export interface GmailSyncHit {
  messageId: string;
  threadId: string;
  subject: string;
  from: string;
  date: string | null;
  snippet: string;
  detectedStatus: 'interview' | 'rejected' | 'offer' | 'applied';
  applicationId: string | null;
  company: string | null;
  role: string | null;
  recruitmentCycle: string;
  gmailLabel: string;
}

export interface GmailSyncResult {
  scanned: number;
  matched: number;
  updated: number;
  labeled: number;
  hits: GmailSyncHit[];
  notice?: string;
  error?: string;
  cycleStats?: Record<string, { scanned: number; updated: number; lastSyncedAt: string }>;
}

export interface GmailAuthDiagnostics {
  extensionId: string;
  redirectUrl: string;
  manifestClientId: string | null;
  scopes: string[];
  hasIdentityApi: boolean;
  profileEmail?: string;
  profileId?: string;
  error?: string;
}
