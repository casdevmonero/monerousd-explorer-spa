// pages/home.js — Phantom-style hero + live network stats +
// recent blocks + pager (Older/Newer).
//
// The hero stat tiles surface chain-derived facts only (height,
// difficulty, hashrate, pool tx count). No address-balance lookups
// — that would violate the privacy stance.
//
// "Older blocks" button bug fix (was broken in legacy explorer):
// the pager now has an explicit `data-older-top` attribute that
// stores the next page's top height, and an event handler bound
// every render (not relying on a one-shot global hashchange).

import { fmtUsd8, timeAgo } from '../lib/data-source.js';
import { VERIFIED_TOKENS, WRAPPED_ASSETS, VERIFIED_ORGS } from '../lib/registries.js';

const RECENT_BLOCK_PAGE_SIZE = 12;

function fmtH(n) {
  if (n == null || isNaN(n)) return '—';
  n = Number(n);
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GH/s';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + ' MH/s';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + ' KH/s';
  return n.toFixed(0) + ' H/s';
}
function fmtD(n) {
  if (n == null) return '—';
  n = Number(n);
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' G';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + ' M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + ' K';
  return n.toFixed(0);
}

function heroHTML(info) {
  const height = Number(info?.height || 0);
  const diff   = info?.difficulty;
  const hash   = info?.hashrate || (diff ? Number(diff) / 120 : null);
  const pool   = Number(info?.tx_pool_size || 0);
  const net    = info?.testnet ? 'Testnet' : (info?.stagenet ? 'Stagenet' : 'Mainnet');
  const ver    = info?.version ? ('v' + info.version) : '—';
  return `
    <header class="hero" aria-labelledby="hero-heading">
      <span class="hero-eyebrow">MoneroUSD chain · privacy-first</span>
      <h1 id="hero-heading">Sovereign block explorer</h1>
      <p>Searches tokens, NFTs, wrapped assets, dark contracts, organizations and sovereign sites
         — all chain-anchored, no operator can lie about state. Address-level activity stays
         <a href="#/privacy">concealed by design</a>.</p>
      <div class="hero-stats">
        <div class="hero-stat">
          <div class="hero-stat-label">Block height</div>
          <div class="hero-stat-value">${height.toLocaleString('en-US')}</div>
          <div class="hero-stat-sub">${net}</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">Difficulty</div>
          <div class="hero-stat-value">${fmtD(diff)}</div>
          <div class="hero-stat-sub">LWMA target 120 s</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">Hashrate</div>
          <div class="hero-stat-value">${fmtH(hash)}</div>
          <div class="hero-stat-sub">network estimate</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">Mempool</div>
          <div class="hero-stat-value">${pool}</div>
          <div class="hero-stat-sub">pending txs</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">Daemon</div>
          <div class="hero-stat-value" style="font-size:1rem">${ver}</div>
          <div class="hero-stat-sub">USDmd</div>
        </div>
      </div>
    </header>
  `;
}

function quickRowsHTML() {
  const tokens   = VERIFIED_TOKENS.length;
  const wrapped  = WRAPPED_ASSETS.length;
  const orgs     = VERIFIED_ORGS.length;
  return `
    <section class="card interactive">
      <div class="card-header">
        <h2>Browse on-chain entities</h2>
      </div>
      <div class="entity-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))">
        <a class="entity-card" href="#/tokens">
          <div class="entity-head">
            <div class="entity-logo">T</div>
            <div><div class="entity-title">Tokens</div><div class="entity-sub">${tokens + ' verified'}</div></div>
          </div>
          <p class="entity-body">USDm and protocol-issued assets — auto-curated registry plus the live indexer feed.</p>
        </a>
        <a class="entity-card" href="#/wrapped">
          <div class="entity-head">
            <div class="entity-logo">W</div>
            <div><div class="entity-title">Wrapped assets</div><div class="entity-sub">${wrapped + ' bridged'}</div></div>
          </div>
          <p class="entity-body">FROST-custodied wrappers for BTC, XMR, ETH, LTC, DOGE, SOL, ADA, BCH, ZEC, BNB + PSM stables.</p>
        </a>
        <a class="entity-card" href="#/nfts">
          <div class="entity-head">
            <div class="entity-logo">N</div>
            <div><div class="entity-title">NFT collections</div><div class="entity-sub">browse</div></div>
          </div>
          <p class="entity-body">Privacy-preserving NFTs minted on chain — collection metadata, mint events, transfers.</p>
        </a>
        <a class="entity-card" href="#/contracts">
          <div class="entity-head">
            <div class="entity-logo">C</div>
            <div><div class="entity-title">Dark Contracts</div><div class="entity-sub">DSOL bytecode</div></div>
          </div>
          <p class="entity-body">All DC_DEPLOY contracts — codeHash, ABI, recent calls. Bytecode is public; argv encrypted.</p>
        </a>
        <a class="entity-card" href="#/orgs">
          <div class="entity-head">
            <div class="entity-logo">O</div>
            <div><div class="entity-title">Organizations</div><div class="entity-sub">${orgs + ' verified'}</div></div>
          </div>
          <p class="entity-body">Verified organizations and their full footprint: tokens, contracts, sites, contributions.</p>
        </a>
        <a class="entity-card" href="#/sites">
          <div class="entity-head">
            <div class="entity-logo">S</div>
            <div><div class="entity-title">Sovereign sites</div><div class="entity-sub">SITE_PUBLISH</div></div>
          </div>
          <p class="entity-body">Chain-anchored static sites — every publish strengthens the reserve.</p>
        </a>
        <a class="entity-card" href="#/validators">
          <div class="entity-head">
            <div class="entity-logo">V</div>
            <div><div class="entity-title">Validators</div><div class="entity-sub">bonded set</div></div>
          </div>
          <p class="entity-body">Bonded validators backing the FROST bridge — bond size, slash log, signal record.</p>
        </a>
        <a class="entity-card" href="#/privacy">
          <div class="entity-head">
            <div class="entity-logo">P</div>
            <div><div class="entity-title">Privacy primer</div><div class="entity-sub">what's concealed?</div></div>
          </div>
          <p class="entity-body">Side-by-side: what's CONCEALED on MoneroUSD vs what's PUBLIC. Built for trust.</p>
        </a>
      </div>
    </section>
  `;
}

function blocksTableHTML(blocks) {
  if (!blocks.length) return '<div class="empty">No blocks loaded yet.</div>';
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Height</th>
            <th>Time</th>
            <th class="num">Txs</th>
            <th>Reward</th>
            <th class="num">Size</th>
            <th class="num">Difficulty</th>
          </tr>
        </thead>
        <tbody>
          ${blocks.map(b => {
            const h     = b.block_header || b;
            const height = Number(h.height ?? 0);
            const ts    = Number(h.timestamp || 0);
            const size  = Number(h.block_size || h.block_weight || 0);
            const diff  = Number(h.difficulty || 0);
            const reward = h.reward != null ? fmtUsd8(h.reward) : '—';
            const numTx = Number(h.num_txes || (Array.isArray(h.tx_hashes) ? h.tx_hashes.length : 0));
            return `<tr>
              <td><a href="#/block/${encodeURIComponent(height)}">${height.toLocaleString('en-US')}</a></td>
              <td>${timeAgo(ts)}</td>
              <td class="num">${numTx}</td>
              <td>${reward} <span style="color:var(--text-muted);font-size:11px">USDm</span></td>
              <td class="num">${(size / 1024).toFixed(2)} KB</td>
              <td class="num">${fmtD(diff)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function pagerHTML(currentTop, tip) {
  const tipTop       = Math.max(0, tip - 1);
  const newerDisabled = currentTop >= tipTop;
  const older        = currentTop - RECENT_BLOCK_PAGE_SIZE;
  const olderDisabled = older < 0;
  const newerTop     = Math.min(tipTop, currentTop + RECENT_BLOCK_PAGE_SIZE);
  const bottom = Math.max(0, currentTop - RECENT_BLOCK_PAGE_SIZE + 1);
  return `
    <div class="pager">
      <button class="btn btn-ghost btn-sm" id="newer-btn"
              data-newer-top="${newerTop}" ${newerDisabled ? 'disabled' : ''}>
        ← Newer
      </button>
      <span class="pager-info">Blocks ${bottom.toLocaleString('en-US')} – ${currentTop.toLocaleString('en-US')}</span>
      <button class="btn btn-primary btn-sm" id="older-btn"
              data-older-top="${older}" ${olderDisabled ? 'disabled' : ''}>
        Older →
      </button>
    </div>
  `;
}

export async function renderHome(ctx) {
  const { ds, view } = ctx;

  // Phase 1 — paint hero + recent-blocks + recent-txs skeletons.
  // "Browse on-chain entities" tile row removed per user request —
  // discovery happens via the header search dropdown + nav.
  view.innerHTML = heroHTML({}) + `
    <section class="card">
      <div class="card-header">
        <h2>Recent blocks</h2>
        <div class="card-action" id="blocks-action">Loading…</div>
      </div>
      <div id="blocks-body"><div class="loading">Loading recent blocks…</div></div>
    </section>
    <section class="card">
      <div class="card-header">
        <h2>Recent transactions</h2>
        <div class="card-action" id="txs-action">Loading…</div>
      </div>
      <div id="txs-body"><div class="loading">Loading recent transactions…</div></div>
    </section>
  `;

  // Phase 2 — fetch get_info + paint real hero.
  let info = {};
  try { info = await ds.callDaemon('get_info'); } catch (_) {}
  const heroNode = view.querySelector('.hero');
  if (heroNode) heroNode.outerHTML = heroHTML(info);

  const tip = Number(info?.height || 0);
  const initialTop = Math.max(0, tip - 1);

  // Phase 3 — fetch the visible-window blocks (table).
  const blocks = await fetchRecentBlocks(ds, initialTop, RECENT_BLOCK_PAGE_SIZE);
  paintBlocks(ctx, blocks, initialTop, tip);

  // Phase 4 — populate Recent transactions. Start with the visible
  // window; if it's all coinbase, walk further back so the section
  // shows real activity instead of "no txs in last N blocks".
  paintRecentTxs(ctx, blocks, initialTop, tip);
}

// Fetches N recent blocks starting at `top` (descending).
// Returns whatever it got — partial windows are ok.
async function fetchRecentBlocks(ds, top, count) {
  const out = [];
  for (let h = top; h > top - count && h >= 0; h--) {
    try {
      const b = await ds.getBlockByHeight(h);
      out.push(b);
    } catch (_) { break; }
  }
  return out;
}

// Paints the blocks-table + pager into #blocks-body, then wires
// Older/Newer click handlers (re-bound on every render so the
// pager keeps working after every page advance — this was the
// "Older blocks button broken" bug in the legacy explorer).
function paintBlocks(ctx, blocks, top, tip) {
  const { ds, view } = ctx;
  const blocksBody = view.querySelector('#blocks-body');
  const action     = view.querySelector('#blocks-action');
  if (action) action.textContent = `Updated ${new Date().toLocaleTimeString()}`;
  if (!blocksBody) return;
  blocksBody.innerHTML = blocksTableHTML(blocks) + pagerHTML(top, tip);

  const older = blocksBody.querySelector('#older-btn');
  const newer = blocksBody.querySelector('#newer-btn');
  if (older && !older.disabled) {
    older.addEventListener('click', async () => {
      const next = Number(older.dataset.olderTop);
      if (!Number.isFinite(next) || next < 0) return;
      blocksBody.innerHTML = '<div class="loading">Loading…</div>';
      const win = await fetchRecentBlocks(ds, next, RECENT_BLOCK_PAGE_SIZE);
      paintBlocks(ctx, win, next, tip);
    });
  }
  if (newer && !newer.disabled) {
    newer.addEventListener('click', async () => {
      const next = Number(newer.dataset.newerTop);
      if (!Number.isFinite(next)) return;
      blocksBody.innerHTML = '<div class="loading">Loading…</div>';
      const win = await fetchRecentBlocks(ds, next, RECENT_BLOCK_PAGE_SIZE);
      paintBlocks(ctx, win, next, tip);
    });
  }
}

// Recent transactions card — pulls the tx-hash list out of recent
// blocks (visible window first, then walks deeper if the visible
// window is all coinbase). Fetches up to RECENT_TX_LIMIT bodies in
// a single batched call. FCMP++ vs RingCT badge per row; each hash
// deep-links to /tx.
const RECENT_TX_LIMIT = 16;
const RECENT_TX_DEEP_LOOKBACK = 200;  // hard cap on how far we'll
                                       // walk back if blocks are sparse.

async function paintRecentTxs(ctx, visibleBlocks, visibleTop, tip) {
  const { ds, view } = ctx;
  const body = view.querySelector('#txs-body');
  const action = view.querySelector('#txs-action');
  if (!body) return;

  // First pass — use the visible window.
  const items = collectTxHashes(visibleBlocks, RECENT_TX_LIMIT);

  // If the visible window is all coinbase, walk further back so the
  // user always sees real activity (the chain is sparse early in life).
  if (!items.length && visibleTop > 0) {
    const deepStart = visibleTop - visibleBlocks.length;
    const blocksToScan = Math.min(RECENT_TX_DEEP_LOOKBACK, deepStart + 1);
    if (blocksToScan > 0) {
      body.innerHTML = `<div class="loading">Searching the last ${blocksToScan} blocks for user transactions…</div>`;
      const deepBlocks = await fetchRecentBlocks(ds, deepStart, blocksToScan);
      items.push(...collectTxHashes(deepBlocks, RECENT_TX_LIMIT));
    }
  }

  if (!items.length) {
    if (action) action.textContent = 'no tx activity found';
    body.innerHTML = `
      <div class="empty">
        No user transactions found in the last
        ${Math.min(RECENT_TX_DEEP_LOOKBACK, visibleTop + 1).toLocaleString('en-US')} blocks (coinbase only).
        <div class="hint">When wallets transact, their txs land here. Mempool activity surfaces in <a href="#/mempool">/mempool</a> (coming).</div>
      </div>
    `;
    return;
  }

  // Batch fetch tx bodies — one RPC call for the whole list.
  let txs = [];
  try {
    const r = await ds.getTransactions(items.map(i => i.hash));
    txs = r?.txs || [];
  } catch (_) { txs = []; }

  if (action) action.textContent = `${items.length} most recent`;
  body.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Hash</th>
            <th class="num">Block</th>
            <th>Age</th>
            <th class="num">Fee</th>
            <th class="num">Size</th>
            <th>Privacy</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it, i) => {
            const tx = txs[i] || {};
            const j = tx.as_json ? safeJson(tx.as_json) : tx;
            const ty = j?.rct_signatures?.type;
            const rsp = j?.rctsig_prunable || tx?.rctsig_prunable;
            const isFcmp = (ty === 7 || ty === 8 || ty === 11)
                        || (rsp && (rsp.fcmp_proof || rsp.fcmp_tree_root || rsp.fcmp_layers));
            const feeAtomic = j?.rct_signatures?.txnFee ?? tx.fee ?? 0;
            return `
              <tr>
                <td class="mono"><a href="#/tx/${encodeURIComponent(it.hash)}">${it.hash.slice(0, 16)}…</a></td>
                <td class="num"><a href="#/block/${encodeURIComponent(it.block_height)}">${it.block_height.toLocaleString('en-US')}</a></td>
                <td>${timeAgo(it.block_timestamp)}</td>
                <td class="num">${fmtUsd8(feeAtomic)} <span style="color:var(--text-muted);font-size:11px">USDm</span></td>
                <td class="num">${tx.size ? (tx.size / 1024).toFixed(2) + ' KB' : '—'}</td>
                <td>${isFcmp ? '<span class="badge badge-verified">FCMP++</span>' : '<span class="badge badge-muted">RingCT</span>'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function safeJson(s) { try { return JSON.parse(s); } catch (_) { return {}; } }

// Walks a block list (newest first) and returns up to `limit`
// { hash, block_height, block_timestamp } tuples. Stops as soon
// as the limit is hit so we don't process the whole window when
// the first block already covers it.
function collectTxHashes(blocks, limit) {
  const out = [];
  for (const b of blocks) {
    const h = b?.block_header || b;
    const hashes = b?.tx_hashes || [];
    for (const tx of hashes) {
      out.push({
        hash: tx,
        block_height: Number(h.height || 0),
        block_timestamp: Number(h.timestamp || 0),
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
}
