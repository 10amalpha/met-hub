// ---- shared technical-analysis engine (pure functions, no React) ----
export const ema = (arr, n) => { const k = 2 / (n + 1); let e = arr[0]; const out = [e]; for (let i = 1; i < arr.length; i++) { e = arr[i] * k + e * (1 - k); out.push(e); } return out; };
const at = (a) => a[a.length - 1];

export function computeTrend(closes, vols) {
  if (!closes || closes.length < 60) return null;
  const c = closes, last = at(c);
  const e20 = ema(c, 20), e50 = ema(c, 50), e100 = ema(c, 100), e200 = ema(c, 200);
  const m12 = ema(c, 12), m26 = ema(c, 26);
  const macd = m12.map((v, i) => v - m26[i]); const sig = ema(macd, 9);
  const hist = at(macd) - at(sig);
  const histPrev = macd[macd.length - 4] - sig[sig.length - 4];
  let g = 0, l = 0; for (let i = c.length - 14; i < c.length; i++) { const d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d; }
  const rsi = l === 0 ? 100 : 100 - 100 / (1 + (g / 14) / (l / 14));
  const slope200 = e200.length > 21 ? at(e200) / e200[e200.length - 21] - 1 : 0;
  const chg30 = c.length > 30 ? last / c[c.length - 31] - 1 : 0;
  const chg7 = c.length > 7 ? last / c[c.length - 8] - 1 : 0;
  const checks = [
    ['Price > EMA20', last > at(e20)], ['Price > EMA50', last > at(e50)], ['Price > EMA200', last > at(e200)],
    ['EMA50 > EMA200', at(e50) > at(e200)], ['EMA200 rising', slope200 > 0], ['MACD histo > 0', hist > 0], ['RSI > 50', rsi > 50],
  ];
  const score = checks.filter((x) => x[1]).length;
  const regime = score <= 1 ? 'STRONG BEAR' : score <= 3 ? 'BEAR' : score === 4 ? 'NEUTRAL' : score <= 5 ? 'BULL' : 'STRONG BULL';
  let volRatio = null;
  if (vols && vols.length > 90) { const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length; volRatio = avg(vols.slice(-20)) / avg(vols.slice(-90)); }
  return { last, e20: at(e20), e50: at(e50), e100: at(e100), e200: at(e200), hist, histUp: hist > histPrev, rsi, slope200, chg30, chg7, checks, score, regime, volRatio };
}

// ---- swing detection & auto structure ----
export function pivots(t, c, win = 7) {
  const highs = [], lows = [];
  for (let i = win; i < c.length - win; i++) {
    let hi = true, lo = true;
    for (let k = 1; k <= win; k++) { if (c[i - k] >= c[i] || c[i + k] >= c[i]) hi = false; if (c[i - k] <= c[i] || c[i + k] <= c[i]) lo = false; }
    if (hi) highs.push([t[i], c[i], i]); if (lo) lows.push([t[i], c[i], i]);
  }
  return { highs, lows };
}

// Fit a line through two anchor pivots: the extreme one in the window and the most recent pivot that keeps all later pivots on the correct side.
function anchorLine(pvs, isHigh, minGapDays = 20) {
  if (pvs.length < 2) return null;
  const DAY = 86400000;
  const ext = pvs.reduce((a, b) => (isHigh ? (b[1] > a[1] ? b : a) : (b[1] < a[1] ? b : a)));
  const after = pvs.filter((p) => p[0] > ext[0] + minGapDays * DAY);
  if (!after.length) return null;
  // choose the most recent pivot; then check the line doesn't get violated by pivots between
  let best = null;
  for (let j = after.length - 1; j >= 0; j--) {
    const b = after[j];
    const m = (b[1] - ext[1]) / (b[0] - ext[0]);
    const ok = pvs.filter((p) => p[0] > ext[0] && p[0] < b[0]).every((p) => { const y = ext[1] + m * (p[0] - ext[0]); return isHigh ? p[1] <= y * 1.03 : p[1] >= y * 0.97; });
    if (ok) { best = b; break; }
  }
  if (!best) best = at(after);
  const m = (best[1] - ext[1]) / (best[0] - ext[0]);
  const touches = pvs.filter((p) => p[0] >= ext[0] && Math.abs(p[1] / (ext[1] + m * (p[0] - ext[0])) - 1) < 0.04).length;
  return { a: ext, b: best, m, yAt: (ts) => ext[1] + m * (ts - ext[0]), touches };
}

export function autoStructure(series, lookbackDays = 240) {
  if (!series || series.c.length < 90) return null;
  const DAY = 86400000;
  const cut = at(series.t) - lookbackDays * DAY;
  const idx = series.t.findIndex((x) => x >= cut);
  const t = series.t.slice(idx), c = series.c.slice(idx);
  const { highs, lows } = pivots(t, c, 7);
  const res = anchorLine(highs, true), sup = anchorLine(lows, false);
  const last = at(series.c), lastT = at(series.t);
  let pattern = 'No clean structure', bias = 'neutral', apexT = null;
  if (res && sup) {
    const rs = res.m / last * DAY * 30, ss = sup.m / last * DAY * 30; // %/month
    const f = 0.015;
    if (rs < -f && ss > f) pattern = 'Symmetrical triangle (contracting)';
    else if (rs < -f && Math.abs(ss) <= f) { pattern = 'Descending triangle'; bias = 'bear'; }
    else if (Math.abs(rs) <= f && ss > f) { pattern = 'Ascending triangle'; bias = 'bull'; }
    else if (rs < -f && ss < -f) { pattern = 'Descending channel'; bias = 'bear'; }
    else if (rs > f && ss > f) { pattern = 'Ascending channel'; bias = 'bull'; }
    else if (Math.abs(rs) <= f && Math.abs(ss) <= f) pattern = 'Range / rectangle';
    else if (rs > f && ss < -f) pattern = 'Expanding wedge (broadening)';
    else pattern = 'Wedge';
    if (res.m !== sup.m) { apexT = res.a[0] + (sup.yAt(res.a[0]) - res.yAt(res.a[0])) / (res.m - sup.m); if (apexT < lastT) apexT = null; }
  } else if (res && !sup) { pattern = res.m < 0 ? 'Downtrend — lower highs, no floor yet' : 'Lower-high cap, no floor'; bias = res.m < 0 ? 'bear' : 'neutral'; }
  else if (sup && !res) { pattern = sup.m > 0 ? 'Uptrend — higher lows, no ceiling' : 'Floor holding, no ceiling'; bias = sup.m > 0 ? 'bull' : 'neutral'; }
  const hi = Math.max(...c), lo = Math.min(...c);
  const height = res && sup ? Math.max(0, res.yAt(res.a[0]) - sup.yAt(res.a[0])) : hi - lo;
  return {
    res, sup, pattern, bias, apexT, height,
    highs: highs.slice(-4), lows: lows.slice(-4),
    rangeHigh: hi, rangeLow: lo,
    resNow: res ? res.yAt(lastT) : null, supNow: sup ? sup.yAt(lastT) : null,
    measured: { up: +(res ? res.yAt(lastT) + height : hi).toPrecision(3), down: +(Math.max(lo * 0.9, (sup ? sup.yAt(lastT) : lo) - height)).toPrecision(3) },
  };
}

// ---- directional forecast from regime + structure ----
export function buildForecast(trend, st, series, cfg = {}) {
  if (!trend || !series) return null;
  const px = trend.last;
  const ath = cfg.ath || Math.max(...series.c);
  const atl = Math.min(...series.c);
  const bearPts = trend.score <= 3 ? 1 : 0, bullPts = trend.score >= 5 ? 1 : 0;
  const sbias = st?.bias === 'bear' ? 1 : st?.bias === 'bull' ? -1 : 0;
  const dir = (bearPts - bullPts + sbias + (trend.slope200 < 0 ? 1 : -1)) >= 1 ? 'BEAR' : (bullPts - bearPts - sbias + (trend.slope200 > 0 ? 1 : -1)) >= 1 ? 'BULL' : (trend.score <= 3 ? 'BEAR' : 'BULL');
  const r = (v) => +Number(v).toPrecision(3);
  const lvlsBelow = [trend.e20, trend.e50, trend.e100, trend.e200, st?.supNow, ...(st?.lows || []).map((p) => p[1]), atl, st?.measured?.down].filter((v) => v && v < px * 0.98).sort((a, b) => b - a);
  const lvlsAbove = [trend.e20, trend.e50, trend.e100, trend.e200, st?.resNow, ...(st?.highs || []).map((p) => p[1]), st?.measured?.up, ath].filter((v) => v && v > px * 1.02).sort((a, b) => a - b);
  const pick = (arr, i, fallback) => arr[Math.min(i, arr.length - 1)] ?? fallback;
  let path, invalidation, how;
  if (dir === 'BEAR') {
    const t1 = pick(lvlsBelow, 1, px * 0.88), t3 = pick(lvlsBelow, 3, px * 0.72), t12 = Math.min(pick(lvlsBelow, lvlsBelow.length - 1, px * 0.5), atl * 0.95);
    path = [{ d: 30, h: '+1M', target: r(t1) }, { d: 90, h: '+3M', target: r(Math.min(t3, t1 * 0.97)) }, { d: 365, h: '+1Y', target: r(Math.min(t12, t3 * 0.9)) }];
    const inv = Math.max(trend.e200, st?.resNow || 0, ...(st?.highs || []).slice(-1).map((p) => p[1]));
    invalidation = r(inv > px ? inv : px * 1.12);
    how = [`Rejection at ${r(Math.max(trend.e200, st?.resNow || 0))} → loses the EMA cluster → ${r(t1)}.`, `Structure lower rail gives → ${r(t3)}. Catalyst window: next unlock / protocol newsflow.`, `Cycle low retest. Without revenue growth, undercut to ${r(t12)}.`];
  } else {
    const t1 = pick(lvlsAbove, 1, px * 1.12), t3 = pick(lvlsAbove, 3, px * 1.35), t12 = Math.max(pick(lvlsAbove, lvlsAbove.length - 1, px * 2), ath * 0.8);
    path = [{ d: 30, h: '+1M', target: r(t1) }, { d: 90, h: '+3M', target: r(Math.max(t3, t1 * 1.03)) }, { d: 365, h: '+1Y', target: r(Math.max(t12, t3 * 1.1)) }];
    const inv = Math.min(trend.e200, st?.supNow || Infinity, ...(st?.lows || []).slice(-1).map((p) => p[1]));
    invalidation = r(inv < px ? inv : px * 0.88);
    how = [`Holds the EMA cluster → reclaims ${r(t1)}.`, `Breaks structure upper rail → ${r(t3)}. Needs volume ≥2× avg on the break.`, `Prior-cycle supply zone. Requires fundamentals to confirm the price.`];
  }
  path.forEach((p, i) => (p.how = how[i]));
  return { dir, path, invalidation, generated: new Date().toISOString().slice(0, 10) };
}
