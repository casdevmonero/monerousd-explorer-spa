// ecosystem.js — central ecosystem-data layer.
//
// Every page in the explorer that needs "live state derived from
// the chain" calls one of the helpers in this file. The helpers:
//
//   1. Try the LOCAL chain-scanner (if a wallet provider is
//      attached — the user opened the explorer from inside the
//      desktop wallet's launchpad). Sub-millisecond, zero
//      indexer traffic.
//   2. Otherwise: fan out to the federated indexer endpoints
//      (lib/data-source.js handles failover + timeout), call the
//      matching /v1/* JSON endpoint, parse the response into a
//      stable schema.
//   3. Cache the parsed result in-memory for `TTL_MS` so the
//      next page visit doesn't trigger another network call.
//   4. Merge with the curated registry (lib/registries.js) — a
//      verified token always wins on metadata (name, logo,
//      issuer) but the LIVE balance / supply / pool depth
//      always wins on numbers.
//
// Soft-fail discipline: when every source fails, helpers return
// `{ data: <fallback>, source: 'offline', error: <msg> }`. The
// page renders the fallback and shows a small "indexer offline"
// pill in the card header. The page is NEVER blank.
//
// Schema convention: every helper returns
//   { source: 'wallet'|'indexer'|'cache'|'offline'|'fallback',
//     fetchedAt: <epoch ms>, data: <typed shape>, error?: <msg> }
//
// Adding a new ecosystem helper:
//   1. Add a `getXxx()` function below.
//   2. Define its endpoint(s) + the JSON shape it expects.
//   3. Provide a fallback (registries.js or empty list).
//   4. Use the `withCache(key, ttl, loader)` wrapper so every
//      helper gets the same caching + failover semantics.

import * as ds from './data-source.js';
import {
  VERIFIED_TOKENS, WRAPPED_ASSETS, VERIFIED_NFTS, VERIFIED_ORGS,
  VERIFIED_CONTRACTS, contractsForOrg, logoUrlFor,
} from './registries.js';

// ─── In-memory cache (TTL-bounded) ────────────────────────────────

const TTL_MS = 30_000;           // 30 s — fresh enough for live pages
const _cache = new Map();        // key → { v, t }

async function withCache(key, loader) {
  const now = Date.now();
  const hit = _cache.get(key);
  if (hit && (now - hit.t) < TTL_MS) {
    return { source: 'cache', fetchedAt: hit.t, data: hit.v };
  }
  try {
    const data = await loader();
    _cache.set(key, { v: data, t: now });
    return { source: 'indexer', fetchedAt: now, data };
  } catch (e) {
    // Reuse a stale cache value if we have one — better than
    // surfacing nothing during transient outages.
    if (hit) return { source: 'cache', fetchedAt: hit.t, data: hit.v, error: e.message };
    throw e;
  }
}

// Bust the cache for one key (or all, with no arg).
export function invalidate(key) {
  if (key == null) _cache.clear();
  else             _cache.delete(key);
}

// ─── Network-wide chain info (height, difficulty, hashrate, …) ────

export async function getChainInfo() {
  try {
    const r = await withCache('chain:info', () => ds.callDaemon('get_info'));
    return r;
  } catch (e) {
    return { source: 'offline', fetchedAt: Date.now(), data: null, error: e.message };
  }
}

// ─── Tokens (live indexer merged with verified registry) ──────────

export async function getTokens() {
  try {
    return await withCache('tokens', async () => {
      const r = await ds.getTokens();
      const live = Array.isArray(r) ? r : (r?.tokens || r?.items || []);
      // Merge: verified entries always present + tagged with metadata
      // from registries.js; live entries fill in supply / created
      // block / pool info. De-dup on tokenId (or symbol if no id).
      const byId = new Map();
      for (const v of VERIFIED_TOKENS) {
        byId.set(v.tokenId || v.symbol, { ...v, _verified: true, _registry: true });
      }
      for (const w of WRAPPED_ASSETS) {
        byId.set(w.tokenId || w.symbol, { ...w, _verified: true, _wrapped: true, _registry: true });
      }
      for (const t of live) {
        const key = t.tokenId || t.token_id || t.symbol_public || t.symbol;
        if (!key) continue;
        const existing = byId.get(key) || {};
        byId.set(key, {
          ...existing,
          ...t,
          // Carry the verified flag forward — `t` from the indexer
          // doesn't know about clone protection.
          _verified: existing._verified || false,
          _registry: existing._registry || false,
        });
      }
      return Array.from(byId.values());
    });
  } catch (e) {
    return {
      source: 'fallback',
      fetchedAt: Date.now(),
      error: e.message,
      data: [
        ...VERIFIED_TOKENS.map(t => ({ ...t, _verified: true, _registry: true })),
        ...WRAPPED_ASSETS.map(w => ({ ...w, _verified: true, _wrapped: true, _registry: true })),
      ],
    };
  }
}

// ─── Pools (AMM depth, volume, fee tier) ──────────────────────────

export async function getPools() {
  try {
    return await withCache('pools', async () => {
      const r = await ds.getPools();
      return Array.isArray(r) ? r : (r?.pools || r?.items || []);
    });
  } catch (e) {
    return { source: 'offline', fetchedAt: Date.now(), data: [], error: e.message };
  }
}

// ─── Sovereign sites ──────────────────────────────────────────────

export async function getSites() {
  try {
    return await withCache('sites', async () => {
      const r = await ds.getSites();
      return Array.isArray(r) ? r : (r?.sites || r?.items || []);
    });
  } catch (e) {
    return { source: 'offline', fetchedAt: Date.now(), data: [], error: e.message };
  }
}

// ─── Dark contracts (DC_DEPLOY ledger) — global ───────────────────

export async function getContracts() {
  try {
    return await withCache('contracts', async () => {
      const r = await ds.callIndexerSafe('/v1/contracts');
      return Array.isArray(r) ? r : (r?.contracts || r?.items || []);
    });
  } catch (e) {
    return { source: 'offline', fetchedAt: Date.now(), data: [], error: e.message };
  }
}

// ─── Validators (FROST bridge custody set) ────────────────────────
//
// The protocol exposes TWO endpoints with live data:
//
//   GET /v1/bridge/validator-count
//     → { active_validators, applications_open,
//         min_bond_atomic, min_bond_display }
//
//   GET /v1/bridge/validator-economics
//     → { min_bond_atomic, min_bond_display,
//         slashing_schedule: { missed_sign, equivocation,
//                              liveness_violation }, ... }
//
// Older shapes (`/v1/bridge/validators` returning a list) are tried
// for back-compat, but the production deploy uses the count+economics
// pair above. We aggregate everything into one envelope that the page
// can paint without conditional null-checks.

const VALIDATOR_LIST_ENDPOINTS = [
  '/v1/bridge/validators',
  '/v1/validators',
  '/v1/governance/validators',
];

export async function getValidators() {
  try {
    return await withCache('validators', async () => {
      // 1) Try every "list of validators" endpoint shape — the per-
      //    validator detail is the most useful surface if any
      //    operator exposes it. As of v1.2.228 production does NOT
      //    (per-validator pubkey leaks identity info), but a future
      //    indexer might.
      let list = [];
      for (const path of VALIDATOR_LIST_ENDPOINTS) {
        const r = await ds.callIndexerSafe(path);
        if (!r) continue;
        const candidate = Array.isArray(r) ? r : (r.validators || r.items || []);
        if (candidate.length) { list = candidate; break; }
      }

      // 2) Always pull the count + economics in parallel so the
      //    page renders meaningful stat tiles even when the
      //    per-validator list isn't exposed.
      const [countR, econR] = await Promise.all([
        ds.callIndexerSafe('/v1/bridge/validator-count'),
        ds.callIndexerSafe('/v1/bridge/validator-economics'),
      ]);

      return { list, count: countR || null, economics: econR || null };
    });
  } catch (e) {
    return { source: 'offline', fetchedAt: Date.now(),
             data: { list: [], count: null, economics: null }, error: e.message };
  }
}

// ─── Network node count (peer-manifest seeds) ─────────────────────
//
// The protocol's seed manifest at `update.monerousd.org/peer-manifest.json`
// is the FROST-signed list of known public bridge nodes. Counting
// its `seeds[]` gives us an honest floor on the "nodes online"
// metric — every wallet uses these as bootstrap peers, so any node
// on the manifest is currently reachable.
//
// Note: this is the FLOOR. Many community nodes are NOT in the
// manifest yet; they appear in the daemon's peer-list once they
// connect. A future federated indexer endpoint can expose the
// running daemon's actual outgoing/incoming peer count.

const PEER_MANIFEST_URL = 'https://update.monerousd.org/peer-manifest.json';

export async function getNetworkNodes() {
  try {
    return await withCache('network-nodes', async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5_000);
      const resp = await fetch(PEER_MANIFEST_URL, { signal: ctrl.signal });
      clearTimeout(t);
      if (!resp.ok) return { seeds: [], publishedAt: null, knownNodeCount: null };
      const j = await resp.json();
      const seeds = j?.manifest?.seeds || [];
      // Prefer the operator-asserted total (privacy-preserving — doesn't
      // enumerate the extra nodes' IPs). Falls back to seeds.length
      // when the field isn't set on older manifests.
      const knownNodeCount = Number.isInteger(j?.manifest?.known_node_count)
        ? Number(j.manifest.known_node_count)
        : seeds.length;
      return {
        seeds,
        knownNodeCount,
        publishedAt: j?.manifest?.published_at_block_height,
        expiresAt: j?.manifest?.expires_at_block_height,
        signature: j?.signature,
      };
    });
  } catch (e) {
    return { source: 'offline', fetchedAt: Date.now(),
             data: { seeds: [], knownNodeCount: 0, publishedAt: null },
             error: e.message };
  }
}

// ─── Reserve summary (per-source contributions) ───────────────────

export async function getReserveSummary() {
  try {
    return await withCache('reserve', async () => {
      const r = await ds.callIndexerSafe('/v1/reserve/summary')
             || await ds.callIndexerSafe('/v1/sites/stats');
      return r || {};
    });
  } catch (e) {
    return { source: 'offline', fetchedAt: Date.now(), data: {}, error: e.message };
  }
}

// ─── Recent activity feed (pool_events) ───────────────────────────

export async function getActivityFeed(limit = 30) {
  try {
    return await withCache('activity:' + limit, async () => {
      const r = await ds.callIndexerSafe('/v1/activity?limit=' + limit);
      return Array.isArray(r) ? r : (r?.activity || r?.events || []);
    });
  } catch (e) {
    return { source: 'offline', fetchedAt: Date.now(), data: [], error: e.message };
  }
}

// ─── Prices (oracle + pool-derived) ───────────────────────────────

export async function getPrices() {
  try {
    return await withCache('prices', async () => {
      const r = await ds.callIndexerSafe('/v1/prices')
             || await ds.callIndexerSafe('/api/prices');
      return r || {};
    });
  } catch (e) {
    return { source: 'offline', fetchedAt: Date.now(), data: {}, error: e.message };
  }
}

// ─── Organization footprint (aggregated) ──────────────────────────
//
// One call returns everything we know about an org: its identity
// metadata (registry), issued tokens (registry + filtered live),
// custodied wrappers (registry), NFT collections (registry +
// indexer), deployed contracts (registry seed + indexer merge),
// published sovereign sites (indexer + matching the org's
// explorerSite), and reserve contributions (indexer stats).
//
// Every section degrades independently — if the indexer-fed
// contracts call 502s but the indexer-fed sites call succeeds, the
// org page still shows sites + the registry-seeded contracts.

export async function getOrgFootprint(slug) {
  const org = VERIFIED_ORGS.find(o => o.slug === slug);
  if (!org) return null;

  const [tokensR, sitesR, contractsR] = await Promise.all([
    getTokens(), getSites(), getContracts(),
  ]);

  // De-dupe: wrapped assets render in their own section, so we
  // exclude them from the "Issued tokens" bucket even though the
  // tokens-list also contains them (it's the merged view used by
  // the global /tokens page).
  const wrapped = WRAPPED_ASSETS.filter(w => w.org === slug);
  const wrappedIds = new Set(wrapped.map(w => w.tokenId));
  const tokens = (tokensR.data || []).filter(t =>
    t.org === slug && !t._wrapped && !wrappedIds.has(t.tokenId || t.token_id)
  );
  const nfts = VERIFIED_NFTS.filter(n => n.org === slug);

  // Contracts: seed list always present; merge in any live deploys
  // tagged by the indexer (matched on contractId or codeHash).
  const seeded = contractsForOrg(slug);
  const live = (contractsR.data || []).filter(c => c.org === slug);
  const byKey = new Map();
  for (const s of seeded) {
    const k = s.contractId || s.name;
    byKey.set(k, { ...s, _seeded: true });
  }
  for (const c of live) {
    const k = c.contractId || c.id || c.codeHash;
    if (!k) continue;
    const existing = byKey.get(k) || {};
    byKey.set(k, { ...existing, ...c });
  }
  const contracts = Array.from(byKey.values());

  // Sites: filter to those that mention this org OR whose domain
  // contains the org's known explorerSite.
  const sites = (sitesR.data || []).filter(s =>
    (s.org && s.org === slug) ||
    (org.explorerSite && (s.domain || '').includes(org.explorerSite))
  );

  return {
    org,
    tokens,
    wrapped,
    nfts,
    contracts,
    sites,
    sources: {
      tokens:    tokensR.source,
      sites:     sitesR.source,
      contracts: contractsR.source,
    },
  };
}

// ─── Reset (used at session start so reload picks up fresh data) ──

export function resetCache() { _cache.clear(); }
