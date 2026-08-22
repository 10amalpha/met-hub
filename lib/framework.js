// Shared builders so each token.config.js stays short and consistent across the 10AMPRO thesis hubs.
const GRN = '#22c55e', AMB = '#f59e0b', RED = '#ef4444';
const fp = (n) => (n == null || isNaN(n) ? '—' : '$' + (n >= 100 ? n.toFixed(2) : n >= 1 ? n.toFixed(3) : Number(n).toPrecision(4)));
const M = (n) => { if (n == null || isNaN(n)) return '—'; const a = Math.abs(n); if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (a >= 1e3) return (n / 1e3).toFixed(0) + 'k'; return String(Math.round(n)); };
const U = (n) => (n == null ? '—' : '$' + M(n));

// Zone-aware decision card. `extra` lets a token append its own bullets.
export function decisionBuilder(sym, extra = {}) {
  return ({ d, fc, st, trend, M: net, chain, recPct }) => {
    const px = d?.price; if (!px || !fc || !trend) return null;
    const sup0 = st?.supNow, res0 = st?.resNow, e200 = trend.e200, inv = fc.invalidation;
    // levels actually above / below price for actionable bullets
    const above = [res0, e200, trend.e50, trend.e20, inv].filter((v) => v && v > px * 1.01).sort((a, b) => a - b);
    const below = [sup0, e200, trend.e50, trend.e20].filter((v) => v && v < px * 0.99).sort((a, b) => b - a);
    const res = res0, sup = sup0;
    const sellAt = above[0] || px * 1.1, stopAt = below[0] || px * 0.92;
    let zone;
    if (fc.dir === 'BEAR') {
      if (px > inv) zone = { title: 'INVALIDADO — sesgo bajista anulado', color: GRN, text: `Cierre sobre ${fp(inv)}. El path bajista queda sin efecto; siguiente resistencia ${fp(fc.path[0].target > px ? fc.path[0].target : res || px * 1.15)}.` };
      else if (px > Math.min(e200, res || Infinity) * 0.98) zone = { title: 'EN LA RESISTENCIA — zona de decisión', color: AMB, text: `Entre ${fp(Math.min(e200, res || e200))} y ${fp(inv)}. No es zona de entrar ni de salir: es zona de esperar el cierre.` };
      else if (sup && px > sup) zone = { title: `DENTRO DE LA ESTRUCTURA — sesgo bajista`, color: AMB, text: `Entre soporte (~${fp(sup)}) y resistencia (${fp(res || e200)}). Rallies a la resistencia son para reducir, no para comprar.` };
      else if (px > fc.path[0].target) zone = { title: 'SOPORTE ROTO — path bajista activo', color: RED, text: `Perdió la estructura (~${fp(sup)}). Siguiente: ${fp(fc.path[0].target)} → ${fp(fc.path[1].target)}. No promediar a la baja sin volumen de capitulación.` };
      else zone = { title: 'CAPITULACIÓN — zona de retest', color: RED, text: `Bajo el primer target. Objetivo ${fp(fc.path[1].target)}. Aquí empieza la watchlist de compra, no antes.` };
    } else {
      if (px < inv) zone = { title: 'INVALIDADO — sesgo alcista anulado', color: RED, text: `Cierre bajo ${fp(inv)}. El path alcista queda sin efecto; siguiente soporte ${fp(fc.path[0].target < px ? fc.path[0].target : sup || px * 0.85)}.` };
      else if (res && px > res * 0.98) zone = { title: 'EN LA RESISTENCIA — breakout o rechazo', color: AMB, text: `Pegado a ${fp(res)}. Un cierre con 2× volumen abre ${fp(fc.path[0].target)}; un rechazo devuelve a ${fp(sup || trend.e50)}.` };
      else if (sup && px > sup) zone = { title: 'DENTRO DE LA ESTRUCTURA — sesgo alcista', color: GRN, text: `Entre soporte (~${fp(sup)}) y resistencia (${fp(res || fc.path[0].target)}). Dips al soporte son para comprar mientras aguante.` };
      else zone = { title: 'BAJO SOPORTE — alcista bajo presión', color: AMB, text: `Perdió ${fp(sup)} pero mantiene ${fp(inv)}. Zona de prueba: recuperar el soporte confirma, perder ${fp(inv)} anula.` };
    }
    const bear = fc.dir === 'BEAR';
    const holders = bear ? [
      `Reducí en rallies a <b>${fp(sellAt)}</b>. No vendas el pánico, vendé la euforia.`,
      `Stop mental: cierre diario bajo <b>${fp(stopAt)}</b> = bajar otro tramo.`,
      `Lo que te devuelve a HOLD: cierre &gt; <b>${fp(inv)}</b> con volumen ≥2× promedio.`,
    ] : [
      `Mantené mientras aguante <b>${fp(stopAt)}</b>. Añadí solo en retests exitosos, no persiguiendo.`,
      `Tomá parcial en <b>${fp(fc.path[0].target)}</b> (+1M) y dejá correr el resto hacia <b>${fp(fc.path[1].target)}</b>.`,
      `Stop: cierre diario bajo <b>${fp(inv)}</b> anula la tesis técnica.`,
    ];
    const entrants = bear ? [
      `Todavía no. ${st?.apexT ? `La estructura resuelve en semanas (apex ~${new Date(st.apexT).toLocaleDateString('es', { day: '2-digit', month: 'short' })}).` : 'El sesgo es bajista.'} Comprar ahora es pagar por incertidumbre.`,
      `Watchlist: <b>${fp(fc.path[0].target)}–${fp(fc.path[1].target)}</b> con volumen de capitulación.`,
      `Entrada por fuerza: cierre &gt; <b>${fp(inv)}</b> y retest que aguante. Más caro, pero con confirmación.`,
      `Sizing: 25% de la posición objetivo por trigger. Nunca full size de una.`,
    ] : [
      `Entrada en retest de <b>${fp(stopAt)}</b>, no en el breakout.`,
      `Si rompe ${fp(res || fc.path[0].target)} con 2× volumen: entrada reducida, stop bajo el nivel roto.`,
      `Sizing: 25% por trigger; el resto sobre <b>${fp(fc.path[0].target)}</b> confirmado.`,
    ];
    const flips = [...(extra.flips ? extra.flips({ d, net, chain, recPct, trend, fc, st, fp, M, U }) : [])];
    return { zone, holders: [...holders, ...(extra.holders?.({ d, net, chain, fp }) || [])], entrants, flips };
  };
}

// Generic tripwire helpers
export const tw = {
  metric(net, key, { label, good, watch, peakPct = true, unit = 'usd' } = {}) {
    const m = net?.[key]; if (!m || m.latest == null) return ['watch', '◦', label || key, 'No data yet.'];
    const rec = m.pctOfPeak != null ? Math.round(m.pctOfPeak * 100) : null;
    const v = unit === 'usd' ? U(m.latest) : M(m.latest);
    const mom = m.prev ? (m.latest / m.prev - 1) : null;
    if (rec != null && rec >= (good ?? 85)) return ['pass', '✓', `${m.label} — ${rec}% of peak`, `Latest ${v} vs peak ${unit === 'usd' ? U(m.peak) : M(m.peak)}. ${mom != null ? `MoM ${mom >= 0 ? '+' : ''}${(mom * 100).toFixed(0)}%.` : ''} The metric validates the price.`];
    if (rec != null && rec < (watch ?? 60)) return ['fail', '!', `${m.label} — ${rec}% of peak`, `Latest ${v} vs peak ${unit === 'usd' ? U(m.peak) : M(m.peak)}. ${mom != null ? `MoM ${mom >= 0 ? '+' : ''}${(mom * 100).toFixed(0)}%.` : ''} Activity has not come back — the thesis is unproven on this axis.`];
    return ['watch', '◦', `${m.label} — ${rec}% of peak`, `Latest ${v}. ${mom != null ? `MoM ${mom >= 0 ? '+' : ''}${(mom * 100).toFixed(0)}%.` : ''} Recovering but not confirmed; needs new highs.`];
  },
  concentration(chain, { exchangeWarnPct = 8, treasuryWarnPct = 25 } = {}) {
    const ho = chain?.holders; if (!ho) return ['watch', '◦', 'Supply concentration', 'Scanning…'];
    const S = chain.supply; const ex = ho.exchange / S * 100, tr = ho.treasuryLike / S * 100;
    if (tr >= treasuryWarnPct) return ['fail', '!', `Treasury-shaped wallets hold ${tr.toFixed(1)}%`, `${ho.top.filter((h) => h.kind === 'treasury_like').length} unlabeled wallets ≥${chain.treasuryPct || 3}% each, signer-controlled, not in vesting programs. Any move to exchanges is a sell signal.`];
    if (ex >= exchangeWarnPct) return ['fail', '!', `${ex.toFixed(1)}% of supply sits on exchanges`, `Exchange float is the ammunition for a breakdown. Watch it fall before buying.`];
    return ['pass', '✓', `Concentration contained — CEX ${ex.toFixed(1)}% · treasury-shaped ${tr.toFixed(1)}%`, `Top-10 ${ho.top10pct}% of supply. No single unlabeled wallet dominates the float.`];
  },
  trend(trend, fc) {
    if (!trend || !fc) return ['watch', '◦', 'Price regime', 'Computing…'];
    const px = trend.last;
    if (trend.score >= 5) return ['pass', '✓', `Price regime ${trend.regime} (${trend.score}/7)`, `Above EMA200 (${fp(trend.e200)}), EMA200 ${trend.slope200 > 0 ? 'rising' : 'flat'}. Market agrees with the thesis.`];
    if (trend.score <= 2) return ['fail', '!', `Price regime ${trend.regime} (${trend.score}/7)`, `Below EMA200 (${fp(trend.e200)}) with a falling 200. Rallies are for selling until ${fp(fc.invalidation)} prints.`];
    return ['watch', '◦', `Price regime ${trend.regime} (${trend.score}/7)`, `Mixed. Forecast ${fc.dir} intact while price ${fc.dir === 'BEAR' ? '<' : '>'} ${fp(fc.invalidation)} (now ${fp(px)}).`];
  },
  custom: (cls, ic, t, desc) => [cls, ic, t, desc],
};
export const fmt = { fp, M, U };
