// /api/network — protocol telemetry adapter. Sources: DefiLlama (tvl / dexs / fees / revenue), manual seed series, on-chain supply burn.
import { TOKEN } from '../../../token.config';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (b, ttl = 900) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 4}` } });
const monthKey = (ts) => { const d = new Date(ts); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); };
function toMonthly(daily, mode = 'sum') {
  const m = new Map();
  daily.forEach(([ts, v]) => { if (v == null) return; const k = monthKey(ts); if (!m.has(k)) m.set(k, []); m.get(k).push(v); });
  const out = [...m.entries()].sort((a, b) => a[0] - b[0]).map(([k, arr]) => ({ t: k, y: mode === 'sum' ? arr.reduce((a, b) => a + b, 0) : arr[arr.length - 1] }));
  const now = monthKey(Date.now());
  return mode === 'sum' ? out.filter((p) => p.t < now) : out;
}
async function llama(path) {
  const r = await fetch(`https://api.llama.fi${path}`, { next: { revalidate: 900 } });
  if (!r.ok) throw new Error(`llama ${path} ${r.status}`);
  return r.json();
}
async function metricSeries(mt) {
  if (mt.source === 'llama-tvl') {
    const j = await llama(`/protocol/${mt.slug}`);
    let tvl = (j.tvl || []).map((p) => [p.date * 1000, p.totalLiquidityUSD]);
    if (mt.chain && j.chainTvls?.[mt.chain]?.tvl) tvl = j.chainTvls[mt.chain].tvl.map((p) => [p.date * 1000, p.totalLiquidityUSD]);
    return { daily: tvl.slice(-90), monthly: toMonthly(tvl, 'last'), mode: 'level' };
  }
  if (mt.source === 'llama-dex' || mt.source === 'llama-fees') {
    const kind = mt.source === 'llama-dex' ? 'dexs' : 'fees';
    const j = await llama(`/summary/${kind}/${mt.slug}?dataType=${mt.dataType || (kind === 'dexs' ? 'dailyVolume' : 'dailyFees')}`);
    const d = (j.totalDataChart || []).map((p) => [p[0] * 1000, p[1]]);
    return { daily: d.slice(-90), monthly: toMonthly(d, 'sum'), mode: 'flow', total24: j.total24h, total7d: j.total7d, total30d: j.total30d };
  }
  if (mt.source === 'manual') {
    const d = mt.points.map((p) => [Date.parse(p[0]), p[1]]);
    return { daily: d, monthly: d.map(([t, y]) => ({ t, y })), mode: mt.mode || 'level', manual: true, note: mt.note };
  }
  if (mt.source === 'rpc-supply') {
    const r = await fetch(mt.rpc || process.env.SOLANA_RPC || (process.env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` : 'https://api.mainnet-beta.solana.com'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenSupply', params: [mt.mint] }) });
    const j = await r.json(); const sup = Number(j.result?.value?.uiAmount || 0);
    const burned = mt.minted - sup;
    return { daily: [[Date.now(), burned]], monthly: [{ t: Date.now(), y: burned }], mode: 'level', supply: sup };
  }
  throw new Error('unknown source ' + mt.source);
}
export async function GET() {
  const out = { ok: true, ts: Date.now(), metrics: {}, errors: [] };
  await Promise.all((TOKEN.network.metrics || []).map(async (mt) => {
    try {
      const s = await metricSeries(mt);
      const ys = s.monthly.map((p) => p.y).filter((v) => v != null);
      const latest = ys[ys.length - 1] ?? null, prev = ys[ys.length - 2] ?? null, peak = ys.length ? Math.max(...ys) : null;
      const peakIdx = ys.indexOf(peak);
      out.metrics[mt.key] = { ...s, key: mt.key, label: mt.label, unit: mt.unit || 'usd', latest, prev, peak, peakT: s.monthly[peakIdx]?.t ?? null, pctOfPeak: peak ? latest / peak : null, primary: !!mt.primary };
    } catch (e) { out.errors.push(`${mt.key}: ${e.message}`); }
  }));
  return json(out, 900);
}
