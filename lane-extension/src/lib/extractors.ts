import type { DetectedJob, JobSource } from './types';

// Split "Job Title - Company Name" without breaking mid-word hyphens (Co-op, full-time)
const TITLE_SPLIT_RE = /\s*[|–]\s*|\s+-\s+/;

// ─── Helpers ────────────────────────────────────────────────────────────────

function titleParseRole(): string | null {
  const t = document.title.trim();
  if (!t || /^(oracle|workday|login|sign in|home)$/i.test(t)) return null;
  const cleaned = t.replace(/^(apply|application|applying for|apply for)\s*[-|:]\s*/i, '');
  const part = cleaned.split(TITLE_SPLIT_RE)[0].trim();
  if (!part || part.length < 4 || /^(home|careers?|jobs?|search|results?|apply|application|login)$/i.test(part)) return null;
  return part;
}

function titleParseCompany(): string | null {
  const parts = document.title.split(TITLE_SPLIT_RE);
  if (parts.length < 2) return null;
  const first = parts[0].trim();
  const last = parts[parts.length - 1].trim();
  const isRoleish = /engineer|designer|analyst|developer|manager|intern|specialist|coordinator|technician|assembly|co-op|coop|officer|director|lead|architect|scientist|ingéni|analyste|développeur/i;
  const raw = isRoleish.test(first) ? last : first;
  return raw.replace(/\s*(careers?|jobs?|hiring|recruiting)\s*$/i, '').trim() || null;
}

function companyFromHostname(): string | null {
  try {
    const host = new URL(window.location.href).hostname;
    // Strip common prefixes and ATS platform subdomains
    const cleaned = host
      .replace(/^(www|jobs|careers|apply|recruiting|talent|hiring|career[0-9]*)\./i, '')
      .replace(/\.(successfactors|greenhouse|lever|workday|myworkdayjobs|ashbyhq|icims|taleo|ultipro|dayforcehcm|bamboohr|jobvite|smartrecruiters|teamtailor|workable|breezy|adp)\.(com|eu|ca|io|hr|net)$/i, '');
    const name = cleaned.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    // Discard if it's just the ATS platform name
    if (/^(successfactors|workday|greenhouse|lever|icims|taleo|ultipro|dayforce|bamboohr|adp|workable|breezy|smartrecruiters)$/i.test(name)) return null;
    return name || null;
  } catch {
    return null;
  }
}

function cleanJobTitle(text: string): string {
  return text
    .replace(/^(applying for|apply for|application for|apply\s*[-–:]\s*)/i, '')
    .replace(/\s*[-–|]\s*$/, '')
    .trim();
}

function looksLikeJobTitle(text: string): boolean {
  if (!text || text.length < 4 || text.length > 250) return false;
  if (text === text.toUpperCase() && text.length > 10) return false;
  if (/^(address|work preference|education|experience|language|documents|diversity|disability|summary|review|submit|contact|personal information|curriculum vitae|welcome|sign in|log in|apply for this|required information|additional information|contact information|contact details)/i.test(text)) return false;
  return true;
}

// ─── Step 1: JSON-LD structured data (platform-agnostic, highest quality) ───

function extractFromStructuredData(): DetectedJob | null {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const s of scripts) {
    try {
      const raw = JSON.parse(s.textContent ?? '');
      // Handle both top-level JobPosting and @graph arrays
      const items = Array.isArray(raw) ? raw : raw['@graph'] ? raw['@graph'] : [raw];
      for (const d of items) {
        if (d['@type'] !== 'JobPosting') continue;
        const role = d.title || d.name || null;
        const org = d.hiringOrganization;
        const company = (typeof org === 'string' ? org : org?.name) || null;
        const jobLoc = d.jobLocation;
        const addrObj = Array.isArray(jobLoc) ? jobLoc[0]?.address : jobLoc?.address;
        const location =
          addrObj?.addressLocality ||
          addrObj?.addressRegion ||
          (typeof jobLoc === 'string' ? jobLoc : null) ||
          null;
        const description = (d.description ?? '').replace(/<[^>]+>/g, ' ').slice(0, 3000);
        if (role || company) {
          return { company, role, location, description, url: window.location.href, source: 'company_site', tier: 'tier1' };
        }
      }
    } catch { /* malformed JSON-LD */ }
  }
  return null;
}

// ─── Step 2: Detect job page by content signals (not domain hardcoding) ─────

interface PageSignals {
  score: number;
  isApplyPage: boolean;
}

function detectJobPageSignals(): PageSignals {
  let score = 0;
  let isApplyPage = false;

  const url = window.location.href;
  const urlLc = url.toLowerCase();
  const bodyText = (document.body?.innerText ?? '').toLowerCase();

  // URL query params: jobId=, opportunityId= etc. → strong "this is a specific job" signal
  if (/[?&](jobid|opportunityid|jobnumber|reqid|job_id|position_id|req_id|jobcode|jobref)=/i.test(url)) {
    score += 5; isApplyPage = true;
  }

  // URL path signals
  if (/\/(apply|application)(\/|$|\?)/i.test(url)) { score += 5; isApplyPage = true; }
  if (/\/(candidateportal|jobboard|recruitment|portalcareer|candidateexperience|opportunityapply|requisition)/i.test(urlLc)) { score += 5; isApplyPage = true; }
  if (/\/job[s]?\/([\w\-]{2,}\/?)*(apply|\d[\w\-]*)/i.test(url)) score += 4;
  if (/\/(careers?|positions?|openings?|vacancies|opportunities)\//i.test(url)) score += 2;
  if (/\/job[s]?\/[\w\-]{2,}/i.test(url)) score += 2;

  // DOM: resume/CV upload — check input[type=file] AND button/label text (many ATSs use custom buttons)
  const hasFileInput = !!document.querySelector('input[type="file"]');
  const hasResumeClass = !!document.querySelector(
    '[class*="resume" i], [class*="curriculum" i], [id*="resume" i], [id*="cv-upload" i], [aria-label*="resume" i], [aria-label*="curriculum vitae" i], [aria-label*="résumé" i]'
  );
  const hasResumeText = /upload.{0,10}(resume|cv|résumé|curriculum)|attach.{0,10}(resume|cv|résumé)|(resume|cv|résumé).{0,10}upload|(resume|cv|résumé).{0,10}attach/i.test(bodyText);
  if (hasFileInput || hasResumeClass || hasResumeText) { score += 6; isApplyPage = true; }

  // Apply/submit button text
  if (/apply now|submit application|postuler|soumettre|apply for this/i.test(bodyText)) score += 3;

  // Salary / compensation mentioned
  if (/salary|compensation|pay range|hourly|rémunération|\$[\d,]+|cad\s*\d/i.test(bodyText)) score += 2;

  // Classic job description sections
  if (/responsibilities|responsabilit/i.test(bodyText)) score += 2;
  if (/qualifications?|requirements?|what you.ll bring|what we.re looking/i.test(bodyText)) score += 2;

  // h1 contains role-like keywords (multilingual)
  const h1 = (document.querySelector('h1')?.textContent ?? '').toLowerCase();
  if (/engineer|developer|analyst|designer|manager|intern|specialist|coordinator|technician|scientist|ingénieur|analyste|développeur|professionnel|gestionnaire/i.test(h1)) score += 3;

  return { score, isApplyPage };
}

// ─── Step 3: Extract role/company from page content ─────────────────────────

function extractRoleFromPage(isApplyPage: boolean): string | null {
  const h1Text = (document.querySelector('h1') as HTMLElement)?.innerText?.trim() ?? '';

  // On apply pages, trust h1 directly if it passes basic checks
  if (looksLikeJobTitle(h1Text)) return cleanJobTitle(h1Text);

  // Scan ALL visible text elements for job title — breadcrumbs, nav links, any heading
  const candidates = Array.from(document.querySelectorAll(
    'h1, h2, h3, h4, [class*="job-title" i], [class*="jobTitle" i], [class*="position-title" i], [class*="role-title" i], [class*="posting-title" i], [class*="opportunity-title" i], nav a, nav span, [class*="breadcrumb" i] a, [class*="breadcrumb" i] span, header a, header span, [class*="header" i] span, [class*="back" i] span, a[class*="back" i]'
  ));
  const roleKeywords = /engineer|designer|analyst|developer|manager|intern|specialist|coordinator|technician|assembly|co-op|coop|officer|director|lead|architect|scientist|representative|associate|consultant|advisor|ingénieur|analyste|développeur|professionnel|gestionnaire|technicien/i;
  for (const el of candidates) {
    const t = (el as HTMLElement).innerText?.trim() ?? '';
    if (looksLikeJobTitle(t) && roleKeywords.test(t)) return cleanJobTitle(t);
  }

  // Fall back to document.title
  return titleParseRole();
}

// ─── Specific extractors for top platforms (better selector quality) ─────────

function extractLinkedIn(): DetectedJob | null {
  if (!window.location.href.includes('linkedin.com/jobs/view')) return null;
  try {
    const role =
      (document.querySelector('.job-details-jobs-unified-top-card__job-title') as HTMLElement)?.innerText?.trim() ||
      (document.querySelector('h1.t-24') as HTMLElement)?.innerText?.trim() || null;
    const company =
      (document.querySelector('.job-details-jobs-unified-top-card__company-name a') as HTMLElement)?.innerText?.trim() ||
      (document.querySelector('.jobs-unified-top-card__company-name') as HTMLElement)?.innerText?.trim() || null;
    const loc =
      (document.querySelector('.job-details-jobs-unified-top-card__bullet') as HTMLElement)?.innerText?.trim() || null;
    const description =
      (document.querySelector('.jobs-description__content') as HTMLElement)?.innerText?.trim() || '';
    return { company, role, location: loc, description, url: window.location.href, source: 'linkedin' as JobSource, tier: 'tier1' };
  } catch { return null; }
}

function extractIndeed(): DetectedJob | null {
  if (!/indeed\.com\/(viewjob|jobs)/.test(window.location.href)) return null;
  try {
    const role = (document.querySelector('h1[data-testid="jobsearch-JobInfoHeader-title"]') as HTMLElement)?.innerText?.trim() || null;
    const company = (document.querySelector('[data-testid="inlineHeader-companyName"]') as HTMLElement)?.innerText?.trim() || null;
    const loc = (document.querySelector('[data-testid="job-location"]') as HTMLElement)?.innerText?.trim() || null;
    const description = (document.querySelector('#jobDescriptionText') as HTMLElement)?.innerText?.trim() || '';
    return { company, role, location: loc, description, url: window.location.href, source: 'indeed', tier: 'tier1' };
  } catch { return null; }
}

function extractGreenhouse(): DetectedJob | null {
  if (!/(greenhouse\.io|boards\.greenhouse\.io)/.test(window.location.href)) return null;
  try {
    const role = (document.querySelector('.app-title') as HTMLElement)?.innerText?.trim() || null;
    const company = (document.querySelector('.company-name') as HTMLElement)?.innerText?.trim() || null;
    const loc = (document.querySelector('.location') as HTMLElement)?.innerText?.trim() || null;
    const description = (document.querySelector('#content') as HTMLElement)?.innerText?.trim() || '';
    return { company, role, location: loc, description, url: window.location.href, source: 'greenhouse', tier: 'tier1' };
  } catch { return null; }
}

function extractLever(): DetectedJob | null {
  if (!window.location.href.includes('jobs.lever.co')) return null;
  try {
    const role =
      (document.querySelector('.posting-headline h2') as HTMLElement)?.innerText?.trim() ||
      (document.querySelector('h2[data-qa="posting-name"]') as HTMLElement)?.innerText?.trim() || null;
    const slug = window.location.href.match(/jobs\.lever\.co\/([^/]+)/)?.[1];
    const company = slug ? slug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : null;
    const loc = (document.querySelector('.sort-by-time.posting-category') as HTMLElement)?.innerText?.trim() || null;
    const description = (document.querySelector('.posting-description') as HTMLElement)?.innerText?.trim() || '';
    return { company, role, location: loc, description, url: window.location.href, source: 'lever', tier: 'tier1' };
  } catch { return null; }
}

function extractWorkday(): DetectedJob | null {
  if (!/(myworkdayjobs\.com)/.test(window.location.href)) return null;
  try {
    const role = (document.querySelector('[data-automation-id="jobPostingHeader"]') as HTMLElement)?.innerText?.trim() || null;
    const company = (document.querySelector('meta[property="og:site_name"]') as HTMLMetaElement)?.content || null;
    const loc = (document.querySelector('[data-automation-id="locationDetails"]') as HTMLElement)?.innerText?.trim() || null;
    const description = (document.querySelector('[data-automation-id="jobPostingDescription"]') as HTMLElement)?.innerText?.trim() || '';
    return { company, role, location: loc, description, url: window.location.href, source: 'workday', tier: 'tier1' };
  } catch { return null; }
}

// ─── Universal smart extractor ───────────────────────────────────────────────

function extractSmart(): DetectedJob | null {
  const { score, isApplyPage } = detectJobPageSignals();
  if (score < 5) return null;

  const role = extractRoleFromPage(isApplyPage);

  const company =
    (document.querySelector('meta[property="og:site_name"]') as HTMLMetaElement)?.content ||
    titleParseCompany() ||
    companyFromHostname() ||
    null;

  if (!role && !company) return null;

  const loc =
    (document.querySelector('[class*="location" i], [data-testid*="location" i], [aria-label*="location" i]') as HTMLElement)?.innerText?.trim() || null;
  const mainEl = document.querySelector('main, [role="main"], article') as HTMLElement | null;
  const description = (mainEl?.innerText ?? '').slice(0, 3000);

  const tier = score >= 8 ? 'tier1' : 'tier2';
  return { company, role, location: loc, description, url: window.location.href, source: 'company_site', tier };
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export function detectJob(): DetectedJob | null {
  return (
    extractFromStructuredData() ??  // JSON-LD: platform-agnostic, best quality
    extractLinkedIn() ??            // LinkedIn: specific selectors
    extractIndeed() ??              // Indeed: specific selectors
    extractGreenhouse() ??          // Greenhouse: specific selectors
    extractLever() ??               // Lever: specific selectors
    extractWorkday() ??             // Workday: specific selectors
    extractSmart()                  // Everything else: content signals, no domain list
  );
}
