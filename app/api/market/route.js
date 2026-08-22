// /api/market — CoinGecko price/mcap/fdv/volume + history. Config-driven.
import { TOKEN } from '../../../token.config';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const CG = 'https://api.coingecko.com/api/v3';
const json = (b, ttl = 120) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 4}` } });
async function cg(path) {
  const r = await fetch(`${CG}${path}`, { headers: { accept: 'application/json' }, next: { revalidate: 120 } });
  if (!r.ok) throw new Error(`coingecko ${r.status}`);
  return r.json();
}
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const history = searchParams.get('history');
  try {
    if (history) {
      const days = history === 'max' ? 'max' : Math.max(1, Math.min(365, Number(history) || 365));
      const j = await cg(`/coins/${TOKEN.cgId}/market_chart?vs_currency=usd&days=${days}${days === 'max' || days > 90 ? '&interval=daily' : ''}`);
      return json({ ok: true, prices: j.prices || [], market_caps: j.market_caps || [], volumes: j.total_volumes || [] }, 600);
    }
    const j = await cg(`/coins/${TOKEN.cgId}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`);
    const m = j.market_data || {};
    return json({
      ok: true, ts: Date.now(),
      price: m.current_price?.usd ?? null, mcap: m.market_cap?.usd ?? null, fdv: m.fully_diluted_valuation?.usd ?? null,
      vol24: m.total_volume?.usd ?? null, chg: m.price_change_percentage_24h ?? null, chg7: m.price_change_percentage_7d ?? null, chg30: m.price_change_percentage_30d ?? null,
      ath: m.ath?.usd ?? null, athDate: m.ath_date?.usd ?? null, atl: m.atl?.usd ?? null,
      circ: m.circulating_supply ?? null, total: m.total_supply ?? null, max: m.max_supply ?? null,
    }, 120);
  } catch (e) { return json({ ok: false, error: e.message }, 0); }
}
