// detector.js — runs on every page at document_idle

function detectJob() {
  const url = location.href;

  // ── Tier 1: LinkedIn ──────────────────────────────────────────────────────
  if (url.includes('linkedin.com/jobs/view')) {
    try {
      return {
        company: q('.job-details-jobs-unified-top-card__company-name a') ||
                 q('.jobs-unified-top-card__company-name'),
        role:    q('.job-details-jobs-unified-top-card__job-title') ||
                 q('h1.t-24'),
        location: q('.job-details-jobs-unified-top-card__bullet'),
        source: 'linkedin', tier: 'tier1', url
      };
    } catch(e) {}
  }

  // ── Tier 1: Indeed ───────────────────────────────────────────────────────
  if (/indeed\.com\/(viewjob|jobs)/.test(url)) {
    try {
      return {
        company:  q('[data-testid="inlineHeader-companyName"]'),
        role:     q('h1[data-testid="jobsearch-JobInfoHeader-title"]'),
        location: q('[data-testid="job-location"]'),
        source: 'indeed', tier: 'tier1', url
      };
    } catch(e) {}
  }

  // ── Tier 1: Greenhouse ───────────────────────────────────────────────────
  if (/greenhouse\.io/.test(url)) {
    try {
      return {
        company:  q('.company-name'),
        role:     q('.app-title') || q('h1.job-title'),
        location: q('.location'),
        source: 'greenhouse', tier: 'tier1', url
      };
    } catch(e) {}
  }

  // ── Tier 1: Lever ────────────────────────────────────────────────────────
  if (url.includes('jobs.lever.co')) {
    try {
      const slug = url.match(/jobs\.lever\.co\/([^/]+)/)?.[1] || '';
      return {
        company:  slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        role:     q('.posting-headline h2') || q('h2[data-qa="posting-name"]'),
        location: q('.sort-by-time.posting-category'),
        source: 'lever', tier: 'tier1', url
      };
    } catch(e) {}
  }

  // ── Tier 1: Workday ──────────────────────────────────────────────────────
  if (/myworkdayjobs\.com/.test(url)) {
    try {
      return {
        company:  qMeta('og:site_name'),
        role:     q('[data-automation-id="jobPostingHeader"]'),
        location: q('[data-automation-id="locationDetails"]'),
        source: 'workday', tier: 'tier1', url
      };
    } catch(e) {}
  }

  // ── Tier 1: Ashby ────────────────────────────────────────────────────────
  if (/ashbyhq\.com/.test(url)) {
    try {
      return {
        company:  qMeta('og:site_name') || q('[class*="company"]'),
        role:     q('h1'),
        location: q('[class*="location"]'),
        source: 'ashby', tier: 'tier1', url
      };
    } catch(e) {}
  }

  // ── Tier 2: Generic scoring ──────────────────────────────────────────────
  let score = 0;
  const lurl  = url.toLowerCase();
  const body  = document.body?.innerText?.toLowerCase() || '';

  if (/\/(careers?|jobs?|openings?|positions?|vacancies|hiring|recruit)/i.test(url)) score += 3;
  if (/\/(job|position|opening|req)[_-]?\d+/i.test(url))                             score += 3;
  if (/\/apply/i.test(url))                                                            score += 3;
  if (document.querySelector('a[href*="apply"],button[class*="apply"]'))               score += 2;
  const h1 = document.querySelector('h1');
  if (h1 && /engineer|designer|analyst|developer|manager|intern|specialist|technician/i.test(h1.textContent || '')) score += 2;
  if (document.querySelector('meta[property="og:site_name"]'))                         score += 2;
  if (/remote|hybrid|on-?site/i.test(body))                                            score += 2;
  if ((body.includes('responsibilities') || body.includes('qualifications')) &&
      (body.includes('experience') || body.includes('skills')))                        score += 2;

  document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
    try {
      const d = JSON.parse(s.textContent || '');
      if (d['@type'] === 'JobPosting') score += 3;
    } catch(e) {}
  });

  if (score < 6) return null;

  // extract from generic page
  let company = qMeta('og:site_name');
  if (!company) {
    try {
      document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
        try {
          const d = JSON.parse(s.textContent || '');
          if (d['@type'] === 'JobPosting' && d.hiringOrganization?.name) company = d.hiringOrganization.name;
        } catch(e) {}
      });
    } catch(e) {}
  }
  if (!company) {
    try {
      company = new URL(url).hostname
        .replace(/^(www|careers|jobs|apply|talent)\./, '')
        .split('.')[0]
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
    } catch(e) {}
  }

  const role = h1?.innerText?.trim() || document.title.split(/[|\-]/)[0].trim() || null;
  const locMatch = (document.body?.innerText || '').match(/location\s*:?\s*([^\n]{3,60})/i);

  return {
    company, role,
    location: locMatch ? locMatch[1].trim() : null,
    source: 'company_site', tier: 'tier2', url
  };
}

function q(sel) {
  return document.querySelector(sel)?.innerText?.trim() || null;
}
function qMeta(prop) {
  return document.querySelector(`meta[property="${prop}"]`)?.content || null;
}

// ── Send result ──────────────────────────────────────────────────────────────
const detectedJob = detectJob();

if (detectedJob) {
  chrome.runtime.sendMessage({ type: 'JOB_DETECTED' });
}

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg.type === 'GET_JOB_DATA') {
    respond({ job: detectedJob });
  }
  return true;
});
