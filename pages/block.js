// pages/block.js — Block detail page (Phantom-style hero +
// glass-card overview + transaction table with FCMP++ badge).
//
// Pagination — Prev/Next block buttons:
//   • Prev disabled at height 0.
//   • Next disabled at chain tip (currentHeight - 1).
//
// The TX list deep-links to /tx/<hash> where FCMP++ proofs land.

import { escapeHtml, formatAmount, formatDifficulty, timeSince, detectTxBadge, getTxTypeName, badgeHtml } from '../lib/helpers.js';

export async function renderBlock({ ds, view }, idOrHash) {
  let block;
  let errorMsg = null;
  let currentHeight = 0;

  try {
    if (/^\d+$/.test(idOrHash)) block = await ds.getBlockByHeight(idOrHash);
    else if (/^[0-9a-fA-F]{64}$/.test(idOrHash)) block = await ds.getBlockByHash(idOrHash);
    else throw new Error('Not a valid block height or hash.');
  } catch (e) {
    errorMsg = e?.message || String(e);
  }

  try { currentHeight = await ds.getBlockCount(); } catch (_) {}

  if (errorMsg) {
    view.innerHTML = `<div class="error-box"><strong>Error</strong><p>${escapeHtml(errorMsg)}</p></div>`;
    return;
  }

  const header  = (block && (block.block_header || block)) || {};
  const txHashes = (block && block.tx_hashes) || [];
  const minerTxHash = header.miner_tx_hash || block?.miner_tx_hash || null;
  const height = Number(header.height || 0);
  const tip    = currentHeight ? currentHeight - 1 : null;
  const confirmations = tip != null ? Math.max(0, tip + 1 - height) : null;

  // Batch-fetch tx bodies so we can show fee / size / FCMP++ badge.
  let txs = [];
  if (txHashes.length > 0) {
    try {
      const r = await ds.getTransactions(txHashes);
      txs = r?.txs || [];
    } catch (_) {}
  }

  // Detect if ANY tx in the block is FCMP++ — for the hero badge.
  // Mirrors the broader detection in pages/tx.js: USDmd uses RCT type 11
  // (Seraphis-tagged FCMP++) and also exposes `fcmp_*` keys under
  // `rctsig_prunable`. Either signal is sufficient.
  const anyFcmp = txs.some(t => {
    try {
      const j = t.as_json ? JSON.parse(t.as_json) : t;
      const ty = j?.rct_signatures?.type;
      if (ty === 7 || ty === 8 || ty === 11) return true;
      const rsp = j?.rctsig_prunable || t?.rctsig_prunable;
      if (rsp && (rsp.fcmp_proof || rsp.fcmp_tree_root || rsp.fcmp_layers)) return true;
      return false;
    } catch (_) { return false; }
  });

  const prev = height > 0;
  const next = tip != null && height < tip;

  view.innerHTML = `
    <header class="hero" style="padding:26px 30px">
      <span class="hero-eyebrow">Block</span>
      <h1 style="font-size:1.6rem">#${height.toLocaleString('en-US')}
        ${anyFcmp ? '<span class="badge badge-verified" style="vertical-align:middle;margin-left:8px">FCMP++</span>' : ''}
      </h1>
      <p style="margin-top:6px;color:var(--text-secondary)">
        ${header.timestamp ? new Date(header.timestamp * 1000).toUTCString() : '—'}
        <span style="color:var(--text-muted)">(${escapeHtml(timeSince(header.timestamp))})</span>
        ${confirmations != null ? ` · <strong>${confirmations.toLocaleString('en-US')}</strong> confirmation${confirmations === 1 ? '' : 's'}` : ''}
      </p>
      <div class="hero-stats">
        <div class="hero-stat">
          <div class="hero-stat-label">Txs</div>
          <div class="hero-stat-value">${header.num_txes ?? txHashes.length}</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">Reward</div>
          <div class="hero-stat-value">${escapeHtml(formatAmount(header.reward))} <span style="font-size:11px;color:var(--text-muted)">USDm</span></div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">Size</div>
          <div class="hero-stat-value" style="font-size:1.05rem">${header.block_size ? (header.block_size / 1024).toFixed(2) + ' KB' : '—'}</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">Difficulty</div>
          <div class="hero-stat-value" style="font-size:1rem">${escapeHtml(formatDifficulty(header.difficulty))}</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">Nonce</div>
          <div class="hero-stat-value" style="font-size:1rem;font-family:var(--font-mono)">${escapeHtml(String(header.nonce ?? '—'))}</div>
        </div>
      </div>
      <div class="pager" style="margin-top:18px;justify-content:flex-start">
        <button class="btn btn-ghost btn-sm" data-prev-block="${prev ? height - 1 : ''}" ${prev ? '' : 'disabled'}>← Block #${prev ? (height - 1).toLocaleString('en-US') : ''}</button>
        <button class="btn btn-ghost btn-sm" data-next-block="${next ? height + 1 : ''}" ${next ? '' : 'disabled'}>Block #${next ? (height + 1).toLocaleString('en-US') : ''} →</button>
      </div>
    </header>

    <section class="card">
      <div class="card-header"><h2>Header</h2></div>
      <dl class="kv-table">
        <dt>Hash</dt>         <dd class="mono">${escapeHtml(header.hash || '—')}</dd>
        <dt>Height</dt>       <dd>${height.toLocaleString('en-US')}</dd>
        <dt>Timestamp</dt>    <dd>${header.timestamp ? new Date(header.timestamp * 1000).toUTCString() : '—'} <span style="color:var(--text-muted)">(${escapeHtml(timeSince(header.timestamp))})</span></dd>
        <dt>Confirmations</dt><dd>${confirmations != null ? confirmations.toLocaleString('en-US') : '—'}</dd>
        <dt>Tx count</dt>     <dd>${header.num_txes ?? txHashes.length}</dd>
        <dt>Size</dt>         <dd>${header.block_size ? (header.block_size / 1024).toFixed(2) + ' KB' : '—'}</dd>
        <dt>Difficulty</dt>   <dd>${header.difficulty ? Number(header.difficulty).toLocaleString('en-US') : '—'} <span style="color:var(--text-muted)">(${escapeHtml(formatDifficulty(header.difficulty))})</span></dd>
        <dt>Cumulative</dt>   <dd>${header.cumulative_difficulty ? Number(header.cumulative_difficulty).toLocaleString('en-US') : '—'}</dd>
        <dt>Nonce</dt>        <dd class="mono">${escapeHtml(String(header.nonce ?? '—'))}</dd>
        <dt>Reward</dt>       <dd>${escapeHtml(formatAmount(header.reward))} USDm</dd>
        <dt>PoW hash</dt>     <dd class="mono">${escapeHtml(header.pow_hash || '—')}</dd>
        ${header.prev_hash ? `<dt>Previous</dt><dd class="mono"><a href="#/block/${escapeHtml(header.prev_hash)}">${escapeHtml(header.prev_hash)}</a></dd>` : ''}
        ${minerTxHash ? `<dt>Miner tx</dt><dd class="mono"><a href="#/tx/${escapeHtml(minerTxHash)}">${escapeHtml(minerTxHash)}</a></dd>` : ''}
      </dl>
    </section>

    ${txHashes.length > 0 ? `
    <section class="card">
      <div class="card-header">
        <h2>Transactions</h2>
        <div class="card-action">${txHashes.length} in block</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Hash</th>
              <th>Type</th>
              <th>Asset</th>
              <th class="num">Fee</th>
              <th class="num">Size</th>
              <th>Privacy</th>
            </tr>
          </thead>
          <tbody>
            ${txHashes.map((h, i) => {
              const tx = txs[i] || {};
              const j = tx.as_json ? safeJson(tx.as_json) : tx;
              const ty = j?.rct_signatures?.type;
              const rsp = j?.rctsig_prunable || tx?.rctsig_prunable;
              const isFcmp = (ty === 7 || ty === 8 || ty === 11)
                          || (rsp && (rsp.fcmp_proof || rsp.fcmp_tree_root || rsp.fcmp_layers));
              const badge = detectTxBadge(tx);
              const typeName = getTxTypeName(tx);
              const typeCell = badge ? renderTypeBadge(badge, typeName) : `<span class="badge badge-muted">${escapeHtml(typeName)}</span>`;
              const assetCell = badge && badge.asset ? badgeHtml(badge.asset) : '<span style="color:var(--text-muted)">USDm</span>';
              const feeAtomic = j?.rct_signatures?.txnFee ?? tx.fee ?? 0;
              return `
                <tr>
                  <td class="mono"><a href="#/tx/${escapeHtml(h)}">${escapeHtml(h.slice(0, 16))}…</a></td>
                  <td>${typeCell}</td>
                  <td>${assetCell}</td>
                  <td class="num">${escapeHtml(formatAmount(feeAtomic))} USDm</td>
                  <td class="num">${tx.size ? (tx.size / 1024).toFixed(2) + ' KB' : '—'}</td>
                  <td>${isFcmp ? '<span class="badge badge-verified">FCMP++</span>' : '<span class="badge badge-muted">RingCT</span>'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>` : `
    <section class="card">
      <div class="card-header"><h2>Transactions</h2></div>
      <p class="muted" style="margin:0">No user transactions in this block (coinbase only).</p>
    </section>`}
  `;

  // Wire pager buttons — re-bound on every render so navigation
  // works after every Prev/Next.
  const prevBtn = view.querySelector('[data-prev-block]');
  const nextBtn = view.querySelector('[data-next-block]');
  if (prevBtn && !prevBtn.disabled) {
    prevBtn.addEventListener('click', () => {
      const t = prevBtn.dataset.prevBlock;
      if (t) location.hash = '#/block/' + t;
    });
  }
  if (nextBtn && !nextBtn.disabled) {
    nextBtn.addEventListener('click', () => {
      const t = nextBtn.dataset.nextBlock;
      if (t) location.hash = '#/block/' + t;
    });
  }
}

function safeJson(s) { try { return JSON.parse(s); } catch (_) { return {}; } }

function renderTypeBadge(badge, typeName) {
  if (!badge) return `<span class="badge badge-muted">${escapeHtml(typeName)}</span>`;
  if (badge.type === 'bridge-wrap')    return `<span class="badge badge-info">Bridge Wrap</span>`;
  if (badge.type === 'bridge-unwrap')  return `<span class="badge badge-info">Bridge Unwrap</span>`;
  if (badge.type === 'conversion')     return `<span class="badge badge-warning">${escapeHtml(badge.label || 'Convert')}</span>`;
  if (badge.type === 'asset-transfer') return `<span class="badge badge-verified">${escapeHtml(badge.label || 'Transfer')}</span>`;
  return `<span class="badge badge-muted">${escapeHtml(badge.label || typeName)}</span>`;
}
