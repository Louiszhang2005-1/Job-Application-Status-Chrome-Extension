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
}
