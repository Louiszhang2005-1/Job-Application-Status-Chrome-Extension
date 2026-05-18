import type { Application, ApplicationStatus, GmailAuthDiagnostics, GmailSyncHit, GmailSyncResult, GmailSyncSettings } from './types';
import { getApplications, replaceApplications, getCycleSyncState, setCycleSyncForCycle } from './storage';

const API_ROOT = 'https://gmail.googleapis.com/gmail/v1/users/me';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

// Known ATS provider domains — email from these does not identify the actual employer
const ATS_DOMAINS = new Set([
  'workday', 'greenhouse', 'lever', 'ashby', 'icims', 'taleo', 'smartrecruiters',
  'jobvite', 'myworkdayjobs', 'bamboohr', 'breezy', 'recruitee', 'workable',
  'comeet', 'rippling', 'successfactors', 'kenexa', 'cornerstone', 'jobscore',
  'jazzhr', 'pinpoint', 'teamtailor', 'personio', 'hi',
]);

type GmailLabel = {
  id: string;
  name: string;
};

type GmailMessageListItem = {
  id: string;
  threadId: string;
};

type GmailHeader = {
  name: string;
  value: string;
};

type GmailMessage = {
  id: string;
  threadId: string;
  snippet?: string;
  payload?: {
    headers?: GmailHeader[];
    mimeType?: string;
    body?: {
      data?: string;
    };
    parts?: GmailMessage['payload'][];
  };
};

type EmailJobInfo = {
  company: string | null;
  role: string | null;
};

type GmailDetectedStatus = 'interview' | 'rejected' | 'offer' | 'applied';

type FolderScanTarget = {
  labelName: string;
  status: GmailDetectedStatus;
  cycle: string;
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  try {
    return decodeURIComponent(escape(atob(padded)));
  } catch {
    return atob(padded);
  }
}

function stripHtml(value: string): string {
  const doc = new DOMParser().parseFromString(value, 'text/html');
  return doc.body.textContent ?? value.replace(/<[^>]+>/g, ' ');
}

function payloadText(payload: GmailMessage['payload']): string {
  if (!payload) return '';
  const current = payload.body?.data
    ? (payload.mimeType === 'text/html' ? stripHtml(decodeBase64Url(payload.body.data)) : decodeBase64Url(payload.body.data))
    : '';
  const children = payload.parts?.map(payloadText).join(' ') ?? '';
  return `${current} ${children}`.replace(/\s+/g, ' ').trim();
}

function header(message: GmailMessage, name: string): string {
  return message.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function shouldMoveToStatus(current: ApplicationStatus, next: GmailDetectedStatus): boolean {
  if (current === 'offer' || current === 'withdrew') return false;
  if (next === 'offer') return current !== 'offer';
  if (next === 'rejected') return current !== 'rejected';
  if (next === 'applied') return current === 'saved';
  return !['interview', 'offer', 'rejected'].includes(current);
}

function classifyEmail(text: string): 'interview' | 'rejected' | null {
  const normalized = normalizeText(text);

  const rejectionPatterns = [
    'unfortunately',
    'not moving forward',
    'not move forward',
    'decided to move forward with other candidates',
    'pursue other candidates',
    'will not be proceeding',
    'not selected',
    'no longer under consideration',
    'after careful consideration',
    'we regret',
  ];
  const interviewPatterns = [
    'schedule an interview',
    'invite you to interview',
    'interview invitation',
    'next step',
    'next steps',
    'availability for an interview',
    'phone screen',
    'technical interview',
    'onsite interview',
    'meet with the team',
    'speak with you',
  ];

  if (rejectionPatterns.some((pattern) => normalized.includes(normalizeText(pattern)))) return 'rejected';
  if (interviewPatterns.some((pattern) => normalized.includes(normalizeText(pattern)))) return 'interview';
  return null;
}

function tokenOverlapScore(needle: string, haystack: string): number {
  const haystackNormalized = normalizeText(haystack);
  const tokens = normalizeText(needle)
    .split(' ')
    .filter((token) => token.length > 2 && !['the', 'and', 'for', 'with', 'internship', 'intern', 'position', 'application'].includes(token));
  return tokens.reduce((score, token) => score + (haystackNormalized.includes(token) ? 1 : 0), 0);
}

function companyFromAddress(from: string): string | null {
  const emailMatch = from.match(/<([^>]+)>/);
  const email = emailMatch ? emailMatch[1] : from.trim();
  const atIdx = email.indexOf('@');
  if (atIdx < 0) return null;
  const domain = email.slice(atIdx + 1).toLowerCase();
  const parts = domain.split('.');
  const domainRoot = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  if (ATS_DOMAINS.has(domainRoot)) return null;
  // Skip obvious system/notification domains
  if (/^(mail|email|noreply|no-reply|notify|notifications?|bounce|info|support|donotreply|do-not-reply)$/.test(domainRoot)) return null;
  const cleaned = domainRoot.replace(/[-_]/g, ' ');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function findMatchingApplication(
  apps: Application[],
  messageText: string,
  emailInfo: EmailJobInfo,
  fromDomain: string | null,
  cycleConstraint?: string,
  threadId?: string,
): Application | null {
  const pool = cycleConstraint
    ? apps.filter((app) => (app.recruitment_cycle ?? 'Unassigned') === cycleConstraint)
    : apps;

  // Strongest signal: same Gmail thread (rejection/interview reply to original application)
  if (threadId) {
    const threadMatch = pool.find((app) => app.gmail_thread_id === threadId);
    if (threadMatch) return threadMatch;
  }

  const normalized = normalizeText(messageText);
  const normalizedFromDomain = fromDomain ? normalizeText(fromDomain) : null;
  const threshold = cycleConstraint ? 7 : 10;
  const candidates = pool
    .map((app) => {
      const company = normalizeText(app.company);
      const role = normalizeText(app.role);
      let score = 0;
      if (company && normalized.includes(company)) score += 10;
      if (role && role.length > 5 && normalized.includes(role)) score += 4;
      if (emailInfo.company && normalizeText(app.company).includes(normalizeText(emailInfo.company))) score += 8;
      if (normalizedFromDomain && company && company.includes(normalizedFromDomain)) score += 5;
      if (emailInfo.role) score += tokenOverlapScore(app.role, emailInfo.role);
      return { app, score };
    })
    .filter((item) => item.score >= threshold)
    .sort((a, b) => b.score - a.score);

  // Ambiguous: multiple apps score equally with no role discriminating → don't guess
  const top = candidates[0]?.score ?? 0;
  const topTied = candidates.filter((c) => c.score === top);
  if (topTied.length > 1) return null;

  return candidates[0]?.app ?? null;
}

function displayNameFromFromHeader(from: string): string | null {
  const cleaned = from.replace(/<[^>]+>/g, '').replace(/"/g, '').trim();
  if (!cleaned || /^(no-?reply|do-?not-?reply|noreply|notification|mailer-daemon)/i.test(cleaned)) return null;
  return cleaned;
}

function extractEmailJobInfo(subject: string, from: string, body: string): EmailJobInfo {
  const text = `${subject} ${body}`.replace(/\s+/g, ' ');
  // Each pattern may specify role group index, company group index, or both.
  // We run all patterns, accumulating the first non-null role and company found.
  const patterns: Array<{ role?: number; company?: number; re: RegExp }> = [
    // Role + company
    { role: 1, company: 2, re: /interest in (?:the )?(.{4,160}?) position at ([A-Z][A-Za-z0-9&.,' -]{2,80})\b/i },
    { role: 1, company: 2, re: /application for (?:the )?(.{4,160}?) position with ([A-Z][A-Za-z0-9&.,' -]{2,80})\b/i },
    { role: 1, company: 2, re: /thank you for applying (?:to|for) (?:the )?(.{4,160}?) (?:position )?(?:at|with) ([A-Z][A-Za-z0-9&.,' -]{2,80})\b/i },
    // Company-only (LinkedIn "sent to" / "applied to" patterns)
    { company: 1, re: /(?:your application was sent to|applied to) ([A-Z][A-Za-z0-9&.,' \-]{2,80})/i },
    // Role-only — "position of X" (dominant ATS phrasing: BTALENT, BambooHR, Workday)
    // Terminator stops before " (Summer/Winter..." season suffix or dash/newline
    { role: 1, re: /(?:applying for|applied for) (?:the )?position of ([^(\n]{4,160}?)(?:\s*[-(\n]|\s+\((?:Summer|Winter|Fall|Spring)|$)/i },
    { role: 1, re: /(?:thank you for applying for|applying for) (?:the )?position of ([^(\n]{4,160}?)(?:\s*[-(\n]|\s+\((?:Summer|Winter|Fall|Spring)|$)/i },
    { role: 1, re: /position of ([^(\n]{4,160}?)(?:\s*[-(\n]|\s+\((?:Summer|Winter|Fall|Spring)|$)/i },
    // Workday open position: "open position (01748475 Stage - Role Name)"
    { role: 1, re: /open position\s*\(\s*\d*\s*(?:Stage|Internship|Intern)[\s\-]+([^)]{4,160}?)\)/i },
    // Role-only fallbacks
    { role: 1, re: /your application for (?:the )?(.{4,160}?) (?:position|role)\b/i },
    { role: 1, re: /application for (?:the )?(.{4,160}?) (?:internship|stage)\b/i },
    { role: 1, re: /interest in (?:the )?(.{4,160}?) (?:internship|stage|role|position)\b/i },
  ];

  let role: string | null = null;
  let company: string | null = null;

  for (const pattern of patterns) {
    if (role != null && company != null) break;
    const match = text.match(pattern.re);
    if (!match) continue;
    if (pattern.role != null && role == null) {
      role = match[pattern.role]?.replace(/\s+at\s+$/i, '').replace(/\s+with\s+$/i, '').trim() ?? null;
    }
    if (pattern.company != null && company == null) {
      company = match[pattern.company]?.replace(/[.,].*$/, '').trim() ?? null;
    }
  }

  // Domain is more reliable than display name (e.g. "Bombardier" from @bombardier.com > "BTALENT Administrator")
  if (!company) company = companyFromAddress(from);
  if (!company) company = displayNameFromFromHeader(from);

  if (!company && /tesla/i.test(text)) company = 'Tesla';

  return { company, role };
}

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function createApplicationFromEmail(info: EmailJobInfo, status: GmailDetectedStatus, message: GmailMessage, subject: string, from: string, date: string | null, cycle: string, sourceLabel: string | null): Application {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    company: info.company || 'Unknown company',
    role: info.role || subject || 'Unknown role',
    location: null,
    job_url: `https://mail.google.com/mail/u/0/#inbox/${message.threadId}`,
    source: 'other',
    detection_tier: 'manual',
    status,
    resume_version: null,
    notes: 'Created from Gmail sync',
    applied_at: status === 'applied' && date ? new Date(date).toISOString() : null,
    captured_at: date ? new Date(date).toISOString() : now,
    updated_at: now,
    next_followup_at: null,
    recruitment_cycle: cycle,
    gmail_message_id: message.id,
    gmail_thread_id: message.threadId,
    gmail_label_source: sourceLabel,
    status_source: 'gmail',
    last_email_subject: subject,
    last_email_from: from,
    last_email_at: date,
  };
}

function cleanLabelPart(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^\/+|\/+$/g, '')
    .trim();
}

function normalizeLabelPart(value: string): string {
  return cleanLabelPart(value).toLowerCase();
}

function rootAliases(root: string): string[] {
  return Array.from(new Set([
    root,
    'Internships applications',
    'Internship Applications',
  ].filter(Boolean).map(cleanLabelPart)));
}

function detectRecruitmentCycle(text: string, fallback: string): string {
  const match = text.match(/\b(summer|winter|fall|autumn|spring)\s+(20\d{2})\b/i);
  if (!match) return fallback;
  const season = match[1].toLowerCase() === 'autumn'
    ? 'Fall'
    : match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
  return `${season} ${match[2]}`;
}

function labelPathParts(name: string): string[] {
  return name.split('/').map(cleanLabelPart).filter(Boolean);
}

function resolveExistingLabel(labels: GmailLabel[], rootNames: string[], cycle: string, folderNames: string[]): GmailLabel | null {
  const normalizedRoots = rootNames.map(normalizeLabelPart);
  const normalizedCycle = normalizeLabelPart(cycle);
  const normalizedFolders = folderNames.map(normalizeLabelPart);
  return labels.find((label) => {
    const parts = labelPathParts(label.name);
    if (parts.length < 2 || !normalizedRoots.includes(normalizeLabelPart(parts[0]))) return false;
    // 3-level: root/cycle/folder
    if (parts.length >= 3) {
      return (
        normalizeLabelPart(parts[1]) === normalizedCycle &&
        normalizedFolders.includes(normalizeLabelPart(parts.slice(2).join('/')))
      );
    }
    // 2-level: root/folderWithCycle (e.g. "Email Sent Summer 2025")
    const folderPart = normalizeLabelPart(parts[1]);
    return normalizedFolders.some((f) =>
      folderPart === f ||
      folderPart === normalizeLabelPart(`${f} ${cycle}`) ||
      folderPart === normalizeLabelPart(`${cycle} ${f}`)
    );
  }) ?? null;
}

function labelTemplateCandidates(template: string, cycle: string, fallbacks: string[]): string[] {
  const cleanTemplate = cleanLabelPart(template || '');
  const expanded = cleanTemplate.replace(/\{cycle\}/g, cycle);
  return Array.from(new Set([expanded, cleanTemplate, ...fallbacks].filter(Boolean).map(cleanLabelPart)));
}

function buildGmailLabel(settings: GmailSyncSettings, status: GmailDetectedStatus, cycle: string): string {
  const root = cleanLabelPart(settings.labelRoot || settings.labelPrefix || 'Internships applications');
  const statusTemplate =
    status === 'interview' ? settings.interviewLabelName || 'Interviews'
      : status === 'offer' ? settings.offerLabelName || 'Offers'
        : status === 'applied' ? settings.sentLabelName || 'Applications'
          : settings.rejectedLabelName || 'Rejections';
  const statusLabel = cleanLabelPart(statusTemplate.replace(/\{cycle\}/g, cycle));
  const cycleLabel = cleanLabelPart(cycle || settings.activeCycle || 'General');
  return [root, cycleLabel, statusLabel].filter(Boolean).join('/');
}

function getExistingFolderTargets(settings: GmailSyncSettings, labels: GmailLabel[]): FolderScanTarget[] {
  const root = cleanLabelPart(settings.labelRoot || settings.labelPrefix || 'Internships applications');
  const roots = rootAliases(root);
  const normalizedRoots = roots.map(normalizeLabelPart);
  const cycles = new Set<string>();
  labels.forEach((label) => {
    const parts = labelPathParts(label.name);
    if (parts.length < 2 || !normalizedRoots.includes(normalizeLabelPart(parts[0]))) return;
    if (parts.length >= 3 && parts[1]) {
      cycles.add(parts[1]);
    } else if (parts.length === 2) {
      // 2-level label: root/folderWithCycleInName — extract cycle from folder name
      const detected = detectRecruitmentCycle(parts[1], '');
      if (detected) cycles.add(detected);
    }
  });
  if (settings.activeCycle.trim()) cycles.add(settings.activeCycle.trim());

  const targets: FolderScanTarget[] = [];
  cycles.forEach((cycle) => {
    const specs: Array<{ status: GmailDetectedStatus; candidates: string[] }> = [
      {
        status: 'rejected',
        candidates: labelTemplateCandidates(settings.rejectedLabelName, cycle, [
          'Rejections',
          `Rejection letters For ${cycle}`,
          `${cycle} rejections`,
          'rejections',
        ]),
      },
      {
        status: 'applied',
        candidates: labelTemplateCandidates(settings.sentLabelName, cycle, [
          'Applications',
          'Email Sent',
          `Email Sent ${cycle}`,
          'Robotics intern appl...',
        ]),
      },
    ];

    specs.forEach((spec) => {
      const label = resolveExistingLabel(labels, roots, cycle, spec.candidates);
      if (!label) return;
      targets.push({ labelName: label.name, status: spec.status, cycle });
    });
  });

  return targets;
}

function getChromeAuthToken(interactive: boolean): Promise<string> {
  if (!chrome.identity?.getAuthToken) {
    return Promise.reject(new Error('Chrome identity API is unavailable. Open this from the installed Lane extension dashboard, not a normal browser tab.'));
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('Google sign-in timed out. Confirm the OAuth Chrome extension ID matches this installed extension, then reload Lane in chrome://extensions.'));
    }, 45000);

    chrome.identity.getAuthToken({ interactive }, (result) => {
      window.clearTimeout(timeout);
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }

      const token = typeof result === 'string' ? result : result?.token;
      if (!token) {
        reject(new Error('Gmail did not return an access token. Check your OAuth client ID, extension ID, and OAuth test users.'));
        return;
      }

      resolve(token);
    });
  });
}

function launchOAuthFlow(interactive: boolean): Promise<string> {
  const manifest = chrome.runtime.getManifest();
  const clientId = manifest.oauth2?.client_id;
  const scopes = manifest.oauth2?.scopes ?? [];
  if (!clientId) {
    return Promise.reject(new Error('Missing oauth2.client_id in manifest.json.'));
  }

  const redirectUrl = chrome.identity.getRedirectURL();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'token',
    redirect_uri: redirectUrl,
    scope: scopes.join(' '),
    include_granted_scopes: 'true',
    prompt: 'consent',
  });

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({
      url: `${GOOGLE_AUTH_URL}?${params.toString()}`,
      interactive,
    }, (responseUrl) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }

      if (!responseUrl) {
        reject(new Error('Google did not return an OAuth response URL.'));
        return;
      }

      const fragment = responseUrl.split('#')[1] ?? '';
      const query = responseUrl.split('?')[1] ?? '';
      const responseParams = new URLSearchParams(fragment || query);
      const error = responseParams.get('error');
      if (error) {
        reject(new Error(`${error}: ${responseParams.get('error_description') ?? 'Google rejected the OAuth request.'}`));
        return;
      }

      const token = responseParams.get('access_token');
      if (!token) {
        reject(new Error('Google OAuth completed but did not return an access token.'));
        return;
      }

      resolve(token);
    });
  });
}

async function getAuthToken(interactive: boolean): Promise<string> {
  if (interactive) return launchOAuthFlow(true);
  return getChromeAuthToken(false);
}

function removeCachedAuthToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

function clearAllCachedAuthTokens(): Promise<void> {
  return new Promise((resolve) => {
    chrome.identity.clearAllCachedAuthTokens(() => resolve());
  });
}

function getProfileUserInfo(): Promise<chrome.identity.UserInfo> {
  return new Promise((resolve) => {
    chrome.identity.getProfileUserInfo((info) => resolve(info));
  });
}

async function gmailFetch<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 401) {
    await removeCachedAuthToken(token);
    throw new Error('Gmail authorization expired. Try Connect Gmail again.');
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gmail API error ${response.status}: ${detail || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function listLabels(token: string): Promise<GmailLabel[]> {
  const response = await gmailFetch<{ labels?: GmailLabel[] }>('/labels', token);
  return response.labels ?? [];
}

async function ensureLabel(token: string, name: string): Promise<string> {
  const labels = await listLabels(token);
  const existing = labels.find((label) => label.name === name);
  if (existing) return existing.id;

  const created = await gmailFetch<GmailLabel>('/labels', token, {
    method: 'POST',
    body: JSON.stringify({
      name,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    }),
  });
  return created.id;
}

async function labelMessage(token: string, messageId: string, labelId: string): Promise<void> {
  await gmailFetch(`/messages/${encodeURIComponent(messageId)}/modify`, token, {
    method: 'POST',
    body: JSON.stringify({ addLabelIds: [labelId] }),
  });
}

async function getMessage(token: string, messageId: string): Promise<GmailMessage> {
  const params = new URLSearchParams({
    format: 'full',
    metadataHeaders: 'Subject',
  });
  params.append('metadataHeaders', 'From');
  params.append('metadataHeaders', 'Date');
  return gmailFetch<GmailMessage>(`/messages/${encodeURIComponent(messageId)}?${params}`, token);
}

async function listAllMessagesForLabel(token: string, labelId: string, query: string): Promise<GmailMessageListItem[]> {
  const messages: GmailMessageListItem[] = [];
  let pageToken: string | undefined;
  do {
    const searchParams = new URLSearchParams({ labelIds: labelId, q: query, maxResults: '500' });
    if (pageToken) searchParams.set('pageToken', pageToken);
    const list = await gmailFetch<{ messages?: GmailMessageListItem[]; nextPageToken?: string }>(`/messages?${searchParams}`, token);
    messages.push(...(list.messages ?? []));
    pageToken = list.nextPageToken;
  } while (pageToken);
  return messages;
}

export async function connectGmail(): Promise<void> {
  await launchOAuthFlow(true);
}

export async function disconnectGmail(): Promise<void> {
  await clearAllCachedAuthTokens();
}

export async function getGmailAuthDiagnostics(): Promise<GmailAuthDiagnostics> {
  const manifest = chrome.runtime.getManifest();
  const base: GmailAuthDiagnostics = {
    extensionId: chrome.runtime.id,
    redirectUrl: chrome.identity?.getRedirectURL?.() ?? 'Unavailable',
    manifestClientId: manifest.oauth2?.client_id ?? null,
    scopes: manifest.oauth2?.scopes ?? [],
    hasIdentityApi: !!chrome.identity?.getAuthToken,
  };

  try {
    const profile = await getProfileUserInfo();
    return {
      ...base,
      profileEmail: profile.email || '(Chrome profile email is hidden or unavailable)',
      profileId: profile.id || '(Chrome profile id unavailable)',
    };
  } catch (error) {
    return {
      ...base,
      error: error instanceof Error ? error.message : 'Could not read Chrome identity diagnostics',
    };
  }
}

export async function syncGmail(settings: GmailSyncSettings, options?: { resetCycles?: string[] }): Promise<GmailSyncResult> {
  try {
    const syncStartedAt = new Date().toISOString();
    const token = await getAuthToken(true);
    const apps = await getApplications();
    const activeCycle = settings.activeCycle.trim() || 'Summer 2026';
    const lookback = Math.max(1, Math.min(settings.lookbackDays || 180, 730));
    const labels = await listLabels(token);

    // Load cycle sync state; clear any cycles being force-reset
    const cycleSyncState = await getCycleSyncState();
    if (options?.resetCycles) {
      for (const cycle of options.resetCycles) {
        delete cycleSyncState[cycle];
      }
    }

    let folderTargets = settings.syncExistingFoldersOnly
      ? getExistingFolderTargets(settings, labels)
      : [];
    if (settings.activeCycle.trim()) {
      const activeCycleOnly = settings.activeCycle.trim();
      folderTargets = folderTargets.filter((target) => target.cycle === activeCycleOnly);
    }

    if (settings.syncExistingFoldersOnly && folderTargets.length === 0) {
      return {
        scanned: 0,
        matched: 0,
        updated: 0,
        labeled: 0,
        hits: [],
        notice: 'No matching Gmail folders found under "' + (settings.labelRoot || 'Internships applications') + '".',
      };
    }

    const fallbackQuery = [
      `newer_than:${lookback}d`,
      '(unfortunately OR "not moving forward" OR "not selected" OR "no longer under consideration" OR "after careful consideration")',
    ].join(' ');

    const hits: GmailSyncHit[] = [];
    const updatedApps = [...apps];
    let updated = 0;
    let labeled = 0;
    let scanned = 0;

    const labelIds = new Map<string, string>();
    const itemsToProcess: Array<GmailMessageListItem & { forcedStatus?: GmailDetectedStatus; forcedCycle?: string; sourceLabel?: string }> = [];

    if (settings.syncExistingFoldersOnly) {
      for (const target of folderTargets) {
        const label = labels.find((candidate) => candidate.name.toLowerCase() === target.labelName.toLowerCase());
        if (!label) continue;

        // Incremental: use after:EPOCH when cycle was previously synced; full pull on first time
        const lastSync = cycleSyncState[target.cycle]?.lastSyncedAt;
        const query = lastSync
          ? `after:${Math.floor(new Date(lastSync).getTime() / 1000)}`
          : `newer_than:${lookback}d`;

        const messages = await listAllMessagesForLabel(token, label.id, query);
        messages.forEach((message) => {
          itemsToProcess.push({
            ...message,
            forcedStatus: target.status,
            forcedCycle: target.cycle,
            sourceLabel: target.labelName,
          });
        });
      }
    } else {
      const searchParams = new URLSearchParams({
        q: fallbackQuery,
        maxResults: '50',
      });
      const list = await gmailFetch<{ messages?: GmailMessageListItem[] }>(`/messages?${searchParams}`, token);
      (list.messages ?? []).forEach((message) => itemsToProcess.push(message));
    }

    const seenMessages = new Set<string>();
    const threadAppMap = new Map<string, string>(); // threadId → app id (thread-level dedup)
    const perCycleScanned = new Map<string, number>();
    const perCycleUpdated = new Map<string, number>();

    for (const item of itemsToProcess) {
      if (seenMessages.has(`${item.id}:${item.forcedStatus ?? 'auto'}`)) continue;
      seenMessages.add(`${item.id}:${item.forcedStatus ?? 'auto'}`);

      const message = await getMessage(token, item.id);
      scanned += 1;
      const itemCycle = item.forcedCycle ?? activeCycle;
      perCycleScanned.set(itemCycle, (perCycleScanned.get(itemCycle) ?? 0) + 1);

      const subject = header(message, 'Subject');
      const from = header(message, 'From');
      const date = header(message, 'Date') || null;
      const snippet = message.snippet ?? '';
      const bodyText = payloadText(message.payload);
      // searchable includes `from` for classification/display; matchText excludes it to prevent
      // trivial domain match (e.g. @bombardier.com in From making ALL Bombardier emails score +10)
      const searchable = `${subject} ${from} ${snippet} ${bodyText}`;
      const matchText = `${subject} ${snippet} ${bodyText}`;
      const detectedStatus = item.forcedStatus ?? classifyEmail(searchable);
      if (!detectedStatus) continue;
      if (detectedStatus === 'interview' || detectedStatus === 'offer') continue;

      const emailInfo = extractEmailJobInfo(subject, from, bodyText || snippet);
      const fromDomain = companyFromAddress(from);

      // Thread-level dedup: if earlier message in this thread already resolved an app, reuse it
      let match: Application | null = null;
      const existingThreadAppId = threadAppMap.get(message.threadId);
      if (existingThreadAppId) {
        match = updatedApps.find((app) => app.id === existingThreadAppId) ?? null;
      }

      if (!match) {
        if (item.forcedStatus === 'applied') {
          // Applied-folder: each email is a distinct submission → never content-match, only thread-ID dedup
          // (prevents N emails from same company collapsing into 1 app)
          const pool = item.forcedCycle
            ? updatedApps.filter((a) => (a.recruitment_cycle ?? 'Unassigned') === item.forcedCycle)
            : updatedApps;
          match = pool.find((a) => a.gmail_thread_id === message.threadId) ?? null;
        } else {
          match = findMatchingApplication(updatedApps, matchText, emailInfo, fromDomain, item.forcedCycle, message.threadId);
        }
      }

      const cycleSource = `${searchable} ${emailInfo.role ?? ''} ${match?.role ?? ''} ${match?.notes ?? ''}`;
      const recruitmentCycle = item.forcedCycle ?? (settings.autoDetectCycle
        ? detectRecruitmentCycle(cycleSource, match?.recruitment_cycle || activeCycle)
        : (match?.recruitment_cycle || activeCycle));
      const gmailLabel = buildGmailLabel(settings, detectedStatus, recruitmentCycle);

      // Create app when no match and we have at least company OR role OR domain
      if (!match && settings.createApplicationsFromEmail && (emailInfo.company || emailInfo.role || fromDomain)) {
        const info: EmailJobInfo = {
          company: emailInfo.company ?? fromDomain,
          role: emailInfo.role,
        };
        const created = createApplicationFromEmail(info, detectedStatus, message, subject, from, date, recruitmentCycle, item.sourceLabel ?? gmailLabel);
        updatedApps.push(created);
        match = created;
        updated += 1;
        perCycleUpdated.set(recruitmentCycle, (perCycleUpdated.get(recruitmentCycle) ?? 0) + 1);
      }

      // Register thread → app mapping so subsequent messages in this thread attach to same app
      if (match) {
        threadAppMap.set(message.threadId, match.id);
      }

      const hit: GmailSyncHit = {
        messageId: message.id,
        threadId: message.threadId,
        subject,
        from,
        date,
        snippet,
        detectedStatus,
        applicationId: match?.id ?? null,
        company: match?.company ?? emailInfo.company,
        role: match?.role ?? emailInfo.role,
        recruitmentCycle,
        gmailLabel: item.sourceLabel ?? gmailLabel,
      };
      hits.push(hit);

      if (settings.autoLabel && !settings.syncExistingFoldersOnly) {
        const labelId = labelIds.get(gmailLabel) ?? await ensureLabel(token, gmailLabel);
        labelIds.set(gmailLabel, labelId);
        await labelMessage(token, message.id, labelId);
        labeled += 1;
      }

      if (!match) continue;
      const idx = updatedApps.findIndex((app) => app.id === match!.id);
      if (idx < 0) continue;

      const current = updatedApps[idx];
      const nextStatus = shouldMoveToStatus(current.status, detectedStatus) ? detectedStatus : current.status;
      const nextApp: Application = {
        ...current,
        status: nextStatus,
        status_source: 'gmail',
        recruitment_cycle: recruitmentCycle,
        gmail_message_id: message.id,
        gmail_thread_id: message.threadId,
        gmail_label_source: item.sourceLabel ?? gmailLabel,
        applied_at: detectedStatus === 'applied' && !current.applied_at && date ? new Date(date).toISOString() : current.applied_at,
        last_email_subject: subject,
        last_email_from: from,
        last_email_at: date,
        updated_at: new Date().toISOString(),
      };

      const changed = (
        current.status !== nextApp.status ||
        current.status_source !== nextApp.status_source ||
        current.recruitment_cycle !== nextApp.recruitment_cycle ||
        current.gmail_message_id !== nextApp.gmail_message_id ||
        current.gmail_thread_id !== nextApp.gmail_thread_id ||
        current.gmail_label_source !== nextApp.gmail_label_source ||
        current.last_email_subject !== nextApp.last_email_subject ||
        current.last_email_from !== nextApp.last_email_from ||
        current.last_email_at !== nextApp.last_email_at
      );
      if (!changed) continue;
      updatedApps[idx] = nextApp;
      updated += 1;
      perCycleUpdated.set(recruitmentCycle, (perCycleUpdated.get(recruitmentCycle) ?? 0) + 1);
    }

    if (updated > 0) await replaceApplications(updatedApps);

    // Write per-cycle sync state for every cycle that was queried
    const cyclesTouched = new Set<string>();
    folderTargets.forEach((t) => cyclesTouched.add(t.cycle));
    perCycleScanned.forEach((_, cycle) => cyclesTouched.add(cycle));
    perCycleUpdated.forEach((_, cycle) => cyclesTouched.add(cycle));

    const cycleStats: Record<string, { scanned: number; updated: number; lastSyncedAt: string }> = {};
    for (const cycle of cyclesTouched) {
      const cs = perCycleScanned.get(cycle) ?? 0;
      const cu = perCycleUpdated.get(cycle) ?? 0;
      cycleStats[cycle] = { scanned: cs, updated: cu, lastSyncedAt: syncStartedAt };
      await setCycleSyncForCycle(cycle, { lastSyncedAt: syncStartedAt, lastScanned: cs, lastUpdated: cu });
    }

    const allUpToDate = itemsToProcess.length === 0 && folderTargets.length > 0;

    return {
      scanned,
      matched: hits.filter((hit) => hit.applicationId).length,
      updated,
      labeled,
      hits,
      cycleStats,
      notice: allUpToDate ? 'All cycles up to date — no new emails since last sync.' : undefined,
    };
  } catch (error) {
    return {
      scanned: 0,
      matched: 0,
      updated: 0,
      labeled: 0,
      hits: [],
      error: error instanceof Error ? error.message : 'Unknown Gmail sync error',
    };
  }
}
