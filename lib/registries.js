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
  { symbol: 'wBTC',   name: 'Wrapped Bitcoin',       homeChain: 'BTC',  issuer: 'MoneroUSD Bridge', org: 'ion-swap', tokenId: 'ion1_39864f297d8ce6f6472e7cdadba3de06ccf1eb7a6c2563733e49e0d62c7d1f13' },
  { symbol: 'wXMR',   name: 'Wrapped Monero',        homeChain: 'XMR',  issuer: 'MoneroUSD Bridge', org: 'ion-swap', tokenId: 'ion1_f951098d2844223f60de7fa9290872968ccee32a236b07076be91a71af83d72c' },
  { symbol: 'wETH',   name: 'Wrapped Ethereum',      homeChain: 'ETH',  issuer: 'MoneroUSD Bridge', org: 'ion-swap', tokenId: 'ion1_cf993a8b5217d300ea7673c87ba4fc714c92f8ff64d74c42f4ca14294416140e' },
  { symbol: 'wLTC',   name: 'Wrapped Litecoin',      homeChain: 'LTC',  issuer: 'MoneroUSD Bridge', org: 'ion-swap', tokenId: 'ion1_8e6721cedb26be8a0a83eebbd89144329feb60dff120d03dccd2cc2653d9befe' },
  { symbol: 'wDOGE',  name: 'Wrapped Dogecoin',      homeChain: 'DOGE', issuer: 'MoneroUSD Bridge', org: 'ion-swap', tokenId: 'ion1_cf052144ec19e507923ac12c0c6a9f79aaf2d40b570a3c14218877a533bc887c' },
  { symbol: 'wSOL',   name: 'Wrapped Solana',        homeChain: 'SOL',  issuer: 'MoneroUSD Bridge', org: 'ion-swap', tokenId: 'ion1_2ccdeb4e4b7f3c1d8427f430be5eab04b0347aa1832005c1c5db83102af04f74' },
  { symbol: 'wADA',   name: 'Wrapped Cardano',       homeChain: 'ADA',  issuer: 'MoneroUSD Bridge', org: 'ion-swap', tokenId: 'ion1_86d6668f72379a01dc85417aec2f49ebef49ac01c6dedb8dcf0d266c91930074' },
  { symbol: 'wBCH',   name: 'Wrapped Bitcoin Cash',  homeChain: 'BCH',  issuer: 'MoneroUSD Bridge', org: 'ion-swap', tokenId: 'ion1_17911256c9d89fe75bc1151dcb07d9683aa0440af613a8cdbd2e87e6fd2cc73b' },
  { symbol: 'wZEC',   name: 'Wrapped Zcash',         homeChain: 'ZEC',  issuer: 'MoneroUSD Bridge', org: 'ion-swap', tokenId: 'ion1_1e4b86f8642ee1f49d020b30d57c81b7b5342da4b2ee9e11e271108c219de51e' },
  { symbol: 'wBNB',   name: 'Wrapped BNB',           homeChain: 'BSC',  issuer: 'MoneroUSD Bridge', org: 'ion-swap', tokenId: 'ion1_369cbbae7360123b99f0a46c2d7a91ed37475357683fa1150c9529926cc66617' },
  { symbol: 'wUSDT-TRX', name: 'Wrapped USDT (Tron)', homeChain: 'TRX', issuer: 'MoneroUSD PSM',    org: 'ion-swap',    tokenId: 'ion1_4ce50f558e9b475c8504b0b47ab5a9bfe654a4f99757338234ae807dd8a57081' },
  { symbol: 'wRLUSD', name: 'Wrapped RLUSD',         homeChain: 'XRP',  issuer: 'MoneroUSD PSM',    org: 'ion-swap',    tokenId: 'ion1_9619b844ae92e58f2abbcca9a28103469fe5e4901f92e27461fd75e8fc784ddc' },
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

// Two canonical organizations only. The Bridge and the PSM are
// FEATURES of Ion Swap (its FROST custody and stablecoin-conversion
// modules), not standalone publishers. The wrapped-asset rows
// below keep their human-friendly issuer string ("MoneroUSD Bridge"
// / "MoneroUSD PSM") for display purposes, but every `org` link
// points to the canonical `ion-swap` slug.
export const VERIFIED_ORGS = Object.freeze([
  {
    slug: 'monerousd-protocol',
    name: 'MoneroUSD Protocol',
    blurb: 'Core team behind MoneroUSD: chain, wallet, IDE, sovereign hosting, and the USDm stablecoin.',
    website: 'https://monerousd.org',
    explorerSite: 'monerousd.org',
    badges: ['core', 'verified'],
    logoUrl: '/assets/logos/monerousd.svg',
  },
  {
    slug: 'ion-swap',
    name: 'Ion Swap',
    blurb: 'AMM, dark pool, FROST-custodied bridge, PSM stablecoin converter, and token launchpad for MoneroUSD.',
    website: 'https://ionswap.monerousd.org',
    explorerSite: 'ionswap.monerousd.org',
    badges: ['dex', 'bridge', 'psm', 'verified'],
    logoUrl: '/assets/logos/ion-swap.svg',
  },
]);

// ─── Verified contracts (seed list per organization) ──────────────
//
// Authoritative list of dark contracts deployed by each verified
// org. Source: ion-monerousd-org/backend/{amm,bridge,governance,
// monitor,sites}/ at v1.2.228 (every contract that's actively wired
// in the production backend). When the federated indexer's
// `/v1/contracts?org=<slug>` is reachable, those rows merge with
// these — we de-dup on contractId. When the indexer is offline the
// seed list still renders, so the org profile is never empty.
//
// Schema:
//   slug         org slug (matches VERIFIED_ORGS[].slug)
//   name         human-friendly contract name
//   role         one-line description of what the contract does
//   contractId   on-chain contract id (ion1c_*). Empty string is OK
//                for contracts that don't have a single canonical
//                id (e.g. a logical contract whose impl rotates).
//   codeHash     bytecode hash; falsy when unknown / live-only.
//   sourceUrl    URL to the .dsol source (or backend module).

export const VERIFIED_CONTRACTS = Object.freeze([
  // ─── Ion Swap (DEX + bridge + launchpad) ───────────────────────
  { slug: 'ion-swap', name: 'IonSwapPool',          role: 'AMM constant-product pool factory + per-pool state.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/backend/amm/pool.js' },
  { slug: 'ion-swap', name: 'IonSwapRouter',        role: 'Multi-hop swap router + price-impact + slippage guards.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/backend/amm/router.js' },
  { slug: 'ion-swap', name: 'IonSwapDeposit',       role: 'Stealth swap-deposit address allocator; binds incoming deposits to swap intents.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/build-1261/dark-contracts/contracts/ion-swap-deposit/IonSwapDeposit.dsol' },
  { slug: 'ion-swap', name: 'StateCommit',          role: 'Per-block Merkle anchor of pool_events + dark_sites + dark_contracts.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/backend/amm/state-commit.js' },
  { slug: 'ion-swap', name: 'TokenCreate',          role: 'TOKEN_CREATE op handler — verified registry, bond, supply rules.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/backend/tokens/create.js' },
  { slug: 'ion-swap', name: 'TokenMint',            role: 'TOKEN_MINT_SUPPLY op handler — creator-only minting with 50 bps fee.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/backend/tokens/mint.js' },
  { slug: 'ion-swap', name: 'LpManager',            role: 'LP_MINT / LP_BURN handlers — Pedersen-blinded openings client-side.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/backend/amm/lp.js' },
  { slug: 'ion-swap', name: 'LimitOrderBook',       role: 'On-chain limit order matching with commit-reveal price discovery.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/build-1261/dark-contracts/contracts/limit-order-book/LimitOrderBook.dsol' },
  { slug: 'ion-swap', name: 'Auction',              role: 'Sealed-bid auctions for protocol-managed assets.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/build-1261/dark-contracts/contracts/auction/Auction.dsol' },
  { slug: 'ion-swap', name: 'StopLoss',             role: 'Triggered swap orders fired when oracle prices cross thresholds.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/build-1261/dark-contracts/contracts/stop-loss/StopLoss.dsol' },
  { slug: 'ion-swap', name: 'LiquidityMining',      role: 'LP reward distribution against pool_events tally.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/build-1261/dark-contracts/contracts/liquidity-mining/LiquidityMining.dsol' },
  { slug: 'ion-swap', name: 'NftCollection',        role: 'NFT_MINT / NFT_TRANSFER handlers — per-collection metadata.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/backend/nft/collection.js' },
  { slug: 'ion-swap', name: 'DarkPool',             role: 'Encrypted intent matching for large orders (ChaCha20-Poly1305).', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/backend/amm/dark-pool.js' },

  // ─── MoneroUSD Bridge (FROST custody for non-stable wrappers) ──
  { slug: 'ion-swap', name: 'BridgeValidatorBond', role: 'BridgeValidatorBond.dsol — scaling-bond curve, slash-on-evidence, 14-day unbond.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/build-1261/dark-contracts/contracts/bridge-validator-bond/BridgeValidatorBond.dsol' },
  { slug: 'ion-swap', name: 'BridgeWrap',          role: 'Cross-chain deposit watcher + BRIDGE_WRAP attestation dispatch.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/backend/bridge/wrap-flow.js' },
  { slug: 'ion-swap', name: 'BridgeUnwrap',        role: 'BRIDGE_UNWRAP handler + home-chain payout queue (FROST-signed).', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/backend/bridge/unwrap-flow.js' },
  { slug: 'ion-swap', name: 'WrappedAssetRegistry',role: 'Per-wrapper canonical addresses, mint/burn caps, fee curve.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/backend/bridge/wrapped-assets.js' },
  { slug: 'ion-swap', name: 'ColdReserveAttest',   role: 'Attests cold-reserve home-chain balances on every block.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/backend/bridge/cold-reserve.js' },

  // ─── MoneroUSD PSM (stablecoin-backed wrappers) ────────────────
  { slug: 'ion-swap', name: 'PsmTrxConverter', role: 'wUSDT-TRX deposit↔auto-USDm-mint converter; TRX-side FROST custody.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/backend/bridge/psm-trx.js' },
  { slug: 'ion-swap', name: 'PsmEthConverter', role: 'wUSDC/wUSDT/wDAI/wLUSD/wRLUSD ETH-side Uniswap V3 auto-swap on deposit.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/backend/bridge/psm-eth.js' },
  { slug: 'ion-swap', name: 'StableMintRouter',role: 'Routes stable deposits to USDm mints; freeze defense via swap-to-ETH.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/backend/bridge/stable-mint.js' },

  // ─── MoneroUSD Protocol (governance + core) ────────────────────
  { slug: 'monerousd-protocol', name: 'Constitution',     role: 'Constitution.dsol — frozen + amendable governance slots; founder pay quadruply-frozen.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/build-1261/dark-contracts/sovereign/Constitution.dsol' },
  { slug: 'monerousd-protocol', name: 'Mimir',            role: 'Mimir/* governance proposals + tally + enactment dispatch.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/backend/governance/mimir.js' },
  { slug: 'monerousd-protocol', name: 'EmergencyCancel',  role: 'Status-quo-preserving ⌈n/2⌉ cancellation of in-flight proposals.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/backend/governance/cancel-handler.js' },
  { slug: 'monerousd-protocol', name: 'FeeSplit',         role: 'Per-op fee routing — 100% of SITE_*, LP_*, TOKEN_* fees → reserve.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/backend/fees/split.js' },
  { slug: 'monerousd-protocol', name: 'SiteRegistry',     role: 'SITE_PUBLISH / SITE_TRANSFER / SITE_REVOKE ledger; sovereign-hosting anchor.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/backend/sites/registry.js' },
  { slug: 'monerousd-protocol', name: 'DarkContractsVM',  role: 'DSOL bytecode interpreter; DC_DEPLOY / DC_CALL_* / DC_DESTROY dispatch.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/backend/dark-contracts/vm.js' },
  { slug: 'monerousd-protocol', name: 'AttestationCodec', role: 'ion://op/v1 codec — 26-op opcode registry + signature verify.', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/backend/monitor/attestation-codec.js' },
  { slug: 'monerousd-protocol', name: 'LwsScopeIndex',    role: 'Light Wallet Server scope_id index (Option 3 fast-restore).', contractId: '', sourceUrl: 'https://github.com/casdevmonero/ion-monerousd-org/blob/main/backend/lws/index.cjs' },
]);

export function contractsForOrg(slug) {
  return VERIFIED_CONTRACTS.filter(c => c.slug === slug);
}

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
