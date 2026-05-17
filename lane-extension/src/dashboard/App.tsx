import { useEffect, useState, useMemo, useRef } from 'react';
import {
  FunnelChart, Funnel, LabelList, Tooltip as RTooltip, Cell,
  ResponsiveContainer,
} from 'recharts';
import type { Application, ApplicationStatus } from '../lib/types';
import { getApplications, updateApplication } from '../lib/storage';

/* ─── Global styles ─────────────────────────────────────────────────────────── */
const injectStyles = () => {
  if (document.getElementById('lane-dash-styles')) return;
  const el = document.createElement('style');
  el.id = 'lane-dash-styles';
  el.textContent = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #0c0a08; color: #f0ebe0; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    @keyframes glow { 0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); } 50% { box-shadow: 0 0 24px 6px rgba(245,158,11,0.12); } }
    @keyframes countUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
    .lane-card { animation: fadeUp 0.45s cubic-bezier(.22,1,.36,1) both; }
    .lane-row:hover td { background: #1a1612 !important; }
    .lane-pill-btn { transition: all 0.15s ease; }
    .lane-pill-btn:hover { opacity: 0.85; transform: translateY(-1px); }
    .lane-stat-num { animation: countUp 0.6s cubic-bezier(.22,1,.36,1) both; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #141210; }
    ::-webkit-scrollbar-thumb { background: #2e2920; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #3e3828; }
  `;
  document.head.appendChild(el);
};

/* ─── Constants ──────────────────────────────────────────────────────────────── */
const STATUS_META: Record<ApplicationStatus, { label: string; color: string; bg: string; text: string }> = {
  saved:        { label: 'Saved',        color: '#60a5fa', bg: '#172133', text: '#60a5fa' },
  applied:      { label: 'Applied',      color: '#f59e0b', bg: '#2a1f0a', text: '#f59e0b' },
  phone_screen: { label: 'Phone Screen', color: '#a78bfa', bg: '#1e1630', text: '#a78bfa' },
  interview:    { label: 'Interview',    color: '#34d399', bg: '#0d2620', text: '#34d399' },
  offer:        { label: 'Offer',        color: '#10b981', bg: '#082018', text: '#10b981' },
  rejected:     { label: 'Rejected',     color: '#f87171', bg: '#2a1010', text: '#f87171' },
  withdrew:     { label: 'Withdrew',     color: '#9ca3af', bg: '#1a1a1a', text: '#9ca3af' },
  ghosted:      { label: 'Ghosted',      color: '#6b7280', bg: '#161616', text: '#6b7280' },
};
const ALL_STATUSES = Object.keys(STATUS_META) as ApplicationStatus[];

/* ─── useCountUp hook ────────────────────────────────────────────────────────── */
function useCountUp(target: number, duration = 900, delay = 0): number {
  const [val, setVal] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    timeout = setTimeout(() => {
      const start = performance.now();
      const animate = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(Math.round(eased * target));
        if (p < 1) raf.current = requestAnimationFrame(animate);
      };
      raf.current = requestAnimationFrame(animate);
    }, delay);
    return () => { clearTimeout(timeout); cancelAnimationFrame(raf.current); };
  }, [target, duration, delay]);
  return val;
}

/* ─── StatCard ───────────────────────────────────────────────────────────────── */
interface StatCardProps {
  label: string;
  value: number;
  sub?: string;
  pct?: number;
  color: string;
  delay?: number;
}
function StatCard({ label, value, sub, pct, color, delay = 0 }: StatCardProps) {
  const animated = useCountUp(value, 900, delay);
  const animPct = useCountUp(pct ?? 0, 900, delay + 150);
  return (
    <div className="lane-card" style={{
      background: '#141210',
      border: `1px solid #2a2520`,
      borderRadius: 14,
      padding: '20px 22px',
      flex: 1,
      minWidth: 140,
      animationDelay: `${delay}ms`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        opacity: 0.8,
      }} />
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6a6050', marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="lane-stat-num" style={{ fontSize: 38, fontWeight: 800, lineHeight: 1, color: '#f0ebe0', fontVariantNumeric: 'tabular-nums' }}>
          {animated}
        </span>
        {pct !== undefined && (
          <span style={{ fontSize: 14, fontWeight: 600, color }}>
            {animPct}%
          </span>
        )}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: '#5a5040', marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}

/* ─── Sankey Chart (pure SVG) ────────────────────────────────────────────────── */
interface SankeyNode {
  id: string;
  label: string;
  count: number;
  color: string;
  col: number;
  x: number;
  y: number;
  h: number;
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
  color: string;
}

interface SankeyProps {
  submitted: number;
  screened: number;
  pending: number;
  exited: number;
  interviewed: number;
  screenedOnly: number;
  offered: number;
  interviewedOnly: number;
}

function SankeyChart({ submitted, screened, pending, exited, interviewed, screenedOnly, offered, interviewedOnly }: SankeyProps) {
  const W = 680, H = 280;
  const PAD_Y = 20;
  const NODE_W = 14;
  const GAP = 6;
  const BASE = Math.max(1, submitted);
  const MAX_H = H - PAD_Y * 2;

  const getH = (n: number) => Math.max(n > 0 ? 8 : 0, (n / BASE) * MAX_H);

  // Col 0: Submitted
  const col0x = 30;
  const n_sub: SankeyNode = { id: 'sub', label: 'Submitted', count: submitted, color: '#f59e0b', col: 0, x: col0x, y: PAD_Y, h: MAX_H };

  // Col 1: screened | pending | exited
  const col1x = 220;
  const h_sc = getH(screened), h_pe = getH(pending), h_ex = getH(exited);
  const n_sc: SankeyNode  = { id: 'sc',  label: 'Screened',  count: screened, color: '#a78bfa', col: 1, x: col1x, y: PAD_Y, h: h_sc };
  const n_pe: SankeyNode  = { id: 'pe',  label: 'Pending',   count: pending,  color: '#60a5fa', col: 1, x: col1x, y: PAD_Y + h_sc + (h_sc > 0 ? GAP : 0), h: h_pe };
  const n_ex: SankeyNode  = { id: 'ex',  label: 'Exited',    count: exited,   color: '#f87171', col: 1, x: col1x, y: PAD_Y + h_sc + (h_sc > 0 ? GAP : 0) + h_pe + (h_pe > 0 ? GAP : 0), h: h_ex };

  // Col 2: interviewed | screened-only (from screened)
  const col2x = 430;
  const h_iv = getH(interviewed), h_so = getH(screenedOnly);
  const n_iv: SankeyNode  = { id: 'iv',  label: 'Interviewed', count: interviewed,  color: '#34d399', col: 2, x: col2x, y: n_sc.y, h: h_iv };
  const n_so: SankeyNode  = { id: 'so',  label: 'Screened Out', count: screenedOnly, color: '#6b7280', col: 2, x: col2x, y: n_sc.y + h_iv + (h_iv > 0 ? GAP : 0), h: h_so };

  // Col 3: offered | not-yet-offered (from interviewed)
  const col3x = 630;
  const h_of = getH(offered), h_no = getH(interviewedOnly);
  const n_of: SankeyNode  = { id: 'of',  label: 'Offer',        count: offered,         color: '#10b981', col: 3, x: col3x, y: n_iv.y, h: h_of };
  const n_no: SankeyNode  = { id: 'no',  label: 'No Offer Yet', count: interviewedOnly,  color: '#60a5fa', col: 3, x: col3x, y: n_iv.y + h_of + (h_of > 0 ? GAP : 0), h: h_no };

  type Offsets = Record<string, number>;
  const srcOff: Offsets = {};
  const tgtOff: Offsets = {};

  function linkPath(src: SankeyNode, tgt: SankeyNode, val: number, color: string) {
    if (val <= 0 || src.h <= 0 || tgt.h <= 0) return null;
    const lh = (val / BASE) * MAX_H;
    const sy0 = src.y + (srcOff[src.id] || 0);
    const sy1 = sy0 + lh;
    srcOff[src.id] = (srcOff[src.id] || 0) + lh;
    const ty0 = tgt.y + (tgtOff[tgt.id] || 0);
    const ty1 = ty0 + lh;
    tgtOff[tgt.id] = (tgtOff[tgt.id] || 0) + lh;
    const sx = src.x + NODE_W, tx = tgt.x;
    const cp = (sx + tx) / 2;
    const d = [
      `M ${sx} ${sy0}`,
      `C ${cp} ${sy0} ${cp} ${ty0} ${tx} ${ty0}`,
      `L ${tx} ${ty1}`,
      `C ${cp} ${ty1} ${cp} ${sy1} ${sx} ${sy1}`,
      'Z',
    ].join(' ');
    return { d, color };
  }

  const links = [
    linkPath(n_sub, n_sc,  screened, '#a78bfa'),
    linkPath(n_sub, n_pe,  pending,  '#60a5fa'),
    linkPath(n_sub, n_ex,  exited,   '#f87171'),
    linkPath(n_sc,  n_iv,  interviewed,  '#34d399'),
    linkPath(n_sc,  n_so,  screenedOnly, '#4b5563'),
    linkPath(n_iv,  n_of,  offered,         '#10b981'),
    linkPath(n_iv,  n_no,  interviewedOnly, '#60a5fa'),
  ].filter(Boolean) as { d: string; color: string }[];

  const nodes = [n_sub, n_sc, n_pe, n_ex, n_iv, n_so, n_of, n_no].filter(n => n.h > 0 && n.count > 0);

  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; count: number; color: string } | null>(null);

  if (submitted === 0) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: H, color: '#4a4030', fontSize: 14 }}>
      No applications yet — apply to jobs and Lane will map your pipeline here.
    </div>
  );

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        <defs>
          {nodes.map(n => (
            <linearGradient key={`g-${n.id}`} id={`g-${n.id}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={n.color} stopOpacity="0.9" />
              <stop offset="100%" stopColor={n.color} stopOpacity="0.7" />
            </linearGradient>
          ))}
        </defs>

        {/* Links */}
        {links.map((l, i) => (
          <path key={i} d={l.d} fill={l.color} fillOpacity={0.18} stroke={l.color} strokeOpacity={0.08} strokeWidth={0.5} />
        ))}

        {/* Nodes */}
        {nodes.map(n => (
          <g key={n.id}
            style={{ cursor: 'pointer' }}
            onMouseEnter={e => {
              const svgRect = (e.currentTarget.closest('svg') as SVGSVGElement).getBoundingClientRect();
              const parent = (e.currentTarget.closest('svg') as SVGSVGElement).parentElement!.getBoundingClientRect();
              setTooltip({ x: e.clientX - parent.left, y: e.clientY - parent.top - 12, label: n.label, count: n.count, color: n.color });
            }}
            onMouseLeave={() => setTooltip(null)}
          >
            <rect x={n.x} y={n.y} width={NODE_W} height={Math.max(n.h, 4)} rx={3} fill={`url(#g-${n.id})`} />
            {/* Label */}
            {n.col === 0 && (
              <text x={n.x - 6} y={n.y + n.h / 2} textAnchor="end" dominantBaseline="middle" fill="#8a7a60" fontSize={11} fontWeight={600}>{n.label}</text>
            )}
            {n.col > 0 && n.col < 3 && n.h > 20 && (
              <text x={n.x + NODE_W + 6} y={n.y + n.h / 2} textAnchor="start" dominantBaseline="middle" fill="#8a7a60" fontSize={10} fontWeight={600}>{n.label}</text>
            )}
            {n.col === 3 && n.h > 16 && (
              <text x={n.x + NODE_W + 6} y={n.y + n.h / 2} textAnchor="start" dominantBaseline="middle" fill={n.color} fontSize={11} fontWeight={700}>
                {n.count}
              </text>
            )}
          </g>
        ))}

        {/* Col labels */}
        {[
          { x: 30 + NODE_W / 2, label: 'Applied' },
          { x: 220 + NODE_W / 2, label: 'Screened' },
          { x: 430 + NODE_W / 2, label: 'Interviewed' },
          { x: 630 + NODE_W / 2, label: 'Offered' },
        ].map(c => (
          <text key={c.label} x={c.x} y={H - 4} textAnchor="middle" fill="#3a3020" fontSize={10} fontWeight={700} letterSpacing="0.05em">
            {c.label.toUpperCase()}
          </text>
        ))}
      </svg>

      {tooltip && (
        <div style={{
          position: 'absolute', left: tooltip.x + 10, top: tooltip.y,
          background: '#1c1916', border: `1px solid ${tooltip.color}44`,
          borderRadius: 8, padding: '8px 12px', pointerEvents: 'none', zIndex: 50,
        }}>
          <div style={{ fontSize: 11, color: tooltip.color, fontWeight: 700, marginBottom: 2 }}>{tooltip.label}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#f0ebe0' }}>{tooltip.count}</div>
        </div>
      )}
    </div>
  );
}

/* ─── FunnelBar ──────────────────────────────────────────────────────────────── */
function FunnelBar({ label, count, total, color, delay = 0 }: { label: string; count: number; total: number; color: string; delay?: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const animPct = useCountUp(pct, 800, delay);
  const animCount = useCountUp(count, 800, delay);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#9a8a70' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
          {animCount} <span style={{ color: '#5a5040', fontWeight: 500 }}>({animPct}%)</span>
        </span>
      </div>
      <div style={{ height: 6, background: '#1e1c18', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color,
          borderRadius: 3, transition: 'width 0.9s cubic-bezier(.22,1,.36,1)',
          boxShadow: `0 0 8px ${color}60`,
        }} />
      </div>
    </div>
  );
}

/* ─── Main App ───────────────────────────────────────────────────────────────── */
export default function App() {
  useEffect(() => { injectStyles(); }, []);

  const [apps, setApps] = useState<Application[]>([]);
  const [filter, setFilter] = useState<ApplicationStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'captured_at' | 'company' | 'status'>('captured_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'pipeline' | 'funnel'>('pipeline');

  async function load() { setApps(await getApplications()); }
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const sub = apps.filter(a => a.status !== 'saved');
    const sc  = apps.filter(a => ['phone_screen', 'interview', 'offer'].includes(a.status));
    const iv  = apps.filter(a => ['interview', 'offer'].includes(a.status));
    return {
      total:           apps.length,
      submitted:       sub.length,
      pending:         apps.filter(a => a.status === 'applied').length,
      screened:        sc.length,
      exited:          apps.filter(a => ['rejected', 'ghosted', 'withdrew'].includes(a.status)).length,
      interviewed:     iv.length,
      screenedOnly:    apps.filter(a => a.status === 'phone_screen').length,
      offered:         apps.filter(a => a.status === 'offer').length,
      interviewedOnly: apps.filter(a => a.status === 'interview').length,
      rejected:        apps.filter(a => a.status === 'rejected').length,
      ghosted:         apps.filter(a => a.status === 'ghosted').length,
      saved:           apps.filter(a => a.status === 'saved').length,
    };
  }, [apps]);

  const metrics = useMemo(() => ({
    responseRate: counts.submitted > 0 ? Math.round((counts.screened / counts.submitted) * 100) : 0,
    interviewRate: counts.submitted > 0 ? Math.round((counts.interviewed / counts.submitted) * 100) : 0,
    offerRate: counts.screened > 0 ? Math.round((counts.offered / counts.screened) * 100) : 0,
  }), [counts]);

  const visible = useMemo(() => {
    let list = [...apps];
    if (filter !== 'all') list = list.filter(a => a.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.company.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q) ||
        (a.location ?? '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const av = a[sortKey] ?? '', bv = b[sortKey] ?? '';
      return sortDir === 'asc' ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    });
    return list;
  }, [apps, filter, search, sortKey, sortDir]);

  async function handleStatusChange(id: string, status: ApplicationStatus) {
    await updateApplication(id, { status });
    setEditingId(null);
    await load();
  }

  async function handleDelete(id: string) {
    const updated = apps.filter(a => a.id !== id);
    await chrome.storage.local.set({ lane_applications: updated });
    setApps(updated);
    setDeleteConfirm(null);
  }

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const SortArrow = ({ col }: { col: typeof sortKey }) =>
    sortKey === col ? <span style={{ marginLeft: 3, opacity: 0.5, fontSize: 10 }}>{sortDir === 'asc' ? '▲' : '▼'}</span> : null;

  /* ─ Styles ─ */
  const page: React.CSSProperties = { background: '#0c0a08', minHeight: '100vh', color: '#f0ebe0' };

  const header: React.CSSProperties = {
    background: '#0e0c0a',
    borderBottom: '1px solid #1e1c18',
    padding: '0 32px',
    height: 54,
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    position: 'sticky',
    top: 0,
    zIndex: 20,
    backdropFilter: 'blur(12px)',
  };

  const main: React.CSSProperties = { maxWidth: 1200, margin: '0 auto', padding: '28px 24px' };

  const card: React.CSSProperties = {
    background: '#141210',
    border: '1px solid #2a2520',
    borderRadius: 16,
    overflow: 'hidden',
  };

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    border: '1px solid #2a2520',
    borderRadius: 8,
    fontSize: 13,
    background: '#1a1816',
    color: '#f0ebe0',
    outline: 'none',
    transition: 'border-color 0.15s',
  };

  const th: React.CSSProperties = {
    textAlign: 'left',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    color: '#4a4030',
    padding: '12px 14px',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    background: '#0f0e0b',
    borderBottom: '1px solid #1e1c18',
  };

  const td: React.CSSProperties = {
    padding: '13px 14px',
    fontSize: 13,
    borderTop: '1px solid #1a1816',
    verticalAlign: 'middle',
    transition: 'background 0.12s',
  };

  const sectionTab = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    background: active ? '#2a2520' : 'transparent',
    color: active ? '#f0ebe0' : '#5a5040',
    transition: 'all 0.15s',
  });

  return (
    <div style={page}>
      {/* Header */}
      <div style={header}>
        <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.03em', color: '#f0ebe0' }}>Lane</span>
        <span style={{ width: 1, height: 16, background: '#2a2520' }} />
        <span style={{ fontSize: 12, color: '#4a4030', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Dashboard</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#4a4030', fontWeight: 600 }}>
          {counts.total} tracked · {counts.submitted} submitted
        </span>
      </div>

      <div style={main}>
        {/* Stat Cards */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <StatCard label="Total Tracked"   value={counts.total}       color="#f59e0b" delay={0}   sub={`${counts.saved} saved · ${counts.submitted} submitted`} />
          <StatCard label="Response Rate"   value={counts.screened}    color="#a78bfa" delay={80}  pct={metrics.responseRate}   sub="got to screening stage" />
          <StatCard label="Interview Rate"  value={counts.interviewed} color="#34d399" delay={160} pct={metrics.interviewRate}  sub="got to interview stage" />
          <StatCard label="Offer Rate"      value={counts.offered}     color="#10b981" delay={240} pct={metrics.offerRate}      sub="offers from screened" />
        </div>

        {/* Charts section */}
        <div style={{ ...card, marginBottom: 24, padding: '22px 24px' }} className="lane-card">
          {/* Section tabs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#d0c8b0', marginBottom: 3 }}>Application Pipeline</div>
              <div style={{ fontSize: 11, color: '#4a4030' }}>Flow from submission → offer</div>
            </div>
            <div style={{ display: 'flex', gap: 4, background: '#0e0c0a', borderRadius: 10, padding: 3 }}>
              <button style={sectionTab(activeSection === 'pipeline')} onClick={() => setActiveSection('pipeline')}>Sankey</button>
              <button style={sectionTab(activeSection === 'funnel')}   onClick={() => setActiveSection('funnel')}>Funnel</button>
            </div>
          </div>

          {activeSection === 'pipeline' && (
            <SankeyChart
              submitted={counts.submitted}
              screened={counts.screened}
              pending={counts.pending}
              exited={counts.exited}
              interviewed={counts.interviewed}
              screenedOnly={counts.screenedOnly}
              offered={counts.offered}
              interviewedOnly={counts.interviewedOnly}
            />
          )}

          {activeSection === 'funnel' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, padding: '10px 0' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#5a5040', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 16 }}>Conversion Funnel</div>
                <FunnelBar label="Submitted Applications" count={counts.submitted} total={counts.submitted} color="#f59e0b" delay={0} />
                <FunnelBar label="Reached Phone Screen"   count={counts.screened}    total={counts.submitted} color="#a78bfa" delay={100} />
                <FunnelBar label="Reached Interview"      count={counts.interviewed} total={counts.submitted} color="#34d399" delay={200} />
                <FunnelBar label="Received Offer"         count={counts.offered}     total={counts.submitted} color="#10b981" delay={300} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#5a5040', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 16 }}>Exit Breakdown</div>
                <FunnelBar label="Rejected"   count={counts.rejected}  total={counts.submitted} color="#f87171" delay={50} />
                <FunnelBar label="Ghosted"    count={counts.ghosted}   total={counts.submitted} color="#6b7280" delay={150} />
                <FunnelBar label="Pending"    count={counts.pending}   total={counts.submitted} color="#60a5fa" delay={250} />
              </div>
            </div>
          )}
        </div>

        {/* Filter + Search */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <button
            className="lane-pill-btn"
            style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: filter === 'all' ? '#2a2520' : 'transparent',
              color: filter === 'all' ? '#f0ebe0' : '#5a5040',
              outline: filter === 'all' ? 'none' : '1px solid #2a2520',
            }}
            onClick={() => setFilter('all')}
          >All <span style={{ opacity: 0.5, fontWeight: 500 }}>{apps.length}</span></button>

          {ALL_STATUSES.map(s => {
            const cnt = apps.filter(a => a.status === s).length;
            if (cnt === 0) return null;
            const m = STATUS_META[s];
            return (
              <button key={s}
                className="lane-pill-btn"
                onClick={() => setFilter(s)}
                style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                  background: filter === s ? m.bg : 'transparent',
                  color: filter === s ? m.color : '#5a5040',
                  outline: filter === s ? 'none' : '1px solid #2a2520',
                }}
              >{m.label} <span style={{ opacity: 0.5, fontWeight: 500 }}>{cnt}</span></button>
            );
          })}

          <input
            style={{ ...inputStyle, marginLeft: 'auto', width: 220 }}
            placeholder="Search company, role…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        {visible.length === 0 ? (
          <div style={{ ...card, padding: '60px 0', textAlign: 'center', color: '#3a3020', fontSize: 14 }}>
            {apps.length === 0
              ? <>No applications yet.<br /><span style={{ fontSize: 12, color: '#2a2010', marginTop: 8, display: 'block' }}>Open a job posting and Lane will auto-detect and track it.</span></>
              : 'No results for current filter.'}
          </div>
        ) : (
          <div style={card}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th} onClick={() => toggleSort('company')}>Company <SortArrow col="company" /></th>
                  <th style={{ ...th, cursor: 'default' }}>Role</th>
                  <th style={{ ...th, cursor: 'default' }}>Location</th>
                  <th style={th} onClick={() => toggleSort('status')}>Status <SortArrow col="status" /></th>
                  <th style={th} onClick={() => toggleSort('captured_at')}>Tracked <SortArrow col="captured_at" /></th>
                  <th style={{ ...th, cursor: 'default' }}>Applied</th>
                  <th style={{ ...th, cursor: 'default' }}>Resume</th>
                  <th style={{ ...th, cursor: 'default', textAlign: 'right' }}></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((app, i) => {
                  const m = STATUS_META[app.status];
                  return (
                    <tr key={app.id} className="lane-row" style={{ animationDelay: `${i * 25}ms` }}>
                      <td style={td}>
                        <a href={app.job_url} target="_blank" rel="noreferrer"
                          style={{ fontWeight: 700, color: '#d0c8b0', textDecoration: 'none', fontSize: 14 }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#f0ebe0')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#d0c8b0')}
                        >{app.company}</a>
                      </td>
                      <td style={{ ...td, color: '#8a7a60', maxWidth: 240 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.role}</div>
                        {app.notes && (
                          <div style={{ fontSize: 11, color: '#4a3a28', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {app.notes}
                          </div>
                        )}
                      </td>
                      <td style={{ ...td, color: '#5a5040', fontSize: 12 }}>{app.location ?? '—'}</td>
                      <td style={td}>
                        {editingId === app.id ? (
                          <select
                            autoFocus
                            style={{ ...inputStyle, padding: '4px 8px', fontSize: 12 }}
                            value={app.status}
                            onChange={e => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                            onBlur={() => setEditingId(null)}
                          >
                            {ALL_STATUSES.map(s => (
                              <option key={s} value={s}>{STATUS_META[s].label}</option>
                            ))}
                          </select>
                        ) : (
                          <span
                            onClick={() => setEditingId(app.id)}
                            title="Click to update status"
                            style={{
                              background: m.bg, color: m.color,
                              borderRadius: 6, padding: '3px 9px',
                              fontSize: 11, fontWeight: 700,
                              cursor: 'pointer', whiteSpace: 'nowrap',
                              border: `1px solid ${m.color}30`,
                              transition: 'all 0.15s',
                              display: 'inline-block',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = m.color + '80'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = m.color + '30'; }}
                          >{m.label}</span>
                        )}
                      </td>
                      <td style={{ ...td, color: '#5a5040', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                        {new Date(app.captured_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                      </td>
                      <td style={{ ...td, color: '#5a5040', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                        {app.applied_at ? new Date(app.applied_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '—'}
                      </td>
                      <td style={{ ...td, color: '#4a3a28', fontSize: 12 }}>
                        {app.resume_version
                          ? <span style={{ background: '#1e1c14', border: '1px solid #2a2510', borderRadius: 4, padding: '2px 6px', fontSize: 11 }}>{app.resume_version}</span>
                          : '—'}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        {deleteConfirm === app.id ? (
                          <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button onClick={() => handleDelete(app.id)}
                              style={{ background: '#3a1010', border: '1px solid #f8717140', color: '#f87171', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                              Delete
                            </button>
                            <button onClick={() => setDeleteConfirm(null)}
                              style={{ background: 'none', border: '1px solid #2a2520', color: '#6a6050', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(app.id)}
                            style={{ background: 'none', border: 'none', color: '#3a3020', cursor: 'pointer', fontSize: 16, padding: '0 4px', transition: 'color 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#3a3020'; }}
                            title="Remove"
                          >×</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 20, fontSize: 11, color: '#2a2010', textAlign: 'center' }}>
          All data stored locally in your browser · Click any status pill to update it
        </div>
      </div>
    </div>
  );
}
