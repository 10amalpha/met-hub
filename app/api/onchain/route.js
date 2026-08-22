// /api/onchain — supply-overhang telemetry from Solana RPC, config-driven.
import { TOKEN } from '../../../token.config';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const SYS = '11111111111111111111111111111111';
const RPCS = [process.env.SOLANA_RPC, process.env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` : null, 'https://api.mainnet-beta.solana.com', 'https://solana-rpc.publicnode.com', 'https://solana.publicnode.com', 'https://rpc.ankr.com/solana', 'https://solana-mainnet.g.alchemy.com/v2/demo', 'https://api.mainnet-beta.solana.com'].filter(Boolean);
const LABELS = {
  '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9': 'Binance', '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM': 'Binance', '2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S': 'Binance',
  'AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2': 'Bybit', '5VCwKtCXgCJ6kit5FybXjvriW3xELsFxY5XoJ7tCPEH4': 'OKX', 'H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS': 'Coinbase',
  'FWznbcNXWQuHTawe9RxvQ2LdCENssh12dsznf4RiouN5': 'Kraken', 'u6PJ8DtQuPFnfmwHbGFULQ4u4EgjDiyYKjVEsynXq2w': 'Gate.io', 'ASTyfSima4LLAdDgoFGkgqoKowG1LZFDr9fAQrg7iaJZ': 'MEXC',
  'A77HErqtfN1hLLpvZ9pCtu66FEtM8BveoaKbbMoZ4RiR': 'Bitget', 'BmFdpraQhkiDQE6SnfG5omcA1VwzqfXrwtNYBwWTymy6': 'KuCoin', '5PAhQiYdLBd6SVdjzBQDxUAEFyDdF5ExNPQfcscnPRj5': 'Bitvavo',
  ...(TOKEN.onchain.labels || {}),
};
const PROGRAMS = {
  CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK: ['Raydium CLMM pool', 'dex'], '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': ['Raydium AMM pool', 'dex'],
  whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc: ['Orca Whirlpool', 'dex'], LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo: ['Meteora DLMM', 'dex'],
  cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG: ['Meteora DAMM v2', 'dex'], Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB: ['Meteora DAMM', 'dex'],
  pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA: ['PumpSwap pool', 'dex'], strmRqUCoQUgGUan5YhzUZa6KqQ3M2DU7D9PcVJiNZi: ['Streamflow vesting', 'vesting'],
  JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: ['Jupiter', 'program'], voTpe3tHQ7AjQHMapgSue2HuFAcoSJM9NVVpM7aHhhY: ['Jupiter vote escrow', 'staking'],
  GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw: ['SPL Governance', 'staking'], stkitrT1Uoy18Dk1fTrgPw8W6MVzoCfYoAFT4MLsmhq: ['Stake pool', 'staking'],
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: ['Self-owned token acct (vesting-like)', 'vesting'],
  ...(TOKEN.onchain.programs || {}),
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function rpc(method, params, timeout = 12000) {
  const errs = [];
  for (let i = 0; i < RPCS.length; i++) {
    const url = RPCS[i]; if (i > 0) await sleep(800);
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeout);
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: ctrl.signal });
      clearTimeout(t); const txt = await r.text(); let j; try { j = JSON.parse(txt); } catch { throw new Error(`${url}: HTTP ${r.status}`); }
      if (j.error) throw new Error(`${url}: ${j.error.message || JSON.stringify(j.error)}`);
      return j.result;
    } catch (e) { errs.push(String(e.message || e)); }
  }
  throw new Error(errs.join(' | '));
}
const json = (b, ttl = 600) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 3}` } });

export async function GET() {
  const { mint, supply, treasuryPct = 3, staking } = TOKEN.onchain;
  const out = { ok: true, ts: Date.now(), mint, supply, errors: [] };
  try { const sup = await rpc('getTokenSupply', [mint]); out.onchainSupply = Number(sup.value.uiAmount); } catch (e) { out.errors.push('supply: ' + e.message); }
  try {
    const largest = await rpc('getTokenLargestAccounts', [mint, { commitment: 'confirmed' }]);
    const accts = largest.value.slice(0, 20);
    const infos = await rpc('getMultipleAccounts', [accts.map((a) => a.address), { encoding: 'jsonParsed', commitment: 'confirmed' }]);
    const holders = accts.map((a, i) => {
      const info = infos.value[i]?.data?.parsed?.info || {}; const owner = info.owner || null; const amt = Number(a.uiAmount || 0);
      return { tokenAccount: a.address, owner, amt: Math.round(amt), pct: +(amt / supply * 100).toFixed(2), label: owner && LABELS[owner] ? LABELS[owner] : null, kind: owner && LABELS[owner] ? 'exchange' : 'unlabeled' };
    });
    const owners = [...new Set(holders.map((h) => h.owner).filter(Boolean))];
    const oi = await rpc('getMultipleAccounts', [owners, { encoding: 'base64', commitment: 'confirmed' }]);
    const ownerProgram = {}; owners.forEach((o, i) => { ownerProgram[o] = oi.value[i]?.owner || null; });
    holders.forEach((h) => {
      const prog = h.owner ? ownerProgram[h.owner] : null;
      if (h.kind === 'exchange') return;
      if (prog && prog !== SYS) { const p = PROGRAMS[prog]; h.program = prog; h.label = p ? p[0] : 'Program'; h.kind = p ? p[1] : 'program'; }
      else if (h.pct >= treasuryPct) { h.kind = 'treasury_like'; h.label = `Unlabeled ≥${treasuryPct}% (treasury/team-shaped)`; }
    });
    const by = (k) => holders.filter((h) => h.kind === k).reduce((x, h) => x + h.amt, 0);
    out.holders = { top: holders, top10pct: +holders.slice(0, 10).reduce((x, h) => x + h.pct, 0).toFixed(2), top20pct: +holders.reduce((x, h) => x + h.pct, 0).toFixed(2),
      exchange: by('exchange'), treasuryLike: by('treasury_like'), dex: by('dex'), vesting: by('vesting'), staking: by('staking'), program: by('program'), unlabeled: by('unlabeled') };
  } catch (e) { out.errors.push('holders: ' + e.message); }
  if (staking?.vaultOwner) {
    try {
      const accs = await rpc('getTokenAccountsByOwner', [staking.vaultOwner, { mint }, { encoding: 'jsonParsed' }]);
      const total = (accs.value || []).reduce((a, x) => a + Number(x.account.data.parsed.info.tokenAmount.uiAmount || 0), 0);
      out.staking = { label: staking.label, total: Math.round(total), pct: +(total / supply * 100).toFixed(2), note: staking.note };
    } catch (e) { out.errors.push('staking: ' + e.message); }
  } else if (staking?.manual) out.staking = { ...staking.manual, manual: true };
  out.ok = out.errors.length < 2;
  return json(out, 600);
}
