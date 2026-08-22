import { ImageResponse } from 'next/og';
import { TOKEN } from '../../../token.config';
// /api/og — social image: primary network metric (monthly bars) + price vs ATH.
export const dynamic = 'force-dynamic';
const GRN = '#22c55e', AMB = '#f59e0b', RED = '#ef4444';
const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const mLabel = (t) => { const d = new Date(t); return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`; };
const fmt = (v, unit) => {
  if (v == null) return '—';
  if (unit === 'pct') return v.toFixed(1) + '%';
  const a = Math.abs(v); const p = unit === 'usd' ? '$' : '';
  if (a >= 1e9) return p + (v / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return p + (v / 1e6).toFixed(1) + 'M'; if (a >= 1e3) return p + (v / 1e3).toFixed(0) + 'k';
  return p + v.toFixed(unit === 'usd' ? 2 : 0);
};
export async function GET(req) {
  const origin = new URL(req.url).origin;
  let m = null, px = null;
  try { const r = await fetch(`${origin}/api/network`, { cache: 'no-store' }); const j = await r.json(); m = Object.values(j.metrics || {}).find((x) => x.primary) || Object.values(j.metrics || {})[0] || null; } catch {}
  try { const r = await fetch(`${origin}/api/market`, { cache: 'no-store' }); px = await r.json(); } catch {}
  const pts = (m?.monthly || []).slice(-18);
  const max = Math.max(1, ...pts.map((p) => p.y || 0));
  const peakI = pts.findIndex((p) => p.y === max);
  const rec = m?.pctOfPeak != null ? Math.round(m.pctOfPeak * 100) : null;
  const recColor = rec == null ? '#71717a' : rec >= 85 ? GRN : rec >= 60 ? AMB : RED;
  const below = px?.price && px?.ath ? Math.round((1 - px.price / px.ath) * 100) : null;
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: 'flex', flexDirection: 'column', background: '#0c0c0e', padding: '40px 56px', fontFamily: 'sans-serif', color: '#e4e4e7' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: '#D4A843' }}>10</span><span style={{ fontSize: 30, fontWeight: 800, color: GRN, marginLeft: -14 }}>AM</span><span style={{ fontSize: 30, fontWeight: 800, color: '#52525b', marginLeft: -14 }}>PRO</span>
            <span style={{ fontSize: 22, color: '#3f3f46' }}>/</span>
            <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>{TOKEN.name.toUpperCase()}</span>
            <span style={{ fontSize: 15, color: '#71717a', letterSpacing: 2 }}>THESIS TELEMETRY</span>
          </div>
          {rec != null && <div style={{ display: 'flex', padding: '9px 20px', background: recColor + '1c', border: '2px solid ' + recColor + '55', borderRadius: 10 }}><span style={{ fontSize: 24, fontWeight: 800, color: recColor }}>{rec}% DEL PICO</span></div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 26 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 46, fontWeight: 800, color: '#f4f4f5', letterSpacing: -1 }}>{m?.label || TOKEN.tagline}</span>
            <span style={{ fontSize: 19, color: '#71717a', marginTop: 8 }}>{TOKEN.tagline}</span>
          </div>
          <div style={{ display: 'flex', gap: 28 }}>
            {[['Último mes', fmt(m?.latest, m?.unit), '#f4f4f5'], ['Pico', fmt(m?.peak, m?.unit), AMB], [`$${TOKEN.symbol}`, px?.price ? '$' + Number(px.price).toPrecision(4) : '—', GRN], ['vs ATH', below != null ? `−${below}%` : '—', RED]].map(([k, v, c]) => (
              <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}><span style={{ fontSize: 14, color: '#71717a', letterSpacing: 2 }}>{k.toUpperCase()}</span><span style={{ fontSize: 30, fontWeight: 800, color: c }}>{v}</span></div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 300, marginTop: 30, borderBottom: '2px solid #27272a', paddingBottom: 4 }}>
          {pts.map((p, i) => {
            const h = Math.max(6, (p.y / max) * 280); const last = i === pts.length - 1;
            return (
              <div key={p.t} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', height: h, background: last ? GRN : i === peakI ? AMB : '#3f3f46', borderRadius: 4 }} />
                <span style={{ fontSize: 12, color: '#52525b', marginTop: 6 }}>{mLabel(p.t)}</span>
              </div>
            );
          })}
          {!pts.length && <span style={{ color: '#52525b', fontSize: 20 }}>network telemetry loading…</span>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18, fontSize: 15, color: '#52525b' }}>
          <span>{TOKEN.host} · datos en vivo</span><span>10am.pro</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { 'cache-control': 'public, s-maxage=1800, stale-while-revalidate=3600' } },
  );
}
