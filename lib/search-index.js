// search-index.js — local autocomplete index for the header search
// dropdown.
//
// What's INDEXED locally (no remote call to suggest):
//   • Verified tokens / wrapped assets / NFT collections
//   • Verified organizations
//   • Tokens fetched from /v1/tokens (custom community tokens)
//   • Sovereign sites fetched from /v1/sites
//
// What's NOT indexed (still works, fires on Enter):
//   • Tx hashes, block hashes, addresses → falls through to the
//     existing /q/<query> page that handles unknown queries.
//
// The dropdown is the "what am I clicking" UX every wallet user
// expects after seeing Phantom or Uniswap.

import * as ds from './data-source.js';
import {
  VERIFIED_TOKENS, WRAPPED_ASSETS, VERIFIED_NFTS, VERIFIED_ORGS,
  logoUrlFor, initials,
} from './registries.js';

const ENTRIES = [];  // flat list — every searchable item
let _customTokensLoaded = false;
let _sitesLoaded = false;

function pushTokenEntry(t, kind, badge) {
  const sym = (t.symbol || t.ticker || '').toString();
  const name = (t.name || sym).toString();
  ENTRIES.push({
    kind,                                  // 'token' | 'wrapped' | 'nft' | 'site' | 'org' | 'custom-token'
    label: name,
    symbol: sym,
    sub: t.tokenId || t.id || '',
    href: '#/token/' + encodeURIComponent(t.tokenId || sym),
    logo: logoUrlFor(t),
    badge: badge || null,
    haystack: (name + ' ' + sym + ' ' + (t.tokenId || '')).toLowerCase(),
    org: t.org || null,
  });
}

function pushOrgEntry(o) {
  ENTRIES.push({
    kind: 'org',
    label: o.name,
    symbol: o.slug,
    sub: o.blurb || '',
    href: '#/org/' + encodeURIComponent(o.slug),
    logo: null,                            // letter-badge from initials()
    badge: 'verified',
    haystack: (o.name + ' ' + o.slug + ' ' + (o.blurb || '')).toLowerCase(),
  });
}

function pushSiteEntry(s) {
  const dom = s.domain || s.url || '';
  ENTRIES.push({
    kind: 'site',
    label: dom,
    symbol: dom,
    sub: 'v' + (s.version || '?') + ' · ' + (s.publisher ? s.publisher.slice(0, 16) + '…' : ''),
    href: '#/site/' + encodeURIComponent(dom),
    logo: null,
    badge: s.verified ? 'verified' : null,
    haystack: dom.toLowerCase(),
  });
}

// Seed the static registries immediately at module load — the
// search dropdown should never wait on a network call to show the
// most-common results (USDm, wBTC, …).
for (const t of VERIFIED_TOKENS)   pushTokenEntry(t, 'token',   'verified');
for (const w of WRAPPED_ASSETS)    pushTokenEntry(w, 'wrapped', 'verified');
for (const n of VERIFIED_NFTS)     pushTokenEntry(n, 'nft',     'verified');
for (const o of VERIFIED_ORGS)     pushOrgEntry(o);

// Background-load custom tokens + sovereign sites once, then cache.
async function loadCustomTokensOnce() {
  if (_customTokensLoaded) return;
  _customTokensLoaded = true;
  try {
    const tokens = await ds.getTokens();
    const list = Array.isArray(tokens) ? tokens
              : (tokens && tokens.tokens) ? tokens.tokens
              : (tokens && tokens.items)  ? tokens.items
              : [];
    const seen = new Set(ENTRIES.filter(e => e.kind === 'token' || e.kind === 'wrapped')
      .map(e => (e.symbol || '').toUpperCase()));
    for (const t of list) {
      const sym = (t.symbol || t.ticker || '').toString();
      if (!sym || seen.has(sym.toUpperCase())) continue;
      pushTokenEntry(t, 'custom-token', null);
    }
  } catch (_) {
    // Soft fail — search still works with just the registries.
  }
}

async function loadSitesOnce() {
  if (_sitesLoaded) return;
  _sitesLoaded = true;
  try {
    const r = await ds.callIndexerSafe('/v1/sites');
    const list = Array.isArray(r) ? r
              : (r && r.sites) ? r.sites
              : (r && r.items) ? r.items
              : [];
    for (const s of list) pushSiteEntry(s);
  } catch (_) { /* soft fail */ }
}

export async function primeIndex() {
  // Kick off background loads. Fire-and-forget — early dropdown
  // queries use the pre-seeded registry entries while these
  // populate.
  loadCustomTokensOnce();
  loadSitesOnce();
}

// Lightweight prefix + substring match. Sort: prefix matches first,
// then symbol-substring, then label-substring, then haystack.
export function searchLocal(query, limit = 12) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return [];

  const scored = [];
  for (const e of ENTRIES) {
    const sym = (e.symbol || '').toLowerCase();
    const label = (e.label || '').toLowerCase();
    let score = 0;
    if (sym === q)                          score = 100;
    else if (sym.startsWith(q))             score = 80;
    else if (label.toLowerCase() === q)     score = 70;
    else if (label.startsWith(q))           score = 60;
    else if (sym.includes(q))               score = 50;
    else if (label.includes(q))             score = 40;
    else if (e.haystack.includes(q))        score = 20;
    if (score > 0) {
      // Tiny boost for verified entries so USDm sorts above
      // a custom token with the same prefix.
      if (e.badge === 'verified') score += 3;
      scored.push({ score, entry: e });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.entry);
}

// Group entries by kind for the dropdown's sectioned layout.
const KIND_LABELS = {
  token:        'Tokens',
  wrapped:      'Wrapped assets',
  nft:          'NFT collections',
  'custom-token': 'Community tokens',
  org:          'Organizations',
  site:         'Sovereign sites',
};

export function groupByKind(entries) {
  const groups = new Map();
  for (const e of entries) {
    const key = e.kind;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  const order = ['token', 'wrapped', 'custom-token', 'nft', 'org', 'site'];
  const out = [];
  for (const k of order) {
    if (groups.has(k)) out.push({ kind: k, label: KIND_LABELS[k] || k, entries: groups.get(k) });
  }
  return out;
}

export function initialsFor(label) { return initials(label); }
