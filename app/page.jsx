'use client';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { TOKEN } from '../token.config';
import { ema, computeTrend, autoStructure, buildForecast } from '../lib/ta';

const GRN = '#22c55e', BLU = '#5b8cff', AMB = '#f59e0b', RED = '#ef4444', PUR = '#8b5cf6';
const MONO = "'JetBrains Mono',monospace", SANS = "'Plus Jakarta Sans',system-ui,sans-serif";
const panel = { border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', padding: 16 };
const utm = (m) => `https://10am.pro?utm_source=${TOKEN.slug}&utm_medium=${m}&utm_campaign=hub`;

// ---------- formatters ----------
const fmtInt = (n) => (n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('en-US'));
const fmtUsd = (n) => { if (n == null || isNaN(n)) return '—'; const a = Math.abs(n); if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'; if (a >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'k'; return '$' + n.toFixed(2); };
const fmtNum = (n) => { if (n == null || isNaN(n)) return '—'; const a = Math.abs(n); if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M'; if (a >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(Math.round(n)); };
const fmtPx = (n) => (n == null || isNaN(n) ? '—' : '$' + (n >= 100 ? n.toFixed(2) : n >= 1 ? n.toFixed(3) : Number(n).toPrecision(4)));
const fmtBy = (v, unit) => (unit === 'usd' ? fmtUsd(v) : unit === 'pct' ? (v == null ? '—' : v.toFixed(1) + '%') : fmtNum(v));
const pc = (x, d = 1) => (x == null || isNaN(x) ? '—' : `${x >= 0 ? '+' : ''}${(x * 100).toFixed(d)}%`);
const monthLabel = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
const dayLabel = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const pill = (color, bg) => ({ color, background: bg, fontSize: 11, fontWeight: 600, padding: '1px 5px', borderRadius: 3, letterSpacing: '.02em' });
const tripStyle = { pass: [GRN, 'rgba(34,197,94,.14)'], fail: [RED, 'rgba(239,68,68,.14)'], watch: [AMB, 'rgba(245,158,11,.14)'] };

// ---------- SVG area chart ----------
function AreaChart({ points, color, fmtY, height = 240, monthly = false }) {
  const wrapRef = useRef(null); const [w, setW] = useState(680); const [hover, setHover] = useState(null);
  useEffect(() => { if (!wrapRef.current) return; const ro = new ResizeObserver((es) => setW(Math.max(280, es[0].contentRect.width))); ro.observe(wrapRef.current); return () => ro.disconnect(); }, []);
  const pad = { l: 56, r: 12, t: 14, b: 26 }, iw = w - pad.l - pad.r, ih = height - pad.t - pad.b;
  const data = points || [], ready = data.length > 1, ys = data.map((p) => p.y);
  const yMin = ready ? Math.min(...ys) : 0, yMax = ready ? Math.max(...ys) : 1, span = yMax - yMin || 1, lo = yMin - span * 0.08, hi = yMax + span * 0.08;
  const X = (i) => pad.l + (data.length <= 1 ? 0 : (i / (data.length - 1)) * iw), Y = (v) => pad.t + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const line = ready ? data.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ') : '';
  const area = ready ? `${line} L${X(data.length - 1).toFixed(1)},${(pad.t + ih).toFixed(1)} L${X(0).toFixed(1)},${(pad.t + ih).toFixed(1)} Z` : '';
  const gridY = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  const gid = useMemo(() => 'g' + Math.random().toString(36).slice(2, 8), []);
  const onMove = (e) => { if (!ready) return; const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * w; setHover(Math.max(0, Math.min(data.length - 1, Math.round(((px - pad.l) / (iw || 1)) * (data.length - 1))))); };
  return (
    <div ref={wrapRef} style={{ width: '100%', position: 'relative' }}>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: 'block' }}>
        <defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.28" /><stop offset="100%" stopColor={color} stopOpacity="0.02" /></linearGradient></defs>
        {gridY.map((v, i) => <g key={i}><line x1={pad.l} x2={w - pad.r} y1={Y(v)} y2={Y(v)} stroke="rgba(255,255,255,.05)" /><text x={pad.l - 8} y={Y(v) + 3} textAnchor="end" fontSize="10" fill="var(--text-muted)" fontFamily={MONO}>{fmtY ? fmtY(v) : Math.round(v)}</text></g>)}
        {ready && <path d={area} fill={`url(#${gid})`} />}{ready && <path d={line} fill="none" stroke={color} strokeWidth="2" />}
        {ready && [0, Math.floor((data.length - 1) / 2), data.length - 1].map((i, k) => <text key={k} x={X(i)} y={height - 8} textAnchor={k === 0 ? 'start' : k === 2 ? 'end' : 'middle'} fontSize="10" fill="var(--text-muted)" fontFamily={MONO}>{monthly ? monthLabel(data[i].t) : dayLabel(data[i].t)}</text>)}
        {hover != null && ready && <g><line x1={X(hover)} x2={X(hover)} y1={pad.t} y2={pad.t + ih} stroke={color} strokeDasharray="3 3" opacity="0.6" /><circle cx={X(hover)} cy={Y(data[hover].y)} r="3.5" fill={color} /></g>}
        {!ready && <text x={w / 2} y={height / 2} textAnchor="middle" fontSize="11" fill="var(--text-muted)" fontFamily={MONO}>loading series…</text>}
      </svg>
      {hover != null && ready && <div style={{ position: 'absolute', top: 6, left: Math.min(Math.max(8, (X(hover) / w) * (wrapRef.current?.clientWidth || w) - 60), (wrapRef.current?.clientWidth || w) - 130), background: 'var(--bg)', border: `1px solid ${color}`, borderRadius: 4, padding: '5px 8px', fontSize: 11, pointerEvents: 'none', whiteSpace: 'nowrap', fontFamily: MONO }}><div style={{ color: 'var(--text-muted)' }}>{monthly ? monthLabel(data[hover].t) : dayLabel(data[hover].t)}</div><div style={{ color, fontWeight: 700 }}>{fmtY ? fmtY(data[hover].y) : fmtInt(data[hover].y)}</div></div>}
    </div>
  );
}
function Delta({ cur, prev }) {
  if (prev == null || cur == null || isNaN(prev) || isNaN(cur)) return <span style={pill('var(--text-muted)', 'rgba(255,255,255,.04)')}>— no prior</span>;
  const d = cur - prev; if (Math.abs(d) < 1e-9) return <span style={pill('var(--text-muted)', 'rgba(255,255,255,.04)')}>± 0</span>;
  const up = d > 0; return <span style={pill(up ? GRN : RED, up ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)')}>{up ? '▲' : '▼'} {prev !== 0 ? ((d / prev) * 100).toFixed(2) + '%' : 'n/a'}</span>;
}
function Eyebrow({ children, dot = GRN }) { return <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '26px 2px 12px', fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--text-muted)' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: dot }} />{children}</div>; }
const lab = (x, y, txt, col, anchor = 'start', size = 9.5) => <text x={x} y={y} textAnchor={anchor} fontSize={size} fontWeight="700" fill={col} fontFamily={MONO}>{txt}</text>;

// ---------- TA structure chart ----------
function TAStructure({ series, st, fc, mb }) {
  if (!series || series.c.length < 90) return <div style={{ color: 'var(--text-muted)', fontSize: 11, padding: 20 }}>loading structure…</div>;
  const W = 680, H = mb ? 320 : 380, L = 50, R = 60, T = 16, B = 30, DAY = 86400000, keep = 320;
  const sl = (a) => a.slice(-keep); const t = sl(series.t), c = sl(series.c), v = sl(series.v);
  const t0 = t[0], tEnd = t[t.length - 1] + 120 * DAY;
  const xs = (ts) => L + ((ts - t0) / (tEnd - t0)) * (W - L - R);
  const all = c.concat(fc ? fc.path.slice(0, 2).map((p) => p.target) : [], fc ? [fc.invalidation] : []);
  const yMin = Math.min(...all) * 0.88, yMax = Math.max(...all) * 1.1;
  const ys = (p) => T + (1 - (Math.log(p) - Math.log(yMin)) / (Math.log(yMax) - Math.log(yMin))) * (H - T - B);
  const line = (arr) => 'M' + arr.map((p, i) => `${xs(t[i]).toFixed(1)},${ys(p).toFixed(1)}`).join(' L');
  const e20 = sl(ema(series.c, 20)), e50 = sl(ema(series.c, 50)), e200 = sl(ema(series.c, 200));
  const last = c[c.length - 1], lastT = t[t.length - 1]; const vmax = Math.max(1, ...v); const vh = 34;
  const proj = fc ? [[lastT, last]].concat(fc.path.map((p) => [lastT + p.d * DAY, p.target])).filter((p) => p[0] <= tEnd) : [];
  const projD = proj.length > 1 ? 'M' + proj.map((p) => `${xs(p[0]).toFixed(1)},${ys(p[1]).toFixed(1)}`).join(' L') : '';
  const grid = [0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 1, 1.5, 2, 3, 5, 7, 10, 15, 20, 30, 50].filter((g) => g > yMin && g < yMax);
  const extendTo = st?.apexT ? Math.min(st.apexT + 30 * DAY, tEnd) : tEnd;
  const dirCol = fc?.dir === 'BEAR' ? RED : GRN;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', height: 'auto' }}>
      <defs><clipPath id="taClip"><rect x={L} y={T} width={W - L - R} height={H - T - B} /></clipPath></defs>
      {grid.map((g) => <g key={g}><line x1={L} x2={W - R} y1={ys(g)} y2={ys(g)} stroke="rgba(255,255,255,.05)" /><text x={L - 5} y={ys(g) + 3} textAnchor="end" fontSize="9.5" fill="var(--text-muted)" fontFamily={MONO}>${g}</text></g>)}
      {t.filter((ts, i) => i === 0 || new Date(ts).getUTCMonth() !== new Date(t[i - 1]).getUTCMonth()).map((ts) => <text key={ts} x={xs(ts)} y={H - B + 13} fontSize="9" fill="var(--text-muted)" fontFamily={MONO}>{['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'][new Date(ts).getUTCMonth()]}</text>)}
      <rect x={xs(lastT)} y={T} width={W - R - xs(lastT)} height={H - T - B} fill="rgba(255,255,255,.02)" />
      {lab(xs(lastT) + 4, T + 10, 'PROJECTION →', 'var(--text-muted)')}
      {st?.res && st?.sup && st.apexT && <path d={`M${xs(st.res.a[0])},${ys(st.res.a[1])} L${xs(st.res.a[0])},${ys(st.sup.yAt(st.res.a[0]))} L${xs(st.apexT)},${ys(st.res.yAt(st.apexT))} Z`} fill={AMB} opacity="0.07" clipPath="url(#taClip)" />}
      <g clipPath="url(#taClip)">{v.map((vol, i) => <rect key={i} x={xs(t[i]) - 0.6} y={H - B - (vol / vmax) * vh} width="1.2" height={(vol / vmax) * vh} fill={i > 0 && c[i] >= c[i - 1] ? GRN : RED} opacity="0.35" />)}</g>
      <path d={line(e200)} fill="none" stroke="#3b5bdb" strokeWidth="1.4" clipPath="url(#taClip)" />
      <path d={line(e50)} fill="none" stroke={AMB} strokeWidth="1" opacity=".8" clipPath="url(#taClip)" />
      <path d={line(e20)} fill="none" stroke={RED} strokeWidth="1" opacity=".7" clipPath="url(#taClip)" />
      <path d={line(c)} fill="none" stroke="var(--text-primary)" strokeWidth="1.5" clipPath="url(#taClip)" />
      {st?.res && <line x1={xs(st.res.a[0])} y1={ys(st.res.a[1])} x2={xs(extendTo)} y2={ys(Math.max(yMin * 1.01, st.res.yAt(extendTo)))} stroke={RED} strokeWidth="1.6" strokeDasharray="5 3" />}
      {st?.sup && <line x1={xs(st.sup.a[0])} y1={ys(st.sup.a[1])} x2={xs(extendTo)} y2={ys(Math.max(yMin * 1.01, st.sup.yAt(extendTo)))} stroke={GRN} strokeWidth="1.6" strokeDasharray="5 3" />}
      {st?.res && lab(xs(st.res.a[0]) - 4, ys(st.res.a[1]) - 14, `Lower highs · ${st.res.touches} touches`, RED, 'end')}
      {st?.sup && lab(xs(st.sup.a[0]) + 14, ys(st.sup.a[1]) + 4, `Higher lows · ${st.sup.touches} touches`, GRN)}
      {(st?.highs || []).map((p, i) => <g key={'h' + i}><circle cx={xs(p[0])} cy={ys(p[1])} r="3.5" fill="#0c0c0e" stroke={RED} strokeWidth="1.5" />{lab(xs(p[0]), ys(p[1]) - 8, `H${i + 1}`, RED, 'middle', 8.5)}</g>)}
      {(st?.lows || []).map((p, i) => <g key={'l' + i}><circle cx={xs(p[0])} cy={ys(p[1])} r="3.5" fill="#0c0c0e" stroke={GRN} strokeWidth="1.5" />{lab(xs(p[0]), ys(p[1]) + 15, `L${i + 1}`, GRN, 'middle', 8.5)}</g>)}
      {st?.apexT && st.apexT < tEnd && <g><line x1={xs(st.apexT)} x2={xs(st.apexT)} y1={T} y2={H - B} stroke={AMB} strokeDasharray="2 4" />{lab(xs(st.apexT) + 4, T + 24, `APEX ~${new Date(st.apexT).toLocaleDateString('es', { day: '2-digit', month: 'short' })}`, AMB)}</g>}
      {fc && <g><line x1={xs(lastT - 30 * DAY)} x2={W - R} y1={ys(fc.invalidation)} y2={ys(fc.invalidation)} stroke={fc.dir === 'BEAR' ? GRN : RED} strokeWidth="1.2" strokeDasharray="6 3" />{lab(W - R - 4, ys(fc.invalidation) - 4, `INVALIDATION ${fc.invalidation}`, fc.dir === 'BEAR' ? GRN : RED, 'end')}</g>}
      {projD && <path d={projD} fill="none" stroke={dirCol} strokeWidth="2" opacity=".9" />}
      {proj.slice(1).map((p, i) => <g key={i}><circle cx={xs(p[0])} cy={ys(p[1])} r="4" fill="#0c0c0e" stroke={dirCol} strokeWidth="2" />{lab(xs(p[0]) + 8, ys(p[1]) + (i === 0 ? -8 : 14), `${fc.path[i].h} $${p[1]}`, dirCol)}</g>)}
      <circle cx={xs(lastT)} cy={ys(last)} r="3.5" fill="#fff" />
      <rect x={W - R + 2} y={ys(last) - 8} width={R - 4} height="16" rx="2" fill="#fff" />
      <text x={W - R + R / 2} y={ys(last) + 3.5} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#000" fontFamily={MONO}>{fmtPx(last).replace('$', '')}</text>
      <g transform={`translate(${L + 6},${H - B - 6})`}>{[['#3b5bdb', 'EMA200'], [AMB, 'EMA50'], [RED, 'EMA20']].map(([col, n], i) => <g key={n} transform={`translate(${i * 62},0)`}><line x1="0" x2="14" y1="-3" y2="-3" stroke={col} strokeWidth="2" /><text x="18" y="0" fontSize="9" fill="var(--text-muted)" fontFamily={MONO}>{n}</text></g>)}</g>
    </svg>
  );
}

// ---------- forecast path chart ----------
function TAFan({ price, fc, mb }) {
  if (!fc) return null;
  const W = 680, H = mb ? 300 : 340, L = 50, R = 64, T = 18, B = 34, px = price || fc.path[0].target;
  const xs = (d) => L + Math.sqrt(d / 365) * (W - L - R);
  const vals = [px, fc.invalidation, ...fc.path.map((p) => p.target)];
  const yMin = Math.min(...vals) * 0.8, yMax = Math.max(...vals) * 1.25;
  const ys = (v) => T + (1 - (Math.log(v) - Math.log(yMin)) / (Math.log(yMax) - Math.log(yMin))) * (H - T - B);
  const P = [{ d: 0, target: px }].concat(fc.path); const pts = P.map((p) => [xs(p.d), ys(p.target)]);
  let dPath = `M${pts[0][0]},${pts[0][1]}`; for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx = (x0 + x1) / 2; dPath += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`; }
  const tol = [0, 0.06, 0.12, 0.22];
  const up = P.map((p, i) => [xs(p.d), ys(p.target * (1 + tol[i]))]), dn = P.map((p, i) => [xs(p.d), ys(p.target * (1 - tol[i]))]).reverse();
  const cone = 'M' + up.concat(dn).map((q) => q.join(',')).join(' L') + ' Z';
  const col = fc.dir === 'BEAR' ? RED : GRN, icol = fc.dir === 'BEAR' ? GRN : RED;
  const grid = [0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 1, 1.5, 2, 3, 5, 7, 10, 15, 20, 30, 50].filter((g) => g > yMin && g < yMax);
  const inv = fc.invalidation;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', height: 'auto' }}>
      <defs><linearGradient id="fanCone" x1="0" x2="1"><stop offset="0%" stopColor={col} stopOpacity="0.05" /><stop offset="100%" stopColor={col} stopOpacity="0.22" /></linearGradient></defs>
      {grid.map((v) => <g key={v}><line x1={L} x2={W - R} y1={ys(v)} y2={ys(v)} stroke="rgba(255,255,255,.05)" /><text x={L - 6} y={ys(v) + 3} textAnchor="end" fontSize="10" fill="var(--text-muted)" fontFamily={MONO}>${v}</text></g>)}
      {P.map((p, i) => <g key={i}><line x1={xs(p.d)} x2={xs(p.d)} y1={T} y2={H - B} stroke="rgba(255,255,255,.07)" strokeDasharray="2 3" /><text x={xs(p.d)} y={H - B + 14} textAnchor={i === 0 ? 'start' : 'middle'} fontSize="10.5" fontWeight="700" fill="var(--text-secondary)" fontFamily={MONO}>{i === 0 ? 'HOY' : p.h}</text></g>)}
      {fc.dir === 'BEAR' ? <rect x={L} y={T} width={W - L - R} height={Math.max(0, ys(inv) - T)} fill={GRN} opacity="0.05" /> : <rect x={L} y={ys(inv)} width={W - L - R} height={Math.max(0, H - B - ys(inv))} fill={RED} opacity="0.05" />}
      <line x1={L} x2={W - R} y1={ys(inv)} y2={ys(inv)} stroke={icol} strokeWidth="1.5" strokeDasharray="6 3" />
      {lab(L + 6, ys(inv) + (fc.dir === 'BEAR' ? -5 : 12), `INVALIDATION ${fc.dir === 'BEAR' ? '›' : '‹'} $${inv}`, icol)}
      <path d={cone} fill="url(#fanCone)" /><path d={dPath} fill="none" stroke={col} strokeWidth="2.4" />
      <line x1={L} x2={W - R} y1={ys(px)} y2={ys(px)} stroke="var(--text-primary)" strokeOpacity=".4" />
      <circle cx={xs(0)} cy={ys(px)} r="4.5" fill="#fff" /><rect x={W - R + 2} y={ys(px) - 8} width={R - 4} height="16" rx="2" fill="#fff" /><text x={W - R + R / 2} y={ys(px) + 3.5} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#000" fontFamily={MONO}>{fmtPx(px).replace('$', '')}</text>
      {fc.path.map((p, i) => { const x = xs(p.d), y = ys(p.target), last = i === fc.path.length - 1; return <g key={p.h}><circle cx={x} cy={y} r="5" fill="#0c0c0e" stroke={col} strokeWidth="2" /><rect x={x - (last ? 64 : 32)} y={y + 10} width="64" height="28" rx="3" fill={col + '24'} stroke={col} strokeOpacity=".5" /><text x={x - (last ? 32 : 0)} y={y + 22} textAnchor="middle" fontSize="11" fontWeight="800" fill={col} fontFamily={MONO}>${p.target}</text><text x={x - (last ? 32 : 0)} y={y + 33} textAnchor="middle" fontSize="9" fill={col} fontFamily={MONO}>{pc(p.target / px - 1, 0)}</text></g>; })}
    </svg>
  );
}

// ============================================================
export default function ThesisPage() {
  const [d, setD] = useState(null); const [prev, setPrev] = useState(null);
  const [net, setNet] = useState(null); const [metric, setMetric] = useState(null);
  const [pxHist, setPxHist] = useState({ price: [], mcap: [] }); const [days, setDays] = useState('365');
  const [trend, setTrend] = useState(null); const [series, setSeries] = useState(null); const [chain, setChain] = useState(null);
  const [snaps, setSnaps] = useState([]); const [updated, setUpdated] = useState('—'); const [clock, setClock] = useState('—'); const [status, setStatus] = useState('booting'); const [mb, setMb] = useState(false);

  useEffect(() => { const f = () => setMb(window.innerWidth < 760); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  useEffect(() => { const t = setInterval(() => setClock(new Date().toLocaleTimeString('en-GB', { hour12: false })), 1000); return () => clearInterval(t); }, []);
  const KEY = `${TOKEN.slug}:snapshots`;
  const loadSnaps = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
  const saveSnaps = (a) => { try { localStorage.setItem(KEY, JSON.stringify(a.slice(-400))); } catch {} };

  const refresh = useCallback(async (manual) => {
    setStatus('fetching…'); const ps = loadSnaps(); setPrev(ps.length ? ps[ps.length - 1] : null);
    let s = {}; try { s = await (await fetch('/api/market', { cache: 'no-store' })).json(); } catch { s = { ok: false }; }
    setD(s); setStatus(s.ok ? 'ok · live feed' : 'market feed unreachable'); setUpdated(new Date().toLocaleTimeString('en-GB', { hour12: false }));
    const snap = { t: new Date().toISOString(), price: s.price, mcap: s.mcap, fdv: s.fdv, vol24: s.vol24 };
    const arr = ps.slice(); const last = arr[arr.length - 1]; const gapH = last ? (Date.now() - new Date(last.t)) / 3600000 : 999;
    if (!last || gapH >= 6 || (manual && gapH > 0.08)) { arr.push(snap); saveSnaps(arr); } setSnaps(arr);
  }, []);
  useEffect(() => { refresh(false); }, [refresh]);
  useEffect(() => { (async () => { try { const j = await (await fetch('/api/network', { cache: 'no-store' })).json(); setNet(j); const keys = Object.keys(j.metrics || {}); setMetric((Object.values(j.metrics || {}).find((m) => m.primary) || j.metrics[keys[0]])?.key || null); } catch { setNet({ metrics: {}, errors: ['fetch failed'] }); } })(); }, []);
  useEffect(() => { (async () => { try { const j = await (await fetch('/api/onchain', { cache: 'no-store' })).json(); setChain(j); } catch {} })(); }, []);
  useEffect(() => { (async () => { try { const j = await (await fetch('/api/market?history=365', { cache: 'no-store' })).json(); const raw = (j.prices || []).filter((q) => q[1] > 0); const pts = raw.map((q) => q[1]); const vols = (j.volumes || []).map((q) => q[1]); setSeries({ t: raw.map((q) => q[0]), c: pts, v: vols }); setTrend(computeTrend(pts, vols)); } catch {} })(); }, []);
  useEffect(() => { (async () => { try { const j = await (await fetch(`/api/market?history=${days}`, { cache: 'no-store' })).json(); const step = Math.max(1, Math.floor((j.prices || []).length / 180)); const price = [], mcap = []; for (let i = 0; i < (j.prices || []).length; i += step) { price.push({ t: j.prices[i][0], y: +j.prices[i][1] }); if (j.market_caps?.[i]) mcap.push({ t: j.market_caps[i][0], y: Math.round(j.market_caps[i][1]) }); } setPxHist({ price, mcap }); } catch { setPxHist({ price: [], mcap: [] }); } })(); }, [days]);

  const st = useMemo(() => autoStructure(series), [series]);
  const fc = useMemo(() => buildForecast(trend, st, series, { ath: d?.ath }), [trend, st, series, d]);
  const M = net?.metrics || {}; const cur = metric ? M[metric] : null;
  const primary = Object.values(M).find((m) => m.primary) || Object.values(M)[0] || null;
  const recPct = primary?.pctOfPeak != null ? Math.round(primary.pctOfPeak * 100) : null;
  const drawdown = d?.price && d?.ath ? Math.round((d.price / d.ath - 1) * 100) : null;
  const netColor = recPct == null ? 'var(--text-primary)' : recPct >= 90 ? GRN : recPct >= 60 ? AMB : RED;
  const divergence = (() => {
    if (recPct != null && recPct < 70 && drawdown != null) return { txt: `${primary.label} at ${recPct}% of peak while price ${drawdown}% below ATH — both soft; no confirmation yet.`, c: AMB };
    if (recPct != null && recPct >= 90 && drawdown != null && drawdown < -50) return { txt: `${primary.label} at ${recPct}% of peak while price sits ${drawdown}% below ATH — fundamentals ahead of the market. That is the divergence a thesis wants.`, c: GRN };
    if (recPct != null && recPct >= 90) return { txt: `${primary.label} at/near peak (${recPct}%) — market is pricing it; upside needs new highs in the metric, not the chart.`, c: 'var(--text-secondary)' };
    return { txt: `${primary?.label || 'Network'} ${recPct != null ? recPct + '% of peak' : '—'} · price ${drawdown != null ? drawdown + '% below ATH' : '—'}.`, c: 'var(--text-secondary)' };
  })();
  const trips = useMemo(() => TOKEN.tripwires({ d, M, chain, trend, fc, st, recPct }), [d, M, chain, trend, fc, st, recPct]);
  const decision = useMemo(() => TOKEN.decision({ d, M, chain, trend, fc, st, recPct, fmtPx }), [d, M, chain, trend, fc, st, recPct]);

  const kpi = (label, value, sub, valColor) => <div style={{ ...panel, padding: '13px 13px 12px', minHeight: 100, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}><div style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</div><div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.01em', lineHeight: 1.05, marginTop: 8, color: valColor || 'var(--text-bright)' }}>{value}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{sub}</div></div>;
  const seg = (on, col = GRN) => ({ fontFamily: MONO, fontSize: 11, padding: '5px 10px', cursor: 'pointer', border: 0, background: on ? col + '22' : 'transparent', color: on ? col : 'var(--text-muted)', letterSpacing: '.03em' });
  const segWrap = { display: 'flex', border: '1px solid var(--border)', borderRadius: 3, overflow: 'hidden', flexWrap: 'wrap' };
  const tile = (k, v, sub, c) => <div style={{ border: '1px solid var(--border)', borderRadius: 4, padding: '8px 10px', minWidth: 0 }}><div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{k}</div><div style={{ fontSize: 15, fontWeight: 800, marginTop: 3, color: c || 'var(--text-primary)' }}>{v}</div>{sub ? <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div> : null}</div>;
  const H = ({ c, children }) => <div style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: c, marginBottom: 4, fontFamily: MONO }}>{children}</div>;
  const B = ({ c, children }) => <div style={{ display: 'flex', gap: 8, fontSize: 11.5, lineHeight: 1.5, marginTop: 4 }}><span style={{ color: c, fontWeight: 800 }}>›</span><span>{children}</span></div>;
  const inv = fc && d?.price != null ? (fc.dir === 'BEAR' ? d.price > fc.invalidation : d.price < fc.invalidation) : false;
  const fcCol = fc?.dir === 'BEAR' ? RED : GRN;

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: mb ? '16px 12px 50px' : '22px 20px 60px', fontFamily: MONO, minHeight: '100vh' }}>
      {/* HEADER */}
      <a href={utm('header')} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}><span style={{ color: '#D4A843' }}>10</span><span style={{ color: GRN }}>AM</span><span style={{ color: 'var(--text-muted)' }}>PRO</span></span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>← 10am.pro</span>
      </a>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '.2em', color: 'var(--text-muted)' }}>THESIS TELEMETRY · {TOKEN.sector.toUpperCase()}</div>
          <div style={{ fontSize: mb ? 24 : 30, fontWeight: 800, letterSpacing: '-.02em', marginTop: 4 }}>{TOKEN.name} <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: mb ? 16 : 20 }}>${TOKEN.symbol}</span></div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, fontFamily: SANS }}>{TOKEN.tagline}</div>
        </div>
        {!mb && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>SYS.TIME <b style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{clock}</b> · UPD <b style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{updated}</b> · <span style={{ color: status.startsWith('ok') ? GRN : AMB }}>{status}</span></div>}
      </div>

      {/* DIVERGENCE STRIP */}
      <div style={{ marginTop: 14, padding: '10px 14px', border: `1px solid ${divergence.c}`, borderRadius: 4, background: 'var(--surface)', fontSize: 12, color: divergence.c, fontFamily: SANS }}>
        <b style={{ fontFamily: MONO, letterSpacing: '.1em', fontSize: 10.5 }}>THESIS DIVERGENCE ·</b> {divergence.txt}
      </div>

      {/* DECISION CARD */}
      {decision && (() => {
        const z = decision.zone;
        return (
          <div style={{ marginTop: 14, border: `1px solid ${z.color}`, borderRadius: 4, background: 'var(--surface)', padding: 14, fontFamily: SANS }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', fontFamily: MONO }}>
              <span style={{ fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Qué hacer con esto · hoy</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: z.color, letterSpacing: '.04em' }}>{z.title}</span>
              {d?.price != null && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{TOKEN.symbol} {fmtPx(d.price)} · stance <b style={{ color: 'var(--text-primary)' }}>{TOKEN.stance.toUpperCase()}</b></span>}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 6 }}>{z.text}</div>
            <div style={{ display: 'grid', gridTemplateColumns: mb ? '1fr' : 'repeat(3,1fr)', gap: 12, marginTop: 12, color: 'var(--text-secondary)' }}>
              {[['Si ya tenés ' + TOKEN.symbol, RED, decision.holders], ['Si querés entrar', GRN, decision.entrants], ['Lo que cambia la tesis', AMB, decision.flips]].map(([t, c, items]) => (
                <div key={t}><H c={c}>{t}</H>{items.map((x, i) => <B key={i} c={c}><span dangerouslySetInnerHTML={{ __html: x }} /></B>)}</div>
              ))}
            </div>
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <span>Niveles y triggers se recalculan con el precio vivo. Marco y sizing son del research de 10AMPRO, no consejo de inversión.</span>
              <a href={utm('decision')} style={{ color: GRN, textDecoration: 'none', marginLeft: 'auto', fontFamily: MONO }}>más tesis en 10am.pro →</a>
            </div>
          </div>
        );
      })()}

      {/* KPIs */}
      <Eyebrow>Core data points</Eyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: mb ? 'repeat(2,1fr)' : 'repeat(6,1fr)', gap: 10 }}>
        {kpi('Price', fmtPx(d?.price), <><Delta cur={d?.price} prev={prev?.price} />{d?.chg != null && <span style={{ color: d.chg >= 0 ? GRN : RED }}>{pc(d.chg / 100)} 24h</span>}</>, BLU)}
        {kpi('Market cap', fmtUsd(d?.mcap), <><Delta cur={d?.mcap} prev={prev?.mcap} /><span>FDV {fmtUsd(d?.fdv)}</span></>, BLU)}
        {kpi('Volume 24h', fmtUsd(d?.vol24), d?.mcap ? `${((d.vol24 / d.mcap) * 100).toFixed(1)}% of mcap` : '—', BLU)}
        {kpi('vs ATH', drawdown != null ? `${drawdown}%` : '—', d?.ath ? `ATH ${fmtPx(d.ath)} · ${d.athDate ? new Date(d.athDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : ''}` : '—', drawdown != null && drawdown < -70 ? RED : 'var(--text-bright)')}
        {kpi('Circulating', d?.circ ? `${(d.circ / (d.max || d.total || d.circ) * 100).toFixed(0)}%` : '—', d?.circ ? `${fmtNum(d.circ)} / ${fmtNum(d.max || d.total)}` : '—', 'var(--text-bright)')}
        {kpi(primary ? primary.label : 'Network', primary ? fmtBy(primary.latest, primary.unit) : '—', primary ? <><span style={{ color: netColor }}>{recPct}% of peak</span><span>peak {fmtBy(primary.peak, primary.unit)} · {primary.peakT ? monthLabel(primary.peakT) : ''}</span></> : 'loading', netColor)}
      </div>

      {/* NETWORK CHART */}
      <Eyebrow>Network evolution — {TOKEN.network.title}</Eyebrow>
      <div style={panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
          <div style={segWrap}>{Object.values(M).map((m) => <button key={m.key} onClick={() => setMetric(m.key)} style={seg(metric === m.key)}>{m.label}</button>)}</div>
          {cur && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>latest <b style={{ color: 'var(--text-primary)' }}>{fmtBy(cur.latest, cur.unit)}</b> · prev <b style={{ color: 'var(--text-primary)' }}>{fmtBy(cur.prev, cur.unit)}</b> · <Delta cur={cur.latest} prev={cur.prev} /> {cur.manual && <span style={{ color: AMB }}>· manual seed</span>}</div>}
        </div>
        <AreaChart points={cur?.monthly || []} color={GRN} fmtY={(v) => fmtBy(v, cur?.unit)} monthly />
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 8, fontFamily: SANS }}>{TOKEN.network.note} {cur?.note ? ` · ${cur.note}` : ''}{net?.errors?.length ? <span style={{ color: RED }}> · partial: {net.errors.join(' · ')}</span> : null}</div>
      </div>

      {/* MARKET CHART */}
      <Eyebrow dot={BLU}>Market — price & market cap</Eyebrow>
      <div style={panel}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><div style={segWrap}>{[['90', '90D'], ['365', '1Y'], ['max', 'MAX']].map(([k, l]) => <button key={k} onClick={() => setDays(k)} style={seg(days === k, BLU)}>{l}</button>)}</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: mb ? '1fr' : '1fr 1fr', gap: 14 }}>
          <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Price (USD)</div><AreaChart points={pxHist.price} color={BLU} fmtY={(v) => fmtPx(v)} height={200} /></div>
          <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Market cap</div><AreaChart points={pxHist.mcap} color={BLU} fmtY={(v) => fmtUsd(v)} height={200} /></div>
        </div>
      </div>

      {/* SUPPLY OVERHANG */}
      <Eyebrow dot={AMB}>Supply overhang — who has to sell · on-chain (Solana) · live</Eyebrow>
      <div style={panel}>
        {!chain ? <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>scanning top holders…</div> : (() => {
          const ho = chain.holders, S = chain.supply, stk = chain.staking;
          const segs = ho ? [['Treasury-shaped', ho.treasuryLike, PUR], ['Staking', Math.max(ho.staking, stk?.total || 0), GRN], ['On exchanges', ho.exchange, RED], ['DEX pools', ho.dex, BLU], ['Vesting-like', ho.vesting, '#a78bfa'], ['Other programs', ho.program, '#64748b']] : [];
          const known = segs.reduce((a, b) => a + b[1], 0);
          const dailyTok = d?.price && d?.vol24 ? d.vol24 / d.price : null;
          const pctS = (n) => (n / S * 100).toFixed(1) + '%';
          return (
            <>
              {segs.length > 0 && <>
                <div style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Supply map · {fmtNum(S)} {TOKEN.symbol} · where the tokens sit (top-20 accounts)</div>
                <div style={{ display: 'flex', height: 22, borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border)' }}>{segs.map(([l, v, c]) => <div key={l} title={`${l}: ${fmtNum(v)} (${pctS(v)})`} style={{ width: `${v / S * 100}%`, background: c, opacity: .85 }} />)}<div style={{ flex: 1, background: 'rgba(255,255,255,.05)' }} /></div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6, fontSize: 10.5, color: 'var(--text-muted)' }}>{segs.map(([l, v, c]) => <span key={l}><span style={{ color: c }}>■</span> {l} <b style={{ color: 'var(--text-primary)' }}>{pctS(v)}</b></span>)}<span><span style={{ color: 'rgba(255,255,255,.25)' }}>■</span> Float/unlabeled <b style={{ color: 'var(--text-primary)' }}>{pctS(S - known)}</b></span></div>
              </>}
              {ho && <div style={{ display: 'grid', gridTemplateColumns: mb ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap: 8, marginTop: 14 }}>
                {tile('Top 10 / Top 20', `${ho.top10pct}% / ${ho.top20pct}%`, 'of total supply', ho.top10pct > 50 ? RED : 'var(--text-primary)')}
                {tile('On exchanges', fmtNum(ho.exchange), dailyTok ? `≈ ${(ho.exchange / dailyTok).toFixed(1)} days of volume` : 'labeled CEX wallets', RED)}
                {tile('Treasury-shaped', fmtNum(ho.treasuryLike), `${ho.top.filter((h) => h.kind === 'treasury_like').length} unlabeled wallets ≥${TOKEN.onchain.treasuryPct || 3}%`, PUR)}
                {tile(stk?.label || 'Staking', stk ? fmtNum(stk.total) + (stk.pct ? ` · ${stk.pct}%` : '') : '—', stk?.note || (stk?.manual ? 'manual · ' + (stk.source || '') : 'program-owned vaults'), GRN)}
                {tile('On-chain supply', fmtNum(chain.onchainSupply), chain.onchainSupply && S ? `${((1 - chain.onchainSupply / S) * 100).toFixed(2)}% burned vs minted` : '', 'var(--text-primary)')}
              </div>}
              {ho && <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Top 20 token accounts</div>
                <div style={{ display: 'grid', gridTemplateColumns: mb ? '1fr' : '1fr 1fr', gap: '2px 14px', fontSize: 11 }}>
                  {ho.top.map((h, i) => { const col = { exchange: RED, treasury_like: PUR, dex: BLU, vesting: '#a78bfa', staking: GRN, program: '#64748b', unlabeled: 'var(--text-muted)' }[h.kind]; return (
                    <div key={h.tokenAccount} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                      <span style={{ width: 18, color: 'var(--text-muted)' }}>{i + 1}</span>
                      <a href={`https://solscan.io/account/${h.owner || h.tokenAccount}`} target="_blank" rel="noopener" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>{(h.owner || h.tokenAccount).slice(0, 4)}…{(h.owner || h.tokenAccount).slice(-4)}</a>
                      <span style={{ color: col, fontSize: 10.5, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.label || '—'}</span>
                      <span style={{ fontWeight: 700 }}>{fmtNum(h.amt)}</span><span style={{ width: 44, textAlign: 'right', color: 'var(--text-muted)' }}>{h.pct}%</span>
                    </div>); })}
                </div>
              </div>}
              <div style={{ marginTop: 12, padding: '10px 12px', border: `1px solid ${AMB}`, borderRadius: 4, background: 'rgba(245,158,11,.05)', fontSize: 11.5, lineHeight: 1.55, color: 'var(--text-secondary)', fontFamily: SANS }}>
                <b style={{ color: AMB, fontFamily: MONO, letterSpacing: '.08em' }}>READ ·</b> <span dangerouslySetInnerHTML={{ __html: TOKEN.onchain.read({ chain, d, fmtNum, pctS }) }} />
              </div>
              {chain.errors?.length > 0 && <div style={{ fontSize: 10.5, color: RED, marginTop: 8 }}>partial: {chain.errors.join(' · ')}</div>}
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 8, fontFamily: SANS }}>Source: Solana RPC on every load — largest token accounts of <code>{chain.mint.slice(0, 4)}…{chain.mint.slice(-4)}</code>, owner programs resolved. Exchange labels are community labels (Solscan), unverified. Cached 10 min.</div>
            </>
          );
        })()}
      </div>

      {/* TECHNICAL ANALYSIS */}
      <Eyebrow dot={fcCol}>Technical analysis — {TOKEN.symbol}/USD 1D · auto-structure + directional forecast 1M / 3M / 1Y · generated {fc?.generated || '…'}</Eyebrow>
      <div style={panel}>
        {/* trend strip */}
        {(() => { const t = trend; const col = !t ? 'var(--text-muted)' : t.score >= 5 ? GRN : t.score === 4 ? AMB : RED; return (
          <div style={{ border: `1px solid ${col}`, borderRadius: 4, padding: 12, background: 'rgba(255,255,255,.015)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Trend now · live</div>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '.06em', color: col }}>{t ? t.regime : 'computing…'}</div>
              {t && <div style={{ display: 'flex', gap: 3 }}>{t.checks.map((x, i) => <span key={i} title={x[0]} style={{ width: 14, height: 6, borderRadius: 2, background: x[1] ? col : 'rgba(255,255,255,.08)' }} />)}</div>}
              {t && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.score}/7 bullish checks</span>}
              {fc && <div style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: inv ? (fc.dir === 'BEAR' ? GRN : RED) : fcCol }}>FORECAST {fc.dir} · {inv ? 'INVALIDATED' : 'INTACT'} {fc.dir === 'BEAR' ? '‹' : '›'} ${fc.invalidation}</div>}
            </div>
            {t && <div style={{ display: 'grid', gridTemplateColumns: mb ? 'repeat(2,1fr)' : 'repeat(6,1fr)', gap: 8, marginTop: 10 }}>
              {tile('EMA stack', `${t.last > t.e20 ? '▲' : '▼'}20 ${t.last > t.e50 ? '▲' : '▼'}50 ${t.last > t.e200 ? '▲' : '▼'}200`, `${fmtPx(t.e20)} · ${fmtPx(t.e50)} · ${fmtPx(t.e200)}`, t.last > t.e200 ? GRN : RED)}
              {tile('EMA200 slope', pc(t.slope200), '20d change', t.slope200 > 0 ? GRN : RED)}
              {tile('MACD histo', (t.hist >= 0 ? '+' : '') + t.hist.toPrecision(2), t.histUp ? 'rising' : 'falling', t.hist > 0 ? GRN : RED)}
              {tile('RSI 14', t.rsi.toFixed(0), t.rsi > 70 ? 'overbought' : t.rsi < 30 ? 'oversold' : 'neutral zone', t.rsi > 50 ? GRN : RED)}
              {tile('7d / 30d', `${pc(t.chg7)} / ${pc(t.chg30)}`, 'momentum', t.chg30 > 0 ? GRN : RED)}
              {tile('Volume 20d/90d', t.volRatio != null ? `${Math.round(t.volRatio * 100)}%` : '—', t.volRatio == null ? '' : t.volRatio < 0.85 ? 'drying up' : t.volRatio > 1.2 ? 'expanding' : 'flat', t.volRatio > 1.2 ? GRN : 'var(--text-primary)')}
            </div>}
          </div>); })()}

        {/* structure chart */}
        <div style={{ marginTop: 14, border: '1px solid var(--border)', borderRadius: 4, padding: '8px 4px 4px' }}>
          <div style={{ display: 'flex', gap: 14, fontSize: 10.5, padding: '0 10px 4px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            <span style={{ color: AMB, fontWeight: 800, letterSpacing: '.1em' }}>STRUCTURE · {(st?.pattern || 'detecting…').toUpperCase()}</span>
            <span><span style={{ color: RED }}>╌</span> lower highs</span><span><span style={{ color: GRN }}>╌</span> higher lows</span><span><span style={{ color: AMB }}>┆</span> apex</span>
            <span style={{ marginLeft: 'auto' }}>320d daily closes · log · volume at base · pivots auto-detected</span>
          </div>
          <TAStructure series={series} st={st} fc={fc} mb={mb} />
        </div>
        {st && fc && trend && <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: mb ? '1fr' : '1fr 1fr', gap: 10, fontSize: 11.5, lineHeight: 1.55, color: 'var(--text-secondary)', fontFamily: SANS }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 4, padding: '10px 12px' }}>
            <div style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: AMB, marginBottom: 6, fontFamily: MONO }}>Pattern read</div>
            <b>{st.pattern}.</b> {st.res ? `Resistance line from ${fmtPx(st.res.a[1])} (${dayLabel(st.res.a[0])}), ${st.res.touches} touches, now at ${fmtPx(st.resNow)}.` : 'No valid resistance line in the window.'} {st.sup ? `Support line from ${fmtPx(st.sup.a[1])} (${dayLabel(st.sup.a[0])}), ${st.sup.touches} touches, now at ${fmtPx(st.supNow)}.` : 'No valid support line.'} {st.apexT ? `Apex ~${new Date(st.apexT).toLocaleDateString('es', { day: '2-digit', month: 'short' })} — breaks before the apex are valid; after it the pattern decays.` : ''} Height ≈ {fmtPx(st.height)} → measured move {fmtPx(st.measured.up)} up / {fmtPx(st.measured.down)} down.
            <div style={{ marginTop: 6 }}><b>Context.</b> EMA200 is {trend.last > trend.e200 ? 'below' : 'above'} price and {trend.slope200 > 0 ? 'rising' : 'falling'}; EMA50 {trend.e50 > trend.e200 ? 'above' : 'below'} EMA200. {trend.last < trend.e200 && trend.slope200 < 0 ? 'That is a bear-market consolidation, not a base — continuation patterns resolve with the prior trend ~2:1.' : trend.last > trend.e200 && trend.slope200 > 0 ? 'Trend structure is constructive; pullbacks to the EMA cluster are buyable while the higher-low sequence holds.' : 'Mixed regime — let the structure resolve before committing size.'}</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 4, padding: '10px 12px' }}>
            <div style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: AMB, marginBottom: 6, fontFamily: MONO }}>What to watch</div>
            <b>Volume.</b> {trend.volRatio != null ? `20d avg is ${Math.round(trend.volRatio * 100)}% of the 90d avg — ${trend.volRatio < 0.85 ? 'drying up, classic pre-break compression' : trend.volRatio > 1.2 ? 'expanding, a move is underway' : 'flat'}.` : ''} A valid break needs ≥2× average volume on the break day.
            <div style={{ marginTop: 6 }}><b>{fc.dir === 'BEAR' ? 'Sequence that confirms the bear path' : 'Sequence that confirms the bull path'}:</b> {fc.dir === 'BEAR' ? `close below EMA20 (${fmtPx(trend.e20)}) → lose the support line (${fmtPx(st.supNow)}) → retest fails → ${fmtPx(fc.path[0].target)}.` : `hold EMA20 (${fmtPx(trend.e20)}) → break the resistance line (${fmtPx(st.resNow)}) on volume → retest holds → ${fmtPx(fc.path[0].target)}.`}</div>
            <div style={{ marginTop: 6 }}><b>What flips it:</b> daily close {fc.dir === 'BEAR' ? 'above' : 'below'} <b>${fc.invalidation}</b> on volume. Until that prints, {fc.dir === 'BEAR' ? `rallies into ${fmtPx(st.resNow || trend.e200)} are for selling, not buying.` : `dips into ${fmtPx(st.supNow || trend.e50)} are for buying, not selling.`}</div>
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(245,158,11,.25)' }}>
              <div style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: AMB, fontFamily: MONO, marginBottom: 3 }}>Decisión</div>
              <div>› Con posición: {fc.dir === 'BEAR' ? <><b>reducir en {fmtPx(st.resNow || trend.e200)}</b>, no esperar más.</> : <><b>mantener mientras aguante {fmtPx(st.supNow || trend.e50)}</b>; añadir solo en retest.</>}</div>
              <div>› Sin posición: <b>esperar la resolución</b>. Comprar dentro del patrón es pagar por incertidumbre.</div>
              <div>› Trigger único: <b>cierre diario {fc.dir === 'BEAR' ? '>' : '<'} ${fc.invalidation} con 2× volumen</b> anula el sesgo.</div>
            </div>
          </div>
        </div>}

        {/* forecast fan */}
        {fc && <>
          <div style={{ marginTop: 14, border: '1px solid var(--border)', borderRadius: 4, padding: '8px 4px 4px' }}>
            <div style={{ display: 'flex', gap: 14, fontSize: 10.5, padding: '0 10px 4px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span style={{ color: fcCol, fontWeight: 800, letterSpacing: '.1em' }}>BIAS: {fc.dir}ISH</span><span><span style={{ color: fcCol }}>▬</span> forecast path</span><span><span style={{ color: fc.dir === 'BEAR' ? GRN : RED }}>╌</span> invalidation</span>
              <span style={{ marginLeft: 'auto' }}>log scale · x = √time · shade = tolerance</span>
            </div>
            <TAFan price={d?.price} fc={fc} mb={mb} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: mb ? '1fr' : 'repeat(3,1fr)', gap: 10, marginTop: 14 }}>
            {fc.path.map((p) => <div key={p.h} style={{ border: '1px solid var(--border)', borderRadius: 4, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', color: 'var(--text-secondary)' }}>{p.h}</span><span style={{ fontSize: 18, fontWeight: 800, color: fcCol }}>${p.target} <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-muted)' }}>{d?.price ? pc(p.target / d.price - 1, 0) : ''}</span></span></div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5, fontFamily: SANS }}>{p.how}</div>
            </div>)}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 12, fontFamily: SANS }}>Forecast is generated from the live regime + auto-detected structure on every load (EMA stack, MACD, RSI, pivot trendlines, measured moves). Targets snap to real levels. Explicit invalidation. Not investment advice.</div>
        </>}
      </div>

      {/* SNAPSHOTS */}
      <Eyebrow>Tracked snapshots — accumulates every visit</Eyebrow>
      <div style={panel}>
        <div style={{ marginBottom: 8 }}><span style={{ fontSize: 13, fontWeight: 700 }}>Data-point log</span> <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· auto-saved in this browser (max 1 per 6h).</span> <button onClick={() => refresh(true)} style={{ ...seg(true), marginLeft: 8, borderRadius: 3 }}>snapshot now</button></div>
        {snaps.length === 0 ? <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No snapshots yet.</div> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr>{['Timestamp', `${TOKEN.symbol} $`, 'Mkt cap', 'FDV', 'Vol 24h'].map((h, i) => <th key={h} style={{ textAlign: i ? 'right' : 'left', padding: '7px 8px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontWeight: 500, fontSize: 10, letterSpacing: '.05em', textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
          <tbody>{snaps.slice(-12).reverse().map((s, i) => <tr key={i}><td style={td(1)}>{new Date(s.t).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}</td><td style={td()}>{fmtPx(s.price)}</td><td style={td()}>{fmtUsd(s.mcap)}</td><td style={td()}>{fmtUsd(s.fdv)}</td><td style={td()}>{fmtUsd(s.vol24)}</td></tr>)}</tbody></table></div>}
      </div>

      {/* TRIPWIRES */}
      <Eyebrow>Thesis tripwires — materialization checklist · reviewed {TOKEN.reviewed} · stance: {TOKEN.stance}</Eyebrow>
      <div>{trips.map(([cls, ic, t, desc], i) => <div key={i} style={{ display: 'flex', gap: 11, padding: '11px 12px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ width: 20, height: 20, borderRadius: 4, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, marginTop: 1, color: tripStyle[cls][0], background: tripStyle[cls][1] }}>{ic}</div>
        <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{t}</div><div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, fontFamily: SANS }}>{desc}</div></div>
      </div>)}</div>

      {/* THESIS */}
      <Eyebrow dot={PUR}>The thesis — in one screen</Eyebrow>
      <div style={{ ...panel, fontFamily: SANS, fontSize: 12.5, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
        {TOKEN.thesis.map((p, i) => <p key={i} style={{ margin: i ? '8px 0 0' : 0 }} dangerouslySetInnerHTML={{ __html: p }} />)}
      </div>

      {/* FOOTER */}
      <div style={{ marginTop: 26, borderTop: '1px solid var(--border)', paddingTop: 14, color: 'var(--text-muted)', fontSize: 11, fontFamily: SANS, lineHeight: 1.6 }}>
        <b style={{ color: 'var(--text-secondary)' }}>Sources.</b> {TOKEN.sources} Market data: CoinGecko. On-chain: Solana RPC.<br />
        <b style={{ color: 'var(--text-secondary)' }}>Cómo leer los tripwires.</b> ✓ = la tesis se confirma en ese eje · ! = se rompe · ◦ = sin datos concluyentes. Regla de 10AMPRO: <b>{TOKEN.rule}</b><br />
        Data & research context, not investment advice.
        <div style={{ marginTop: 12 }}><a href={utm('footer')} style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>← 10am.pro</a> · <a href="https://mercados.10am.pro/nosana" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>más tesis: mercados.10am.pro</a></div>
      </div>
    </div>
  );
}
const td = (first) => ({ textAlign: first ? 'left' : 'right', padding: '7px 8px', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' });
