// helpers.js — formatting + badge helpers ported from monerousd-explorer
// app.js (the legacy server-side EJS render). Kept here so every page
// gets identical formatting whether it queries daemon RPC directly or
// the federated indexer.

// 8-decimal atomic units throughout MoneroUSD (see CLAUDE.md atomic-units rule).
const ATOMIC = 1e8;

// §19.15 — Gold verified badge. Hardcoded, operator-controlled.
// This list is mirrored from monerousd-explorer/app.js (the legacy
// Express explorer). When a wallet build adds a new wrapper, both
// places must be updated together.
export const VERIFIED_TOKENS = Object.freeze({
  'USDm':       { name: 'MoneroUSD',              issuer: 'Protocol',         verified: true, addr: 'ion1_daaab274fe19e359596c2dde047a2ba06ffda90d3c23cacff02123c6312578a4' },
  'wBTC':       { name: 'Wrapped Bitcoin',         issuer: 'MoneroUSD Bridge', verified: true, addr: 'ion1_39864f297d8ce6f6472e7cdadba3de06ccf1eb7a6c2563733e49e0d62c7d1f13' },
  'wXMR':       { name: 'Wrapped Monero',          issuer: 'MoneroUSD Bridge', verified: true, addr: 'ion1_f951098d2844223f60de7fa9290872968ccee32a236b07076be91a71af83d72c' },
  'wETH':       { name: 'Wrapped Ethereum',        issuer: 'MoneroUSD Bridge', verified: true, addr: 'ion1_cf993a8b5217d300ea7673c87ba4fc714c92f8ff64d74c42f4ca14294416140e' },
  'wLTC':       { name: 'Wrapped Litecoin',        issuer: 'MoneroUSD Bridge', verified: true, addr: 'ion1_8e6721cedb26be8a0a83eebbd89144329feb60dff120d03dccd2cc2653d9befe' },
  'wDOGE':      { name: 'Wrapped Dogecoin',        issuer: 'MoneroUSD Bridge', verified: true, addr: 'ion1_cf052144ec19e507923ac12c0c6a9f79aaf2d40b570a3c14218877a533bc887c' },
  'wSOL':       { name: 'Wrapped Solana',          issuer: 'MoneroUSD Bridge', verified: true, addr: 'ion1_2ccdeb4e4b7f3c1d8427f430be5eab04b0347aa1832005c1c5db83102af04f74' },
  'wADA':       { name: 'Wrapped Cardano',         issuer: 'MoneroUSD Bridge', verified: true, addr: 'ion1_86d6668f72379a01dc85417aec2f49ebef49ac01c6dedb8dcf0d266c91930074' },
  'wBCH':       { name: 'Wrapped Bitcoin Cash',    issuer: 'MoneroUSD Bridge', verified: true, addr: 'ion1_17911256c9d89fe75bc1151dcb07d9683aa0440af613a8cdbd2e87e6fd2cc73b' },
  'wUSDT-TRX':  { name: 'Wrapped USDT (Tron)',     issuer: 'MoneroUSD PSM',   verified: true, addr: 'ion1_4ce50f558e9b475c8504b0b47ab5a9bfe654a4f99757338234ae807dd8a57081' },
  'wRLUSD':     { name: 'Wrapped RLUSD',           issuer: 'MoneroUSD PSM',   verified: true, addr: 'ion1_9619b844ae92e58f2abbcca9a28103469fe5e4901f92e27461fd75e8fc784ddc' },
  'wZEC':       { name: 'Wrapped Zcash',           issuer: 'MoneroUSD Bridge', verified: true, addr: 'ion1_1e4b86f8642ee1f49d020b30d57c81b7b5342da4b2ee9e11e271108c219de51e' },
  'wBNB':       { name: 'Wrapped BNB',             issuer: 'MoneroUSD Bridge', verified: true, addr: 'ion1_369cbbae7360123b99f0a46c2d7a91ed37475357683fa1150c9529926cc66617' },
  'wUSDC-ETH':  { name: 'Wrapped USDC (Ethereum)', issuer: 'MoneroUSD PSM',   verified: true, addr: 'ion1_9afeb7809610006e55e7d83ea66ad27725394ebd282a4c1ded1dc305ea920f7c' },
  'wUSDT-ETH':  { name: 'Wrapped USDT (Ethereum)', issuer: 'MoneroUSD PSM',   verified: true, addr: 'ion1_fb0f0cee9848232b39c3bb4cf27bf258e2519345a6dcb027d0ac50c2a8feafbf' },
  'wDAI-ETH':   { name: 'Wrapped DAI (Ethereum)',  issuer: 'MoneroUSD PSM',   verified: true, addr: 'ion1_5f72c714471c6ef71670e2b5416e8f7ae5d11794d2f11adb4149a98b8adca0d0' },
  'wLUSD':      { name: 'Wrapped LUSD',             issuer: 'MoneroUSD PSM',   verified: true, addr: 'ion1_bf136101428f5eff986c727c357626453a7bcad6976b6c9c7fd462bbb2c385d8' },
});

export const VERIFIED_BY_ADDR = Object.freeze(
  Object.fromEntries(Object.entries(VERIFIED_TOKENS).map(([sym, v]) => [v.addr, sym]))
);

export function isVerified(symbol) {
  return !!VERIFIED_TOKENS[symbol];
}

// Clone protection — case-insensitive match on a verified ticker
// that ISN'T exactly the canonical capitalization.
export function isCloneAttempt(symbol) {
  const upper = String(symbol || '').toUpperCase();
  for (const key of Object.keys(VERIFIED_TOKENS)) {
    if (key.toUpperCase() === upper && key !== symbol) return true;
  }
  return false;
}

export function badgeHtml(symbol) {
  if (!symbol) return '';
  if (isVerified(symbol)) {
    const v = VERIFIED_TOKENS[symbol];
    return `<span class="badge badge-verified" title="${escapeAttr(v.name + ' — ' + v.issuer)}">&#10003; ${escapeHtml(symbol)}</span>`;
  }
  if (isCloneAttempt(symbol)) {
    return `<span class="badge badge-clone-warning" title="Unofficial token using a verified name">&#9888; ${escapeHtml(symbol)}</span>`;
  }
  return `<span class="badge">${escapeHtml(symbol)}</span>`;
}

// ── numeric / temporal formatting ──────────────────────────────────

export function formatAmount(atomic) {
  if (atomic == null) return '—';
  const big = BigInt(String(atomic));
  const whole = big / BigInt(ATOMIC);
  const frac  = (big % BigInt(ATOMIC)).toString().padStart(8, '0').replace(/0+$/, '');
  return whole.toLocaleString('en-US') + (frac ? '.' + frac : '');
}

export function formatDifficulty(d) {
  if (!d) return 'N/A';
  const n = Number(d);
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' G';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + ' M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + ' K';
  return n.toLocaleString();
}

export function formatHashrate(hps) {
  if (!hps || !isFinite(hps)) return 'N/A';
  const n = Number(hps);
  if (n >= 1e12) return (n / 1e12).toFixed(2) + ' TH/s';
  if (n >= 1e9)  return (n / 1e9).toFixed(2)  + ' GH/s';
  if (n >= 1e6)  return (n / 1e6).toFixed(2)  + ' MH/s';
  if (n >= 1e3)  return (n / 1e3).toFixed(2)  + ' KH/s';
  return n.toFixed(2) + ' H/s';
}

export function timeSince(unixSec) {
  if (!unixSec) return '—';
  const diff = Math.floor(Date.now() / 1000) - Number(unixSec);
  if (diff < 0) return 'just now';
  if (diff < 60) return diff + 's ago';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

export function shortAddr(s, lead = 12, tail = 6) {
  if (!s || typeof s !== 'string') return '—';
  if (s.length <= lead + tail + 3) return s;
  return s.slice(0, lead) + '…' + s.slice(-tail);
}

// ── tx classification (ported from legacy detectTxBadge) ───────────
//
// Carrier txs in MoneroUSD encode bridge / conversion / transfer
// operations as `ion://op/v1?code=…&payload=…` in tx_extra. The
// detector reads tx.extra (when decoded) and surfaces the badge
// type used in the block + tx pages.

export function detectTxBadge(tx) {
  if (!tx || !tx.extra) return null;
  const extra = String(tx.extra || '');
  const m = extra.match(/ion:\/\/op\/v1\?code=([A-Z_]+)/);
  if (!m) return null;
  const code = m[1];
  // Asset detection
  const assetMatch = extra.match(/asset=([A-Za-z0-9_-]+)/);
  const asset = assetMatch ? assetMatch[1] : null;
  switch (code) {
    case 'BRIDGE_WRAP':   return { type: 'bridge-wrap',   asset, label: 'Wrap' };
    case 'BRIDGE_UNWRAP': return { type: 'bridge-unwrap', asset, label: 'Unwrap' };
    case 'BRIDGE_MINT':   return { type: 'bridge-wrap',   asset, label: 'Mint' };
    case 'BRIDGE_BURN':   return { type: 'bridge-unwrap', asset, label: 'Burn' };
    case 'TOKEN_TRANSFER':return { type: 'asset-transfer', asset, label: 'Transfer' };
    case 'TOKEN_CREATE':  return { type: 'asset-transfer', asset, label: 'Create' };
    case 'SWAP_FILL':     return { type: 'conversion',    asset, label: 'Swap' };
    case 'LP_MINT':       return { type: 'conversion',    asset, label: 'LP Mint' };
    case 'LP_BURN':       return { type: 'conversion',    asset, label: 'LP Burn' };
    case 'DC_DEPLOY':     return { type: 'asset-transfer', asset: null, label: 'Deploy DC' };
    case 'DC_CALL_DIRECT':
    case 'DC_CALL_COMMIT':
    case 'DC_CALL_REVEAL': return { type: 'asset-transfer', asset: null, label: code.replace('DC_CALL_', 'DC ') };
    default: return { type: 'asset-transfer', asset, label: code };
  }
}

export function getTxTypeName(tx) {
  if (!tx) return 'TRANSFER';
  const t = tx.tx_type ?? tx.type ?? 0;
  const map = ['TRANSFER', 'OFFSHORE', 'ONSHORE', 'OFFSHORE_TRANSFER', 'XUSD_TO_XASSET', 'XASSET_TO_XUSD', 'XASSET_TRANSFER'];
  return map[t] || 'TRANSFER';
}

// ── HTML escapers (no external deps) ───────────────────────────────

export function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttr(s) {
  return escapeHtml(s);
}
