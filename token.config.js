import { decisionBuilder, tw, fmt } from './lib/framework';

export const TOKEN = {
  slug: 'met', name: 'Meteora', symbol: 'MET', cgId: 'meteora', host: 'met-hub.vercel.app',
  sector: 'Solana liquidity layer (DLMM / DAMM)',
  tagline: 'TVL, volumen y fees de la capa de liquidez — con buyback y 52% del supply todavía por emitir.',
  description: 'Meteora ($MET) en vivo: TVL, volumen DLMM/DAMM, fees y revenue, unlocks y buyback, supply overhang on-chain, TA con forecast y tripwires. 10AMPRO.',
  stance: 'wait-for-unlock-absorption', reviewed: '22 Ago 2026',
  sources: 'Network telemetry: DefiLlama (Meteora TVL, DEX volume, fees, revenue). Unlocks: Tokenomist via CoinGecko.',
  rule: 'revenue mensual <50% del pico + unlock mensual no absorbido en 72h = reducir; buyback trimestral ≥ unlocks del trimestre = mantener aunque el chart esté feo.',
  thesis: [
    '<b>Qué es.</b> Meteora es la capa de liquidez de Solana: DLMM (liquidez concentrada dinámica), DAMM v2, vaults y el launchpad que usa buena parte del long tail (incluido PumpFun). Cobra 5–20% de las fees de cada pool como revenue del protocolo.',
    '<b>La tesis.</b> MET es un token de revenue real con dos problemas de supply: 52% del total vesting lineal a 6 años (equipo + reserva) y un TGE que salió con 48% en circulación. El buyback trimestral (Q4-25: $10M USDC, 2.3% del supply) es el contrapeso. La tesis funciona si el buyback absorbe los unlocks y el revenue se sostiene sin depender del ciclo de memecoins.',
    '<b>Lo que valida.</b> Revenue mensual estable aunque caiga el volumen de memes (diversificación), TVL creciendo en SOL, buyback trimestral anunciado y ejecutado on-chain, MET staked (Comet Points) creciendo.',
    '<b>Lo que rompe.</b> ~50% de las fees vienen de PumpFun/long-tail: si ese flujo migra a PumpSwap u otro AMM, el revenue se parte. Unlocks diarios (~7.3M MET/mes) sin demanda, o buyback suspendido.',
  ],
  network: {
    title: 'TVL · DEX volume · fees · revenue (DefiLlama)',
    note: 'Volume = swaps en pools Meteora (monthly sum). Revenue = take del protocolo (5–20% de fees). TVL en USD — sube con SOL.',
    metrics: [
      { key: 'revenue', label: 'Protocol revenue', source: 'llama-fees', slug: 'meteora', dataType: 'dailyRevenue', unit: 'usd', primary: true },
      { key: 'fees', label: 'Total fees', source: 'llama-fees', slug: 'meteora', dataType: 'dailyFees', unit: 'usd' },
      { key: 'volume', label: 'DEX volume', source: 'llama-dex', slug: 'meteora', unit: 'usd' },
      { key: 'tvl', label: 'TVL', source: 'llama-tvl', slug: 'meteora', unit: 'usd' },
    ],
  },
  onchain: {
    mint: 'METvsvVRapdj9cFLzq4Tr43xK4tAjQfwX76z3n6mWQL', supply: 1_000_000_000, decimals: 6, treasuryPct: 3,
    labels: {},
    programs: {},
    staking: { manual: { label: 'Staked MET (Comet)', total: null, source: 'app.meteora.ag — referral staking program', note: 'Ver app.meteora.ag para total staked' } },
    read: ({ chain, d, fmtNum, pctS }) => {
      const ho = chain.holders; if (!ho) return 'Holders scan unavailable.';
      const tr = ho.treasuryLike, ex = ho.exchange, ve = ho.vesting, daily = d?.price && d?.vol24 ? d.vol24 / d.price : null;
      return `<b>MET es una carrera entre unlocks y buyback.</b> 52% del supply (equipo 18% + reserva 34%) vesting lineal a 6 años ≈ <b>7.3M MET/mes</b> entrando al float. ${pctS(tr)} del supply está en wallets sin etiqueta ≥3% (reserva de ecosistema, equipo) y ${pctS(ve)} en cuentas tipo vesting. <div style="margin-top:6px"><b>Exchanges:</b> ${fmtNum(ex)} MET (${pctS(ex)}) en CEX etiquetados${daily ? `, ≈${(ex / daily).toFixed(1)} días de volumen` : ''}. Binance/OKX/Coinbase dan liquidez para absorber unlocks; el problema no es el float, es quién compra el float nuevo.</div><div style="margin-top:6px"><b>Decisión:</b> › el número que manda: <b>buyback del trimestre vs 22M MET de unlocks</b> del trimestre. Si el buyback lo cubre, HOLD; si no, el precio baja por aritmética. › Reserva de ecosistema moviéndose a CEX = salir. › Staked MET subiendo con el precio bajando = acumulación; con el precio subiendo = fin del ciclo de farming.</div>`;
    },
  },
  tripwires: ({ M, chain, trend, fc }) => [
    tw.metric(M, 'revenue', { good: 80, watch: 50 }),
    tw.metric(M, 'volume', { good: 70, watch: 45 }),
    tw.metric(M, 'tvl', { good: 85, watch: 60 }),
    tw.concentration(chain, { exchangeWarnPct: 10, treasuryWarnPct: 30 }),
    tw.trend(trend, fc),
    tw.custom('watch', '◦', 'Buyback vs unlocks', 'Q4-25: $10M USDC de buyback ≈ 2.3% del supply. Unlocks ≈ 7.3M MET/mes (0.73%/mes). El buyback cubre los unlocks solo si se sostiene cada trimestre. Tripwire pasa a ✓ con el siguiente anuncio ejecutado on-chain, a ! si se salta un trimestre.'),
    tw.custom('watch', '◦', 'Dependencia de PumpFun', '~50% de las fees vienen de long-tail / PumpFun. Si PumpSwap internaliza ese flujo, el revenue de Meteora se parte. Mirar share de volumen Meteora vs PumpSwap, no solo el total.'),
  ],
  decision: decisionBuilder('MET', {
    flips: ({ net, U }) => {
      const r = net?.revenue;
      return [
        `<b>Buyback trimestral ≥ unlocks del trimestre</b>, ejecutado on-chain desde la wallet única anunciada. Ahí MET deja de ser dilutivo en la práctica.`,
        `Revenue mensual ${r?.peak ? `volviendo sobre <b>${U(r.peak * 0.8)}</b> (hoy ${U(r.latest)})` : 'en máximos'} sin depender del ciclo de memecoins (share PumpFun bajando, revenue estable).`,
        `Reserva de ecosistema moviéndose a exchanges = salir sin esperar el chart.`,
        `Buyback suspendido o reducido = la única defensa contra 6 años de vesting se cae. Reducir.`,
      ];
    },
  }),
};
