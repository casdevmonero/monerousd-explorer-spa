// registries.js — frozen registries for verified tokens, NFTs,
// wrapped assets, and protocol organizations. Mirrors the
// approach used in monerousd-explorer/app.js§19.15 (VERIFIED_TOKENS):
// hardcoded + Object.freeze() + change-by-deploy. No runtime
// mutation — clone-name attacks on official tokens always
// surface a warning.
//
// Schema kept tight so the search index can stream every entry
// into one flat list. Adding a new verified entry:
//
//   1. Append to the relevant array below.
//   2. Add a logo SVG at https://ion.monerousd.org/assets/tokens/<sym>.svg
//      (or set logoUrl explicitly).
//   3. CI grep ensures no symbol collisions across the four lists.

// ─── Tokens (protocol-issued + community-issued verified) ─────────

export const VERIFIED_TOKENS = Object.freeze([
  {
    symbol: 'USDm',
    name: 'MoneroUSD',
    issuer: 'MoneroUSD Protocol',
    org: 'monerousd-protocol',
    tokenId: 'ion1_daaab274fe19e359596c2dde047a2ba06ffda90d3c23cacff02123c6312578a4',
    logoUrl: 'https://ion.monerousd.org/api/token-logo/USDm',
    description: 'The native privacy-preserving USD stablecoin of MoneroUSD.',
    kind: 'stable',
  },
]);

// ─── Wrapped assets (FROST PSM custody) ───────────────────────────

export const WRAPPED_ASSETS = Object.freeze([
  { symbol: 'wBTC',   name: 'Wrapped Bitcoin',       homeChain: 'BTC',  issuer: 'MoneroUSD Bridge', org: 'monerousd-bridge', tokenId: 'ion1_39864f297d8ce6f6472e7cdadba3de06ccf1eb7a6c2563733e49e0d62c7d1f13' },
  { symbol: 'wXMR',   name: 'Wrapped Monero',        homeChain: 'XMR',  issuer: 'MoneroUSD Bridge', org: 'monerousd-bridge', tokenId: 'ion1_f951098d2844223f60de7fa9290872968ccee32a236b07076be91a71af83d72c' },
  { symbol: 'wETH',   name: 'Wrapped Ethereum',      homeChain: 'ETH',  issuer: 'MoneroUSD Bridge', org: 'monerousd-bridge', tokenId: 'ion1_cf993a8b5217d300ea7673c87ba4fc714c92f8ff64d74c42f4ca14294416140e' },
  { symbol: 'wLTC',   name: 'Wrapped Litecoin',      homeChain: 'LTC',  issuer: 'MoneroUSD Bridge', org: 'monerousd-bridge', tokenId: 'ion1_8e6721cedb26be8a0a83eebbd89144329feb60dff120d03dccd2cc2653d9befe' },
  { symbol: 'wDOGE',  name: 'Wrapped Dogecoin',      homeChain: 'DOGE', issuer: 'MoneroUSD Bridge', org: 'monerousd-bridge', tokenId: 'ion1_cf052144ec19e507923ac12c0c6a9f79aaf2d40b570a3c14218877a533bc887c' },
  { symbol: 'wSOL',   name: 'Wrapped Solana',        homeChain: 'SOL',  issuer: 'MoneroUSD Bridge', org: 'monerousd-bridge', tokenId: 'ion1_2ccdeb4e4b7f3c1d8427f430be5eab04b0347aa1832005c1c5db83102af04f74' },
  { symbol: 'wADA',   name: 'Wrapped Cardano',       homeChain: 'ADA',  issuer: 'MoneroUSD Bridge', org: 'monerousd-bridge', tokenId: 'ion1_86d6668f72379a01dc85417aec2f49ebef49ac01c6dedb8dcf0d266c91930074' },
  { symbol: 'wBCH',   name: 'Wrapped Bitcoin Cash',  homeChain: 'BCH',  issuer: 'MoneroUSD Bridge', org: 'monerousd-bridge', tokenId: 'ion1_17911256c9d89fe75bc1151dcb07d9683aa0440af613a8cdbd2e87e6fd2cc73b' },
  { symbol: 'wZEC',   name: 'Wrapped Zcash',         homeChain: 'ZEC',  issuer: 'MoneroUSD Bridge', org: 'monerousd-bridge', tokenId: 'ion1_1e4b86f8642ee1f49d020b30d57c81b7b5342da4b2ee9e11e271108c219de51e' },
  { symbol: 'wBNB',   name: 'Wrapped BNB',           homeChain: 'BSC',  issuer: 'MoneroUSD Bridge', org: 'monerousd-bridge', tokenId: 'ion1_369cbbae7360123b99f0a46c2d7a91ed37475357683fa1150c9529926cc66617' },
  { symbol: 'wUSDT-TRX', name: 'Wrapped USDT (Tron)', homeChain: 'TRX', issuer: 'MoneroUSD PSM',    org: 'monerousd-psm',    tokenId: 'ion1_4ce50f558e9b475c8504b0b47ab5a9bfe654a4f99757338234ae807dd8a57081' },
  { symbol: 'wRLUSD', name: 'Wrapped RLUSD',         homeChain: 'XRP',  issuer: 'MoneroUSD PSM',    org: 'monerousd-psm',    tokenId: 'ion1_9619b844ae92e58f2abbcca9a28103469fe5e4901f92e27461fd75e8fc784ddc' },
]);

// ─── NFT collections (verified) ───────────────────────────────────
// Empty at v1; collections will populate from on-chain TOKEN_CREATE
// + NFT_MINT data via the indexer. Hardcoded list is the operator's
// curated set of "trusted" collections; everything else is shown
// from chain data with no badge.

export const VERIFIED_NFTS = Object.freeze([
  // {
  //   symbol: 'GENESIS',
  //   name: 'MoneroUSD Genesis Citizens',
  //   org: 'monerousd-protocol',
  //   tokenId: 'ion1_...',
  //   description: 'Inaugural NFT collection celebrating the MoneroUSD genesis.',
  // },
]);

// ─── Organizations (deploy contracts + issue tokens + publish sites)
// The Phantom-style /org/<slug> profile aggregates everything an
// organization touches on chain.

export const VERIFIED_ORGS = Object.freeze([
  {
    slug: 'monerousd-protocol',
    name: 'MoneroUSD Protocol',
    blurb: 'Core team behind MoneroUSD: chain, wallet, IDE, sovereign hosting, and the USDm stablecoin.',
    website: 'https://monerousd.org',
    explorerSite: 'monerousd.org',
    badges: ['core', 'verified'],
  },
  {
    slug: 'monerousd-bridge',
    name: 'MoneroUSD Bridge',
    blurb: 'FROST threshold custody for non-stable wrapped assets (wBTC / wXMR / wETH / wLTC / wDOGE / wSOL / wADA / wBCH / wZEC / wBNB).',
    website: 'https://ionswap.monerousd.org',
    explorerSite: 'ionswap.monerousd.org',
    badges: ['custody', 'verified'],
  },
  {
    slug: 'monerousd-psm',
    name: 'MoneroUSD PSM',
    blurb: 'Peg Stability Module for stablecoin-backed wrappers (wUSDT-TRX, wRLUSD).',
    website: 'https://ionswap.monerousd.org',
    explorerSite: 'ionswap.monerousd.org',
    badges: ['psm', 'verified'],
  },
  {
    slug: 'ion-swap',
    name: 'Ion Swap',
    blurb: 'AMM, dark pool, bridge, and token launchpad for MoneroUSD.',
    website: 'https://ionswap.monerousd.org',
    explorerSite: 'ionswap.monerousd.org',
    badges: ['dex', 'verified'],
  },
]);

// ─── Helpers ──────────────────────────────────────────────────────

export function getOrg(slug) {
  return VERIFIED_ORGS.find(o => o.slug === slug) || null;
}

export function logoUrlFor(entry) {
  if (entry.logoUrl) return entry.logoUrl;
  return 'https://ion.monerousd.org/api/token-logo/' + encodeURIComponent(entry.symbol || entry.tokenId);
}

export function initials(name) {
  if (!name) return '?';
  return name
    .split(/[\s-_/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0].toUpperCase())
    .join('');
}
