import { useEffect, useState } from 'react';
import type { Application, ApplicationStatus, DetectedJob } from '../lib/types';
import type { GmailSyncSettings } from '../lib/types';
import { findByUrl, getApplications, getCycleLayout, getGmailSettings, KNOWN_CYCLES, saveApplication, saveGmailSettings, updateApplication } from '../lib/storage';

// --- Style constants ---
const STATUS_COLORS: Record<ApplicationStatus, { bg: string; text: string; label: string }> = {
  saved: { bg: '#e3e8ed', text: '#3a5a78', label: 'Saved' },
  applied: { bg: '#fde9d6', text: '#a8632a', label: 'Applied' },
  phone_screen: { bg: '#e8e2f0', text: '#6b4ea0', label: 'Phone Screen' },
  interview: { bg: '#e0eede', text: '#3d6b3a', label: 'Interview' },
  offer: { bg: '#d4e8dc', text: '#1f5a3a', label: 'Offer' },
  rejected: { bg: '#e8c9c9', text: '#7a3a3a', label: 'Rejected' },
  withdrew: { bg: '#e0d8c9', text: '#7a6b48', label: 'Withdrew' },
  ghosted: { bg: '#d4d4d4', text: '#5a5246', label: 'Ghosted' },
};

const STATUSES: ApplicationStatus[] = ['saved', 'applied', 'phone_screen', 'interview', 'offer', 'rejected', 'withdrew', 'ghosted'];

function StatusPill({ status }: { status: ApplicationStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <span style={{ background: c.bg, color: c.text, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600, letterSpacing: '0.03em' }}>
      {c.label}
    </span>
  );
}

function generateId() {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

type PopupState = 'loading' | 'job_detected' | 'already_saved' | 'no_job' | 'manual_add';

export default function App() {
  const [state, setState] = useState<PopupState>('loading');
  const [job, setJob] = useState<DetectedJob | null>(null);
  const [existing, setExisting] = useState<Application | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [tabUrl, setTabUrl] = useState('');
  const [toast, setToast] = useState('');
  const [activeCycle, setActiveCycle] = useState('Summer 2026');
  const [gmailSettings, setGmailSettings] = useState<GmailSyncSettings | null>(null);
  const [cycleOptions, setCycleOptions] = useState<string[]>([...KNOWN_CYCLES]);

  // Form state for detected job
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [loc, setLoc] = useState('');
  const [status, setStatus] = useState<ApplicationStatus>('applied');
  const [resumeVersion, setResumeVersion] = useState('');
  const [notes, setNotes] = useState('');

  // Manual form state
  const [manualCompany, setManualCompany] = useState('');
  const [manualRole, setManualRole] = useState('');
  const [manualLoc, setManualLoc] = useState('');
  const [manualStatus, setManualStatus] = useState<ApplicationStatus>('applied');
  const [manualNotes, setManualNotes] = useState('');

  useEffect(() => {
    async function init() {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = tab.url ?? '';
      setTabUrl(url);
      setManualCompany('');
      setManualRole('');
      setManualLoc('');

      const apps = await getApplications();
      setTotalCount(apps.length);

      const gmSettings = await getGmailSettings();
      setGmailSettings(gmSettings);
      setActiveCycle(gmSettings.activeCycle.trim() || 'Summer 2026');
      const storedCycles = apps.map((a) => a.recruitment_cycle).filter((c): c is string => !!c);
      const cycleLayout = await getCycleLayout();
      setCycleOptions(Array.from(new Set([...KNOWN_CYCLES, ...cycleLayout.order, ...storedCycles, gmSettings.activeCycle.trim()])));

      // Check if already saved
      const found = await findByUrl(url);
      if (found) {
        setExisting(found);
        setState('already_saved');
        return;
      }

      // Try content script
      try {
        const response = await chrome.tabs.sendMessage(tab.id!, { type: 'GET_JOB_DATA' });
        if (response?.job) {
          const j: DetectedJob = response.job;
          setJob(j);
          setCompany(j.company ?? '');
          setRole(j.role ?? '');
          setLoc(j.location ?? '');
          setState('job_detected');
        } else {
          setState('no_job');
        }
      } catch {
        setState('no_job');
      }
    }
    init();
  }, []);

  async function handleCycleChange(newCycle: string) {
    setActiveCycle(newCycle);
    if (gmailSettings) {
      const updated = { ...gmailSettings, activeCycle: newCycle };
      setGmailSettings(updated);
      await saveGmailSettings(updated);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  }

  async function handleSave() {
    const app: Application = {
      id: generateId(),
      company: company || 'Unknown',
      role: role || 'Unknown',
      location: loc || null,
      job_url: tabUrl,
      source: job?.source ?? 'other',
      detection_tier: job?.tier ?? 'manual',
      status,
      resume_version: resumeVersion || null,
      notes,
      applied_at: status === 'applied' ? new Date().toISOString() : null,
      captured_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      next_followup_at: null,
      recruitment_cycle: activeCycle,
      status_source: 'detector' as const,
    };
    await saveApplication(app);
    const apps = await getApplications();
    setTotalCount(apps.length);
    setExisting(app);
    showToast('Saved to Lane!');
    setTimeout(() => setState('already_saved'), 1000);
  }

  async function handleManualSave() {
    const app: Application = {
      id: generateId(),
      company: manualCompany || 'Unknown',
      role: manualRole || 'Unknown',
      location: manualLoc || null,
      job_url: tabUrl,
      source: 'other',
      detection_tier: 'manual',
      status: manualStatus,
      resume_version: null,
      notes: manualNotes,
      applied_at: manualStatus === 'applied' ? new Date().toISOString() : null,
      captured_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      next_followup_at: null,
      recruitment_cycle: activeCycle,
      status_source: 'manual' as const,
    };
    await saveApplication(app);
    const apps = await getApplications();
    setTotalCount(apps.length);
    setExisting(app);
    showToast('Saved to Lane!');
    setTimeout(() => setState('already_saved'), 1000);
  }

  async function handleStatusUpdate(newStatus: ApplicationStatus) {
    if (!existing) return;
    await updateApplication(existing.id, { status: newStatus });
    setExisting({ ...existing, status: newStatus });
    showToast('Status updated');
  }

  const s: React.CSSProperties = {
    padding: 16,
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
    background: '#fafaf7',
    minHeight: 200,
    position: 'relative',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '7px 10px',
    border: '1px solid #ebe6db',
    borderRadius: 6,
    fontSize: 13,
    background: '#fff',
    color: '#1a1a1a',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#9a9388',
    marginBottom: 4,
    display: 'block',
  };

  const btnPrimary: React.CSSProperties = {
    width: '100%',
    padding: '10px 0',
    background: '#1f1d1a',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 12,
  };

  const tierBadge = job?.tier === 'tier1'
    ? { bg: '#d4e8dc', text: '#1f5a3a', label: 'High confidence' }
    : { bg: '#fde9d6', text: '#a8632a', label: 'Verify details' };

  if (state === 'loading') {
    return (
      <div style={{ ...s, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
        <span style={{ color: '#9a9388', fontSize: 13 }}>Loading...</span>
      </div>
    );
  }

  return (
    <div style={s}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'absolute', top: 12, left: 16, right: 16, background: '#1f1d1a', color: '#fff', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600, textAlign: 'center', zIndex: 99 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.02em' }}>Lane</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#9a9388' }}>{totalCount} tracked</span>
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            style={{ background: 'none', border: '1px solid #ebe6db', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#5a5246', cursor: 'pointer' }}
          >Dashboard →</button>
        </div>
      </div>
      {/* Active cycle selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9a9388', whiteSpace: 'nowrap' }}>Cycle</span>
        <select
          style={{ ...inputStyle, fontSize: 11, padding: '3px 6px', flex: 1 }}
          value={activeCycle}
          onChange={(e) => handleCycleChange(e.target.value)}
        >
          {cycleOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* STATE: job detected */}
      {state === 'job_detected' && (
        <>
          <div style={{ background: '#fff', border: '1px solid #ebe6db', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: '#5a5246' }}>Job detected</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, background: tierBadge.bg, color: tierBadge.text, padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{tierBadge.label}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{company || 'Unknown company'}</div>
            <div style={{ fontSize: 12, color: '#5a5246', marginTop: 2 }}>{role || 'Unknown role'}{loc ? ` · ${loc}` : ''}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <label style={labelStyle}>Company</label>
              <input style={inputStyle} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" />
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <input style={inputStyle} value={role} onChange={(e) => setRole(e.target.value)} placeholder="Job title" />
            </div>
            <div>
              <label style={labelStyle}>Location</label>
              <input style={inputStyle} value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="City, Province" />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value as ApplicationStatus)}>
                {STATUSES.map((st) => (
                  <option key={st} value={st}>{STATUS_COLORS[st].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Resume version</label>
              <input style={inputStyle} value={resumeVersion} onChange={(e) => setResumeVersion(e.target.value)} placeholder="e.g. v3-mechanical-focused" />
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <input style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." />
            </div>
          </div>

          <button style={btnPrimary} onClick={handleSave}>Save to Lane</button>
        </>
      )}

      {/* STATE: already saved */}
      {state === 'already_saved' && existing && (
        <>
          <div style={{ background: '#fff', border: '1px solid #ebe6db', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#5a5246' }}>Tracked</span>
              <span style={{ marginLeft: 'auto' }}><StatusPill status={existing.status} /></span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>{existing.company}</div>
            <div style={{ fontSize: 13, color: '#5a5246', marginTop: 2 }}>{existing.role}</div>
            {existing.resume_version && (
              <div style={{ fontSize: 11, color: '#9a9388', marginTop: 4 }}>Resume: {existing.resume_version}</div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Update status</label>
            <select
              style={inputStyle}
              value={existing.status}
              onChange={(e) => handleStatusUpdate(e.target.value as ApplicationStatus)}
            >
              {STATUSES.map((st) => (
                <option key={st} value={st}>{STATUS_COLORS[st].label}</option>
              ))}
            </select>
          </div>

          {existing.notes && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#5a5246', background: '#f7f3eb', borderRadius: 6, padding: '8px 10px' }}>
              {existing.notes}
            </div>
          )}
        </>
      )}

      {/* STATE: no job */}
      {state === 'no_job' && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 13, color: '#5a5246', marginBottom: 16 }}>No job posting detected on this page.</div>
          <button
            style={{ ...btnPrimary, width: 'auto', padding: '8px 20px' }}
            onClick={() => setState('manual_add')}
          >
            + Add manually
          </button>
        </div>
      )}

      {/* STATE: manual add */}
      {state === 'manual_add' && (
        <>
          <div style={{ fontSize: 12, color: '#5a5246', marginBottom: 12 }}>
            <button onClick={() => setState('no_job')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a9388', fontSize: 12, padding: 0 }}>Back</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <label style={labelStyle}>Company</label>
              <input style={inputStyle} value={manualCompany} onChange={(e) => setManualCompany(e.target.value)} placeholder="Company name" />
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <input style={inputStyle} value={manualRole} onChange={(e) => setManualRole(e.target.value)} placeholder="Job title" />
            </div>
            <div>
              <label style={labelStyle}>Location</label>
              <input style={inputStyle} value={manualLoc} onChange={(e) => setManualLoc(e.target.value)} placeholder="City, Province" />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={inputStyle} value={manualStatus} onChange={(e) => setManualStatus(e.target.value as ApplicationStatus)}>
                {STATUSES.map((st) => (
                  <option key={st} value={st}>{STATUS_COLORS[st].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <input style={inputStyle} value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} placeholder="Optional notes..." />
            </div>
          </div>
          <button style={btnPrimary} onClick={handleManualSave}>Save to Lane</button>
        </>
      )}
    </div>
  );
}
