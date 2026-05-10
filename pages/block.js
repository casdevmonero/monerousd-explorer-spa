// block.js — /block/<height-or-hash>
// Mirrors monerousd-explorer/views/block.ejs (legacy server-rendered view).
import { escapeHtml, formatAmount, formatDifficulty, timeSince, detectTxBadge, getTxTypeName, badgeHtml } from '../lib/helpers.js';

export async function renderBlock({ ds, view }, idOrHash) {
  let block;
  let errorMsg = null;
  let currentHeight = 0;

  try {
    if (/^\d+$/.test(idOrHash)) block = await ds.getBlockByHeight(idOrHash);
    else if (/^[0-9a-fA-F]{64}$/.test(idOrHash)) block = await ds.getBlockByHash(idOrHash);
    else throw new Error('not a valid block height or hash');
  } catch (e) {
    errorMsg = e && e.message || String(e);
  }

  try { currentHeight = await ds.getBlockCount(); } catch (_) { /* best effort */ }

  if (errorMsg) {
    view.innerHTML = `<div class="error-box"><strong>Error:</strong> ${escapeHtml(errorMsg)}</div>`;
    return;
  }

  const header = (block && (block.block_header || block)) || {};
  const txHashes = (block && block.tx_hashes) || [];
  const minerTxHash = header.miner_tx_hash || (block && block.miner_tx_hash) || null;

  // Fetch transactions for badge detection + asset display.
  let txs = [];
  if (txHashes.length > 0) {
    try {
      const r = await ds.getTransactions(txHashes);
      txs = (r && r.txs) || [];
    } catch (_) { txs = []; }
  }

  view.innerHTML = `
    <section>
      <h2>Block #${Number(header.height || 0).toLocaleString()}</h2>

      <div class="nav-blocks">
        ${header.height > 0 ? `<a href="#/block/${header.height - 1}">&larr; Previous</a>` : ''}
        <a href="#/block/${(Number(header.height) || 0) + 1}">Next &rarr;</a>
      </div>

      <div class="detail-table">
        <table>
          <tbody>
            <tr><td class="label">Hash</td><td class="mono break-all">${escapeHtml(header.hash || '—')}</td></tr>
            <tr><td class="label">Height</td><td>${Number(header.height || 0).toLocaleString()}</td></tr>
            <tr><td class="label">Timestamp</td><td>${header.timestamp ? new Date(header.timestamp * 1000).toUTCString() : 'N/A'} <span class="muted">(${escapeHtml(timeSince(header.timestamp))})</span></td></tr>
            <tr><td class="label">Confirmations</td><td>${Math.max(0, currentHeight - Number(header.height || 0))}</td></tr>
            <tr><td class="label">Size</td><td>${header.block_size ? (header.block_size / 1024).toFixed(2) + ' KB' : 'N/A'}</td></tr>
            <tr><td class="label">Transactions</td><td>${header.num_txes != null ? header.num_txes : txHashes.length}</td></tr>
            <tr><td class="label">Difficulty</td><td>${header.difficulty ? Number(header.difficulty).toLocaleString() : 'N/A'} <span class="muted">(${formatDifficulty(header.difficulty)})</span></td></tr>
            <tr><td class="label">Nonce</td><td class="mono">${escapeHtml(String(header.nonce ?? 'N/A'))}</td></tr>
            <tr><td class="label">Reward</td><td>${formatAmount(header.reward)} USDm</td></tr>
            ${header.prev_hash ? `<tr><td class="label">Previous Hash</td><td class="mono break-all"><a href="#/block/${escapeHtml(header.prev_hash)}">${escapeHtml(header.prev_hash)}</a></td></tr>` : ''}
            ${minerTxHash ? `<tr><td class="label">Miner TX</td><td class="mono break-all"><a href="#/tx/${escapeHtml(minerTxHash)}">${escapeHtml(minerTxHash)}</a></td></tr>` : ''}
          </tbody>
        </table>
      </div>
    </section>

    ${txHashes.length > 0 ? `
    <section>
      <h3>Transactions (${txHashes.length})</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Hash</th>
              <th>Type</th>
              <th>Asset</th>
              <th>Fee</th>
              <th>Size</th>
            </tr>
          </thead>
          <tbody>
            ${txHashes.map((h, i) => {
              const tx = txs[i] || {};
              const badge = detectTxBadge(tx);
              const typeName = getTxTypeName(tx);
              const typeCell = badge ? renderTypeBadge(badge, typeName) : `<span class="badge">${escapeHtml(typeName)}</span>`;
              const assetCell = badge && badge.asset ? badgeHtml(badge.asset) : '<span class="muted">USDm</span>';
              return `
                <tr>
                  <td class="mono"><a href="#/tx/${escapeHtml(h)}">${escapeHtml(h.slice(0, 16))}…</a></td>
                  <td>${typeCell}</td>
                  <td>${assetCell}</td>
                  <td>${formatAmount(tx.fee || 0)} USDm</td>
                  <td>${tx.size ? (tx.size / 1024).toFixed(2) + ' KB' : '?'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>
    ` : `
    <section>
      <h3>Transactions</h3>
      <p class="muted">No transactions in this block (coinbase only).</p>
    </section>
    `}
  `;
}

function renderTypeBadge(badge, typeName) {
  if (!badge) return `<span class="badge">${escapeHtml(typeName)}</span>`;
  if (badge.type === 'bridge-wrap')   return `<span class="badge badge-bridge">Bridge Wrap</span>`;
  if (badge.type === 'bridge-unwrap') return `<span class="badge badge-bridge">Bridge Unwrap</span>`;
  if (badge.type === 'conversion')    return `<span class="badge badge-conversion">${escapeHtml(badge.label || 'Convert')}</span>`;
  if (badge.type === 'asset-transfer')return `<span class="badge">${escapeHtml(badge.label || 'Transfer')}</span>`;
  return `<span class="badge">${escapeHtml(badge.label || typeName)}</span>`;
}
