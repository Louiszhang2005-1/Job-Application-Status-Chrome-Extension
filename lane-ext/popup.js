const KEY = 'lane_applications';

const STATUS_LABELS = {
  saved: 'Saved', applied: 'Applied', phone_screen: 'Phone Screen',
  interview: 'Interview', offer: 'Offer', rejected: 'Rejected',
  withdrew: 'Withdrew', ghosted: 'Ghosted'
};

const STATUS_COLORS = {
  saved:        { bg: '#e3e8ed', text: '#3a5a78' },
  applied:      { bg: '#fde9d6', text: '#a8632a' },
  phone_screen: { bg: '#e8e2f0', text: '#6b4ea0' },
  interview:    { bg: '#e0eede', text: '#3d6b3a' },
  offer:        { bg: '#d4e8dc', text: '#1f5a3a' },
  rejected:     { bg: '#e8c9c9', text: '#7a3a3a' },
  withdrew:     { bg: '#e0d8c9', text: '#7a6b48' },
  ghosted:      { bg: '#d4d4d4', text: '#5a5246' }
};

const STATUSES = ['saved','applied','phone_screen','interview','offer','rejected','withdrew','ghosted'];

// ── Storage helpers ──────────────────────────────────────────────────────────

function getApps() {
  return new Promise(res => chrome.storage.local.get(KEY, r => res(r[KEY] || [])));
}

function setApps(apps) {
  return new Promise(res => chrome.storage.local.set({ [KEY]: apps }, res));
}

async function saveApp(app) {
  const apps = await getApps();
  const i = apps.findIndex(a => a.id === app.id);
  if (i >= 0) apps[i] = app; else apps.push(app);
  await setApps(apps);
}

async function findByUrl(url) {
  const apps = await getApps();
  const norm = u => { try { const p = new URL(u); return p.hostname + p.pathname.replace(/\/$/, ''); } catch { return u; } };
  return apps.find(a => norm(a.job_url) === norm(url)) || null;
}

async function patchApp(id, updates) {
  const apps = await getApps();
  const i = apps.findIndex(a => a.id === id);
  if (i < 0) return;
  apps[i] = { ...apps[i], ...updates, updated_at: new Date().toISOString() };
  await setApps(apps);
}

function genId() {
  return (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
}

// ── UI helpers ───────────────────────────────────────────────────────────────

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function pill(status) {
  const c = STATUS_COLORS[status];
  return `<span style="background:${c.bg};color:${c.text};border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">${STATUS_LABELS[status]}</span>`;
}

function opts(selected) {
  return STATUSES.map(s => `<option value="${s}"${s===selected?' selected':''}>${STATUS_LABELS[s]}</option>`).join('');
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 2000);
}

function setCount(n) {
  document.getElementById('count').textContent = n + ' tracked';
}

function render(html) {
  document.getElementById('content').innerHTML = html;
}

// ── States ───────────────────────────────────────────────────────────────────

function showDetected(job, tabUrl) {
  const hi = job.tier === 'tier1';
  render(`
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="width:8px;height:8px;border-radius:50%;background:#22c55e;display:inline-block"></span>
        <span style="font-size:12px;color:#5a5246">Job detected</span>
        <span style="margin-left:auto;font-size:10px;background:${hi?'#d4e8dc':'#fde9d6'};color:${hi?'#1f5a3a':'#a8632a'};padding:2px 6px;border-radius:4px;font-weight:600">${hi?'High confidence':'Verify details'}</span>
      </div>
      <div style="font-size:14px;font-weight:600">${esc(job.company||'Unknown')}</div>
      <div style="font-size:12px;color:#5a5246;margin-top:2px">${esc(job.role||'Unknown role')}${job.location?' · '+esc(job.location):''}</div>
    </div>
    <div class="form-group"><label class="label">Company</label><input class="input" id="f-co" value="${esc(job.company||'')}"></div>
    <div class="form-group"><label class="label">Role</label><input class="input" id="f-role" value="${esc(job.role||'')}"></div>
    <div class="form-group"><label class="label">Location</label><input class="input" id="f-loc" value="${esc(job.location||'')}"></div>
    <div class="form-group"><label class="label">Status</label><select class="input" id="f-status">${opts('applied')}</select></div>
    <div class="form-group"><label class="label">Resume version</label><input class="input" id="f-res" placeholder="e.g. v3-mechanical-focused"></div>
    <div class="form-group"><label class="label">Notes</label><input class="input" id="f-notes" placeholder="Optional notes…"></div>
    <button class="btn-primary" id="save-btn">Save to Lane</button>
  `);

  document.getElementById('save-btn').onclick = async () => {
    const status = document.getElementById('f-status').value;
    const app = {
      id: genId(),
      company:       document.getElementById('f-co').value    || 'Unknown',
      role:          document.getElementById('f-role').value  || 'Unknown',
      location:      document.getElementById('f-loc').value   || null,
      job_url:       tabUrl,
      source:        job.source,
      detection_tier: job.tier,
      status,
      resume_version: document.getElementById('f-res').value  || null,
      notes:          document.getElementById('f-notes').value || '',
      applied_at:    status === 'applied' ? new Date().toISOString() : null,
      captured_at:   new Date().toISOString(),
      updated_at:    new Date().toISOString(),
      next_followup_at: null
    };
    await saveApp(app);
    setCount((await getApps()).length);
    toast('✓ Saved to Lane!');
    setTimeout(() => showSaved(app), 1200);
  };
}

function showSaved(app) {
  render(`
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:12px;color:#5a5246">✓ Already tracked</span>
        ${pill(app.status)}
      </div>
      <div style="font-size:15px;font-weight:700">${esc(app.company)}</div>
      <div style="font-size:13px;color:#5a5246;margin-top:2px">${esc(app.role)}</div>
      ${app.resume_version?`<div style="font-size:11px;color:#9a9388;margin-top:4px">Resume: ${esc(app.resume_version)}</div>`:''}
    </div>
    <div class="form-group">
      <label class="label">Update status</label>
      <select class="input" id="st-sel">${opts(app.status)}</select>
    </div>
    ${app.notes?`<div style="margin-top:10px;font-size:12px;color:#5a5246;background:#f7f3eb;border-radius:6px;padding:8px 10px">${esc(app.notes)}</div>`:''}
  `);

  document.getElementById('st-sel').onchange = async (e) => {
    await patchApp(app.id, { status: e.target.value });
    toast('✓ Status updated');
  };
}

function showNoJob(tabUrl) {
  render(`
    <div style="text-align:center;padding:24px 0">
      <div style="font-size:13px;color:#5a5246;margin-bottom:16px">No job posting detected.</div>
      <button class="btn-secondary" id="manual-btn">+ Add manually</button>
    </div>
  `);
  document.getElementById('manual-btn').onclick = () => showManual(tabUrl);
}

function showManual(tabUrl) {
  render(`
    <button id="back-btn" style="background:none;border:none;cursor:pointer;color:#9a9388;font-size:12px;padding:0;margin-bottom:12px">← Back</button>
    <div class="form-group"><label class="label">Company</label><input class="input" id="m-co" placeholder="Company name"></div>
    <div class="form-group"><label class="label">Role</label><input class="input" id="m-role" placeholder="Job title"></div>
    <div class="form-group"><label class="label">Location</label><input class="input" id="m-loc" placeholder="City, Province"></div>
    <div class="form-group"><label class="label">Status</label><select class="input" id="m-status">${opts('applied')}</select></div>
    <div class="form-group"><label class="label">Notes</label><input class="input" id="m-notes" placeholder="Optional notes…"></div>
    <button class="btn-primary" id="m-save-btn">Save to Lane</button>
  `);

  document.getElementById('back-btn').onclick = () => showNoJob(tabUrl);

  document.getElementById('m-save-btn').onclick = async () => {
    const status = document.getElementById('m-status').value;
    const app = {
      id: genId(),
      company:       document.getElementById('m-co').value    || 'Unknown',
      role:          document.getElementById('m-role').value  || 'Unknown',
      location:      document.getElementById('m-loc').value   || null,
      job_url:       tabUrl,
      source:        'other',
      detection_tier: 'manual',
      status,
      resume_version: null,
      notes:          document.getElementById('m-notes').value || '',
      applied_at:    status === 'applied' ? new Date().toISOString() : null,
      captured_at:   new Date().toISOString(),
      updated_at:    new Date().toISOString(),
      next_followup_at: null
    };
    await saveApp(app);
    setCount((await getApps()).length);
    toast('✓ Saved to Lane!');
    setTimeout(() => showSaved(app), 1200);
  };
}

// ── Boot ─────────────────────────────────────────────────────────────────────

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabUrl = tab.url || '';

  const apps = await getApps();
  setCount(apps.length);

  if (!tabUrl.startsWith('http')) {
    showNoJob(tabUrl);
    return;
  }

  const existing = await findByUrl(tabUrl);
  if (existing) {
    showSaved(existing);
    return;
  }

  let job = null;
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'GET_JOB_DATA' });
    job = res && res.job ? res.job : null;
  } catch (e) {
    // content script not reachable (new tab, chrome://, etc.)
  }

  if (job) {
    showDetected(job, tabUrl);
  } else {
    showNoJob(tabUrl);
  }
}

init();
