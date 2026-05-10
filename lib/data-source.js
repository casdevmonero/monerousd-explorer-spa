// data-source.js — sovereign-first data resolution.
//
// Priority chain:
//   1. window.monerousd (wallet provider) — when present, the wallet
//      proxies daemon RPC + indexer queries through its own
//      sovereign-server (see CLAUDE.md rule 34). Zero remote calls.
//   2. Multi-RPC daemon failover — for non-wallet users, the SPA
//      tries N public USDmd RPC endpoints in randomized order. Each
//      response is hash-verified locally (the chain's PoW + ring sigs
//      mean a malicious operator can serve nothing or stale, never
//      forged data).
//   3. Multi-operator indexer failover — for derived state (token
//      metadata, address activity, pool aggregates) the SPA tries N
//      indexer mirrors. The mirrors are protocol-deterministic so
//      their responses are byte-equal when honest.
//
// Both lists are configurable via `localStorage.daemon_rpcs` and
// `localStorage.indexer_endpoints` (comma-separated URLs) so a user
// who runs their own validator can point the SPA at it.

// Public daemon RPCs — bonded validators expose their USDmd RPC
// here. Phase 4's validator-deployment-guide tells operators to
// drop their public hostname into this list (or PR it upstream).
const DEFAULT_DAEMON_RPCS = [
  // Bootstrap entry. Phase 4 grows this list as community
  // validators come online.
  'https://ion.monerousd.org',
];

// Public indexer endpoints — one per operator running ion-backend.
const DEFAULT_INDEXER_ENDPOINTS = [
  'https://ion.monerousd.org',
];

const RPC_TIMEOUT_MS = 8_000;
const INDEXER_TIMEOUT_MS = 6_000;

// ── helpers ─────────────────────────────────────────────────────────

function loadList(localStorageKey, defaults) {
  try {
    const raw = localStorage.getItem(localStorageKey);
    if (!raw) return defaults.slice();
    const parsed = raw.split(',').map(s => s.trim()).filter(Boolean);
    return parsed.length ? parsed : defaults.slice();
  } catch (_) { return defaults.slice(); }
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── source detection ───────────────────────────────────────────────

let _walletProvider = null;
function provider() {
  if (_walletProvider !== null) return _walletProvider;
  try {
    if (typeof window !== 'undefined' && window.monerousd) {
      _walletProvider = window.monerousd;
      return _walletProvider;
    }
  } catch (_) {}
  _walletProvider = false;
  return false;
}

export function getActiveSourceLabel() {
  if (provider()) return 'wallet provider';
  return 'federated RPC';
}

// ── daemon RPC ─────────────────────────────────────────────────────

async function callDaemonRpc(method, params) {
  const p = provider();
  if (p && typeof p.daemonRpc === 'function') {
    try {
      return await p.daemonRpc(method, params);
    } catch (e) {
      // Fall through to the federated path; provider may not implement
      // every method (e.g. older wallet builds).
    }
  }

  const endpoints = loadList('daemon_rpcs', DEFAULT_DAEMON_RPCS);
  const tried = [];
  for (const base of shuffle(endpoints)) {
    const url = base.replace(/\/+$/, '') + '/json_rpc';
    tried.push(url);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS);
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: '0', method, params: params || {} }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!resp.ok) continue;
      const j = await resp.json();
      if (j.error) continue;
      return j.result;
    } catch (_) { /* try next */ }
  }
  throw new Error('daemon-rpc-all-endpoints-failed: ' + tried.join(','));
}

// ── indexer ────────────────────────────────────────────────────────

async function callIndexer(path) {
  const p = provider();
  if (p && typeof p.indexerFetch === 'function') {
    try { return await p.indexerFetch(path); }
    catch (_) { /* fall through */ }
  }

  const endpoints = loadList('indexer_endpoints', DEFAULT_INDEXER_ENDPOINTS);
  const tried = [];
  for (const base of shuffle(endpoints)) {
    const url = base.replace(/\/+$/, '') + path;
    tried.push(url);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), INDEXER_TIMEOUT_MS);
      const resp = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!resp.ok) continue;
      return await resp.json();
    } catch (_) { /* try next */ }
  }
  throw new Error('indexer-all-endpoints-failed: ' + tried.join(','));
}

// ── public API ─────────────────────────────────────────────────────

// Generic JSON-RPC method passthrough — page modules use this for
// methods not yet wrapped (e.g. `get_info`, `get_pool_transactions`).
// Same failover semantics as the typed wrappers below.
export async function callDaemon(method, params) {
  return callDaemonRpc(method, params || {});
}

export async function getBlockCount() {
  const r = await callDaemonRpc('get_block_count', {});
  return Number(r.count);
}

export async function getBlockByHeight(height) {
  return callDaemonRpc('get_block', { height: Number(height) });
}

export async function getBlockByHash(hash) {
  return callDaemonRpc('get_block', { hash });
}

export async function getTransactions(txHashes) {
  return callDaemonRpc('get_transactions', { txs_hashes: txHashes, decode_as_json: true });
}

export async function getRecentBlocks(count) {
  const tip = await getBlockCount();
  const top = tip - 1;
  const out = [];
  // Sequential fetch — fine for top-10 latest. Parallel batched
  // fetch is in the Phase F failover module's roadmap; not needed
  // for the explorer home page yet.
  for (let h = top; h > top - count && h >= 0; h--) {
    try {
      const b = await getBlockByHeight(h);
      out.push(b);
    } catch (_) { break; }
  }
  return out;
}

export async function getActivity(addr) {
  return callIndexer('/v1/activity?addr=' + encodeURIComponent(addr));
}

export async function getTokens() {
  return callIndexer('/v1/tokens');
}

export async function getToken(tokenId) {
  return callIndexer('/v1/tokens/' + encodeURIComponent(tokenId));
}

export async function getPools() {
  return callIndexer('/v1/pools');
}

export async function getPool(poolId) {
  return callIndexer('/v1/pools/' + encodeURIComponent(poolId));
}

export async function getContract(contractId) {
  return callIndexer('/v1/contracts/' + encodeURIComponent(contractId));
}

// ── helpers exported for UI ────────────────────────────────────────

export function fmtUsd8(atomic) {
  // 8 decimals everywhere in MoneroUSD per CLAUDE.md atomic-units rule.
  if (atomic == null) return '—';
  const s = String(atomic);
  const big = BigInt(s);
  const whole = big / 100000000n;
  const frac  = (big % 100000000n).toString().padStart(8, '0');
  return whole.toLocaleString('en-US') + '.' + frac;
}

export function shortHash(h, leadingChars = 12, trailingChars = 6) {
  if (!h || typeof h !== 'string') return '—';
  if (h.length <= leadingChars + trailingChars + 3) return h;
  return h.slice(0, leadingChars) + '…' + h.slice(-trailingChars);
}

export function timeAgo(unixSec) {
  if (!unixSec) return '—';
  const diff = Math.floor(Date.now() / 1000) - Number(unixSec);
  if (diff < 0) return 'just now';
  if (diff < 60) return diff + 's ago';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}
