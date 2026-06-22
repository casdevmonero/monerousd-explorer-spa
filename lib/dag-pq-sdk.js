// lib/dag-pq-sdk.js — ESM vendor of monerousd-dag-pq-sdk (the ONE shared
// MonerousD live-testnet client SDK).
//
// SOURCE OF TRUTH: /Users/robertcombs1/Desktop/connect/monerousd-dag-pq-sdk/index.js
// That canonical package is CommonJS (`module.exports`); this explorer SPA is a
// browser ES-module bundle, so we vendor a *faithful* ESM port here (same DAG
// header field logic, same PQ REST endpoints, same hash-tuple settlement
// anchor). The logic is byte-for-byte equivalent — only the module wrapper
// (`export` vs `module.exports`) differs. Re-sync this file whenever the
// canonical SDK changes (selftest.js in that package is the proof harness).
//
// Verified against the LIVE testnet daemon http://127.0.0.1:28080 (2026-06-22):
//   - get_block decode_as_json exposes the GHOSTDAG mergeset under
//     `additional_parents` (NOT in block_header — only in the decoded `json`).
//   - PQ REST: /get_pq_notes /get_pq_balance /get_pq_nf_spent
//     /get_pq_output_tree (depth 32) /get_pq_epoch_address.
//
// Hard rules baked in (Four Pillars + decentralization + no-halts):
//  - PRIVATE: reads surface OPAQUE note blobs / commitment roots only. No
//    plaintext amounts, no stealth-address linkage on the data path.
//  - POST-QUANTUM: spend/transfer path is PQ (rec-block carrier,
//    DOMAIN_PQ_REC_BLOCK). NO curve-FCMP on the MonerousD data path.
//  - SOUND: settlement/ordering binds to the BLOCK HASH tuple, NEVER to
//    height-as-total-order (GHOSTDAG width > 1 ⇒ height is not a total order).
//  - FAST: thin client, zero deps, single round-trip per call.
//  - DECENTRALIZED: daemon URL is caller-supplied; FailoverDagPqClient rotates
//    across peers so no single operator is trusted. NEVER a mainnet
//    node.monerousd.org:17750 default for testnet.
//  - NO-HALTS: a failing read throws (fail-closed on that call) but never
//    wedges the caller; failover rotates to the next peer. No stubs, no
//    placeholder data, no silent downgrades EVER.

'use strict';

/* ── Constants — the testnet standard. NO stale mainnet constants. ───────── */

// Default LIVE testnet daemon. NOT node.monerousd.org:17750 (mainnet host —
// would chain-split a testnet client against a mainnet genesis).
export const DEFAULT_TESTNET_DAEMON = 'http://127.0.0.1:28080';
export const defaultTestnetDaemon = DEFAULT_TESTNET_DAEMON;

// Verified live testnet genesis (height 0). Apps can assert against this to
// detect a chain-split / wrong-network daemon before trusting it.
export const TESTNET_GENESIS_HASH =
  '0b0ed07e9d104df42a7355e48adc5e1531cf87d3b89f121076f782deeeb51711';

// PQ output-membership tree depth the live daemon reports (sparse frontier, #83).
export const PQ_OUTPUT_TREE_DEPTH = 32;

// Domain separator the wallet-rpc uses for the rec-block transfer carrier.
export const DOMAIN_PQ_REC_BLOCK = 'DOMAIN_PQ_REC_BLOCK';

/* ── isOnion — true if an origin/host is a Tor .onion service. ───────────── */
export function isOnion(origin) {
  if (!origin || typeof origin !== 'string') return false;
  let host = origin.trim();
  const schemeIdx = host.indexOf('://');
  if (schemeIdx !== -1) {
    try { host = new URL(host).hostname; }
    catch (_) { host = host.slice(schemeIdx + 3); }
  }
  host = host.split('/')[0].split('?')[0];
  if (host.startsWith('[')) return false;
  const colon = host.lastIndexOf(':');
  if (colon !== -1) host = host.slice(0, colon);
  host = host.toLowerCase();
  return host === 'onion' || host.endsWith('.onion');
}

/* ── Internal: a minimal, dependency-free JSON / REST poster. ────────────── */

function _ensureFetch(fetchImpl) {
  const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (typeof f !== 'function') {
    throw new Error(
      'monerousd-dag-pq-sdk: global fetch is unavailable. Use a browser, ' +
        'Node >= 18, or pass opts.fetch.'
    );
  }
  return f;
}

async function _postJson(fetchImpl, url, body, timeoutMs) {
  const controller =
    typeof AbortController === 'function' ? new AbortController() : null;
  let timer = null;
  if (controller && timeoutMs) {
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }
  let res;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller ? controller.signal : undefined,
    });
  } catch (e) {
    if (e && e.name === 'AbortError') {
      throw new Error(`request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw new Error(`request to ${url} failed: ${e && e.message ? e.message : e}`);
  } finally {
    if (timer) clearTimeout(timer);
  }
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}: ${text.slice(0, 256)}`);
  }
  let json;
  try { json = JSON.parse(text); }
  catch (_) { throw new Error(`non-JSON response from ${url}: ${text.slice(0, 256)}`); }
  return json;
}

/* ── DagPqClient — the shared client. ────────────────────────────────────── */

export class DagPqClient {
  /**
   * @param {string} daemonUrl e.g. http://127.0.0.1:28080
   * @param {string} [walletRpcUrl] e.g. http://127.0.0.1:28084
   * @param {object} [opts] { timeoutMs?, fetch? }
   */
  constructor(daemonUrl, walletRpcUrl, opts = {}) {
    if (!daemonUrl || typeof daemonUrl !== 'string') {
      throw new Error('DagPqClient: daemonUrl is required');
    }
    this.daemonUrl = daemonUrl.replace(/\/+$/, '');
    this.walletRpcUrl = walletRpcUrl ? walletRpcUrl.replace(/\/+$/, '') : null;
    this.timeoutMs = opts.timeoutMs || 12000;
    this._fetch = _ensureFetch(opts.fetch);
  }

  async _daemonRpc(method, params) {
    const body = { jsonrpc: '2.0', id: '0', method };
    if (params !== undefined) body.params = params;
    const json = await _postJson(this._fetch, `${this.daemonUrl}/json_rpc`, body, this.timeoutMs);
    if (json.error) {
      throw new Error(`daemon RPC ${method} error ${json.error.code}: ${json.error.message}`);
    }
    return json.result;
  }

  async _daemonRest(path, body) {
    const result = await _postJson(
      this._fetch, `${this.daemonUrl}/${path.replace(/^\/+/, '')}`, body || {}, this.timeoutMs
    );
    if (result && result.status && result.status !== 'OK') {
      throw new Error(`daemon ${path} returned status ${result.status}`);
    }
    return result;
  }

  async _walletRpc(method, params) {
    if (!this.walletRpcUrl) {
      throw new Error(
        `monerousd-dag-pq-sdk: walletRpcUrl not configured; ${method} needs a ` +
          'wallet-rpc (e.g. http://127.0.0.1:28084)'
      );
    }
    const body = { jsonrpc: '2.0', id: '0', method };
    if (params !== undefined) body.params = params;
    const json = await _postJson(this._fetch, `${this.walletRpcUrl}/json_rpc`, body, this.timeoutMs);
    if (json.error) {
      throw new Error(`wallet RPC ${method} error ${json.error.code}: ${json.error.message}`);
    }
    return json.result;
  }

  // ── daemon: chain / DAG ──────────────────────────────────────────────────

  /** Daemon get_info. Raw result (height, top_block_hash, nettype, …). */
  async getInfo() { return this._daemonRpc('get_info'); }

  /**
   * get_block by height (number) or hash (64-hex), decoded. EXPOSES THE REAL
   * MERGESET: the GHOSTDAG fields live in the decoded `json` blob —
   * `prev_id` (selected parent) + `additional_parents` (the rest of the
   * merged parents). block_header alone only carries the single selected
   * parent (`prev_hash`). We surface both.
   */
  async getBlock(heightOrHash) {
    const params = { decode_as_json: true };
    if (typeof heightOrHash === 'number') {
      params.height = heightOrHash;
    } else if (typeof heightOrHash === 'string' && /^[0-9a-fA-F]{64}$/.test(heightOrHash)) {
      params.hash = heightOrHash;
    } else if (typeof heightOrHash === 'string' && /^\d+$/.test(heightOrHash)) {
      params.height = Number(heightOrHash);
    } else {
      throw new Error(
        `getBlock: expected a height (number) or 64-hex hash, got ${JSON.stringify(heightOrHash)}`
      );
    }
    const result = await this._daemonRpc('get_block', params);
    return normalizeDagBlock(result);
  }

  /**
   * settlementAnchor(block) -> the BLOCK HASH TUPLE settlement/ordering binds
   * to. CARDINAL: NEVER a height. Under GHOSTDAG (width > 1) height is not a
   * total order, so any settlement anchoring references the block hash AND its
   * full parent set (mergeset-aware placement, not a bare collidable height).
   */
  settlementAnchor(block) {
    if (!block || typeof block !== 'object') {
      throw new Error('settlementAnchor: expected a block object from getBlock()');
    }
    let hash, prevHash, mergeset, height;
    if ('mergeset' in block || 'prevHashes' in block) {
      hash = block.hash;
      prevHash = block.prevHash;
      mergeset = Array.isArray(block.mergeset) ? block.mergeset.slice() : [];
      height = block.height;
    } else {
      const bh = block.block_header || {};
      let inner = {};
      if (block.json) { try { inner = JSON.parse(block.json); } catch (_) { inner = {}; } }
      hash = bh.hash || null;
      prevHash = bh.prev_hash || inner.prev_id || null;
      mergeset = Array.isArray(inner.additional_parents) ? inner.additional_parents.slice() : [];
      height = bh.height;
    }
    if (!hash) throw new Error('settlementAnchor: block has no hash — cannot anchor');
    const parents = prevHash ? [prevHash, ...mergeset] : mergeset.slice();
    return {
      hash,
      prevHash,
      parents,
      mergeset,
      height, // informational only; NOT a total order
      tuple: [hash, ...(prevHash ? [prevHash] : []), ...mergeset],
    };
  }

  // ── daemon: PQ (non-json_rpc REST) ───────────────────────────────────────

  /**
   * get_pq_notes from a starting height. Daemon REST.
   * Returns { notes:[{blob_hex, height}], status, top_height, untrusted }.
   * Amounts are confidential — only opaque note blobs are surfaced.
   */
  async getPqNotes(fromHeight = 0) {
    return this._daemonRest('get_pq_notes', { from_height: Number(fromHeight) || 0 });
  }

  /**
   * Node-visible PQ aggregate (the daemon /get_pq_balance is a node-side
   * aggregate that is empty on this build; we derive a node-visible note
   * count from /get_pq_notes so callers get real data). Wallet spendable
   * balance => getPqBalanceWallet().
   */
  async getPqBalance() {
    return this._daemonRest('get_pq_notes', {}).then((notes) => {
      const list = (notes && notes.notes) || [];
      return {
        node_visible_note_count: list.length,
        top_height: notes && notes.top_height,
        source: 'daemon:get_pq_notes',
      };
    });
  }

  /**
   * get_pq_nf_spent — check nullifier spent-status. Daemon REST.
   * @param {string[]} nfHexArr array of 64-hex nullifiers
   * Returns { status:"OK", untrusted } when served. Double-spend / no-inflation
   * gating is daemon-enforced; this is the public spent-set query.
   */
  async getPqNfSpent(nfHexArr) {
    if (!Array.isArray(nfHexArr)) {
      throw new Error('getPqNfSpent: expected an array of 64-hex nullifiers');
    }
    for (const nf of nfHexArr) {
      if (typeof nf !== 'string' || !/^[0-9a-fA-F]{64}$/.test(nf)) {
        throw new Error(`getPqNfSpent: invalid nullifier (need 64-hex): ${nf}`);
      }
    }
    return this._daemonRest('get_pq_nf_spent', { nullifiers: nfHexArr });
  }

  /**
   * get_pq_output_tree — the PQ output membership tree (sparse frontier).
   * Returns { count, depth, notes_hex, status, untrusted }. depth = 32 live.
   */
  async getPqOutputTree() { return this._daemonRest('get_pq_output_tree', {}); }

  /**
   * get_pq_epoch_address — current per-epoch PQ address + epoch_b binding.
   * Returns { epoch_address, epoch_b_hex, status, untrusted }.
   */
  async getPqEpochAddress() { return this._daemonRest('get_pq_epoch_address', {}); }

  // ── wallet-rpc ───────────────────────────────────────────────────────────

  /** Wallet PQ stealth address. wallet-rpc get_pq_address. */
  async getPqAddress() { return this._walletRpc('get_pq_address'); }

  /** Wallet-side authoritative spendable PQ balance. wallet-rpc get_pq_balance. */
  async getPqBalanceWallet() { return this._walletRpc('get_pq_balance'); }

  /**
   * Create a PQ transfer (rec-block carrier, DOMAIN_PQ_REC_BLOCK).
   * wallet-rpc pq_create_transfer — faithful pass-through (the SDK never
   * silently reshapes a transfer; soundness).
   */
  async createPqTransfer(params) {
    if (!params || typeof params !== 'object') {
      throw new Error(
        'createPqTransfer: expected a params object for wallet-rpc ' +
          'pq_create_transfer (rec-block carrier, DOMAIN_PQ_REC_BLOCK)'
      );
    }
    return this._walletRpc('pq_create_transfer', params);
  }

  /** Broadcast a raw tx hex via daemon /sendrawtransaction. */
  async sendRawTx(hex, opts = {}) {
    if (typeof hex !== 'string' || hex.length === 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
      throw new Error('sendRawTx: expected a non-empty hex tx blob');
    }
    const body = { tx_as_hex: hex, do_not_relay: !!opts.doNotRelay };
    return _postJson(this._fetch, `${this.daemonUrl}/sendrawtransaction`, body, this.timeoutMs);
  }
}

/**
 * normalizeDagBlock(rawGetBlockResult) -> normalized DAG header that exposes
 * the real mergeset. Exported so a caller that already has a raw get_block
 * result (e.g. via an existing failover RPC layer) can normalize without a
 * second round-trip. The raw result MUST have been requested with
 * decode_as_json:true so the `json` field (carrying additional_parents) is
 * present.
 */
export function normalizeDagBlock(result) {
  const r = result || {};
  const bh = r.block_header || {};
  let inner = {};
  if (r.json) { try { inner = JSON.parse(r.json); } catch (_) { inner = {}; } }
  // The REAL GHOSTDAG mergeset field name on MonerousD is `additional_parents`.
  const additionalParents = Array.isArray(inner.additional_parents)
    ? inner.additional_parents.slice() : [];
  const prevHash = bh.prev_hash || inner.prev_id || null;
  const prevHashes = prevHash ? [prevHash, ...additionalParents] : additionalParents.slice();
  return {
    hash: bh.hash || null,
    height: typeof bh.height === 'number' ? bh.height : inner.height,
    prevHash,
    prevHashes,
    mergeset: additionalParents.slice(),
    additionalParents,
    majorVersion: bh.major_version,
    minorVersion: bh.minor_version,
    timestamp: typeof bh.timestamp === 'number' ? bh.timestamp : inner.timestamp,
    nonce: typeof bh.nonce === 'number' ? bh.nonce : inner.nonce,
    difficulty: bh.difficulty,
    cumulativeDifficulty: bh.cumulative_difficulty,
    wideCumulativeDifficulty: bh.wide_cumulative_difficulty,
    depth: bh.depth,
    orphanStatus: bh.orphan_status,
    minerTxHash: bh.miner_tx_hash || r.miner_tx_hash,
    numTxes: bh.num_txes,
    reward: bh.reward,
    txHashes: r.tx_hashes || inner.tx_hashes || [],
    header: bh,
    json: inner,
    blob: r.blob,
  };
}

/* ── FailoverDagPqClient — decentralization: never hard-pin one operator. ─── */

export class FailoverDagPqClient {
  constructor(daemonUrls, walletRpcUrl, opts = {}) {
    const urls = Array.isArray(daemonUrls) ? daemonUrls.filter(Boolean) : [];
    if (urls.length === 0) urls.push(DEFAULT_TESTNET_DAEMON);
    this.clients = urls.map((u) => new DagPqClient(u, walletRpcUrl, opts));
    this._idx = 0;
  }

  async _withFailover(fn) {
    const n = this.clients.length;
    let lastErr;
    for (let i = 0; i < n; i++) {
      const c = this.clients[(this._idx + i) % n];
      try {
        const out = await fn(c);
        this._idx = (this._idx + i) % n; // stick to the one that worked
        return out;
      } catch (e) { lastErr = e; }
    }
    throw new Error(
      `FailoverDagPqClient: all ${n} daemon(s) failed; last error: ${
        lastErr && lastErr.message ? lastErr.message : lastErr
      }`
    );
  }

  getInfo() { return this._withFailover((c) => c.getInfo()); }
  getBlock(h) { return this._withFailover((c) => c.getBlock(h)); }
  getPqBalance() { return this._withFailover((c) => c.getPqBalance()); }
  getPqNotes(f) { return this._withFailover((c) => c.getPqNotes(f)); }
  getPqNfSpent(a) { return this._withFailover((c) => c.getPqNfSpent(a)); }
  getPqOutputTree() { return this._withFailover((c) => c.getPqOutputTree()); }
  getPqEpochAddress() { return this._withFailover((c) => c.getPqEpochAddress()); }
  sendRawTx(hex, o) { return this._withFailover((c) => c.sendRawTx(hex, o)); }

  settlementAnchor(block) { return this.clients[0].settlementAnchor(block); }
  getPqAddress() { return this.clients[0].getPqAddress(); }
  getPqBalanceWallet() { return this.clients[0].getPqBalanceWallet(); }
  createPqTransfer(p) { return this.clients[0].createPqTransfer(p); }
}
