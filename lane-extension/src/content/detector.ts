import { detectJob } from '../lib/extractors';
import { findByUrl, getGmailSettings, saveApplication } from '../lib/storage';
import type { DetectedJob } from '../lib/types';

let cachedJob: DetectedJob | null = detectJob();

// ─── Overlay: shown when job is detected on page load ────────────────────────

function injectOverlay(job: DetectedJob) {
  if (document.getElementById('lane-ext-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'lane-ext-overlay';
  overlay.style.cssText = [
    'position:fixed', 'bottom:24px', 'right:24px', 'z-index:2147483647',
    'background:#1f1d1a', 'color:#fff', 'border-radius:12px', 'padding:12px 16px',
    'font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display",system-ui,sans-serif',
    'font-size:13px', 'box-shadow:0 4px 24px rgba(0,0,0,0.35)',
    'display:flex', 'align-items:center', 'gap:12px', 'max-width:320px',
    'transition:opacity 0.3s', 'opacity:1',
  ].join(';');

  const dot = document.createElement('span');
  dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#22c55e;flex-shrink:0';

  const info = document.createElement('div');
  const title = document.createElement('div');
  title.style.cssText = 'font-weight:600;font-size:13px;line-height:1.3';
  title.textContent = [job.company, job.role].filter(Boolean).join(' · ') || 'Job detected';

  const sub = document.createElement('div');
  sub.style.cssText = 'color:#9a9388;font-size:11px;margin-top:3px';
  sub.textContent = 'Click the Lane icon to track · auto-tracks on submit';

  info.appendChild(title);
  info.appendChild(sub);

  const close = document.createElement('button');
  close.style.cssText = 'background:none;border:none;color:#9a9388;cursor:pointer;padding:0;font-size:18px;line-height:1;margin-left:auto;flex-shrink:0';
  close.textContent = '×';
  close.addEventListener('click', (e) => { e.stopPropagation(); overlay.remove(); });

  overlay.appendChild(dot);
  overlay.appendChild(info);
  overlay.appendChild(close);
  document.body.appendChild(overlay);

  setTimeout(() => { overlay.style.opacity = '0'; }, 6000);
  setTimeout(() => { overlay.remove(); }, 6300);
}

// ─── Toast: shown after auto-tracking ────────────────────────────────────────

function showToast(message: string, color = '#22c55e') {
  const existing = document.getElementById('lane-ext-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'lane-ext-toast';
  toast.style.cssText = [
    'position:fixed', 'bottom:24px', 'right:24px', 'z-index:2147483647',
    'background:#1f1d1a', 'color:#fff', 'border-radius:12px', 'padding:12px 16px',
    'font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display",system-ui,sans-serif',
    'font-size:13px', 'box-shadow:0 4px 24px rgba(0,0,0,0.35)',
    'display:flex', 'align-items:center', 'gap:10px', 'max-width:320px',
    'transition:opacity 0.3s', 'opacity:1',
  ].join(';');

  const dot = document.createElement('span');
  dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0`;

  const text = document.createElement('span');
  text.style.cssText = 'font-weight:600';
  text.textContent = message;

  toast.appendChild(dot);
  toast.appendChild(text);
  document.body.appendChild(toast);

  setTimeout(() => { toast.style.opacity = '0'; }, 4000);
  setTimeout(() => { toast.remove(); }, 4300);
}

// ─── Auto-track on form submission ───────────────────────────────────────────

const SUBMIT_RE = /\b(submit|apply now|apply$|send application|complete application|postuler|soumettre|envoyer)\b/i;
let submitWatched = false;

async function autoTrackApplication(job: DetectedJob) {
  try {
    const url = window.location.href;
    const existing = await findByUrl(url);
    if (existing) {
      showToast('Already tracked in Lane', '#9a9388');
      return;
    }

    const gmailSettings = await getGmailSettings();
    const activeCycle = gmailSettings.activeCycle?.trim() || null;

    await saveApplication({
      id: crypto.randomUUID(),
      company: job.company ?? 'Unknown',
      role: job.role ?? 'Unknown',
      location: job.location ?? null,
      job_url: url,
      source: job.source,
      detection_tier: job.tier,
      status: 'applied',
      resume_version: null,
      notes: '',
      applied_at: new Date().toISOString(),
      captured_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      next_followup_at: null,
      recruitment_cycle: activeCycle,
      status_source: 'detector',
    });

    chrome.runtime.sendMessage({ type: 'JOB_APPLIED' }).catch(() => {});
    showToast(`Tracked: ${job.role ?? job.company ?? 'Application'}`);
  } catch { /* storage may be unavailable */ }
}

function watchForSubmit(job: DetectedJob) {
  if (submitWatched) return;
  submitWatched = true;

  // Form submit event (covers native <form> submissions)
  document.addEventListener('submit', (e) => {
    const form = e.target as HTMLFormElement;
    const hasResumeField = !!form.querySelector(
      'input[type="file"], [name*="resume" i], [name*="cv" i], [id*="resume" i]'
    );
    const hasApplyText = SUBMIT_RE.test(form.querySelector('[type="submit"]')?.getAttribute('value') ?? '');
    if (hasResumeField || hasApplyText) {
      autoTrackApplication(job);
    }
  }, { capture: true });

  // Button/link click — catches SPAs that don't use native form submit
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('button, [role="button"], input[type="submit"], a') as HTMLElement | null;
    if (!btn) return;
    const label = (
      btn.innerText?.trim() ||
      btn.getAttribute('aria-label') ||
      btn.getAttribute('value') ||
      btn.getAttribute('title') || ''
    );
    if (SUBMIT_RE.test(label)) {
      // Small delay: let any JS validation run first; only track if page doesn't show errors
      setTimeout(() => {
        const hasErrors = !!document.querySelector(
          '[class*="error" i]:not([style*="display:none"]):not([style*="display: none"]), [aria-invalid="true"]'
        );
        if (!hasErrors) autoTrackApplication(job);
      }, 800);
    }
  }, { capture: true });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function onJobDetected(job: DetectedJob) {
  cachedJob = job;
  chrome.runtime.sendMessage({ type: 'JOB_DETECTED', tier: job.tier }).catch(() => {});
  injectOverlay(job);
  watchForSubmit(job);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_JOB_DATA') {
    if (!cachedJob) cachedJob = detectJob();
    sendResponse({ job: cachedJob });
  }
  return true;
});

if (cachedJob) {
  onJobDetected(cachedJob);
} else {
  let attempts = 0;
  const observer = new MutationObserver(() => {
    attempts++;
    const job = detectJob();
    if (job) {
      observer.disconnect();
      onJobDetected(job);
    } else if (attempts > 200) {
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
