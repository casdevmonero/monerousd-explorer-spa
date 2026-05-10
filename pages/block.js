// block.js — /block/<height-or-hash>
import { escapeHtml } from '../app.js';

export async function renderBlock({ ds, view }, idOrHash) {
  view.innerHTML = `<h1>Block</h1><div class="section" id="block-body">Loading…</div>`;
  const el = document.getElementById('block-body');

  try {
    // Numeric → height; hex64 → hash. Anything else fails fast.
    let block;
    if (/^\d+$/.test(idOrHash)) block = await ds.getBlockByHeight(idOrHash);
    else if (/^[0-9a-fA-F]{64}$/.test(idOrHash)) block = await ds.getBlockByHash(idOrHash);
    else throw new Error('not a valid block height or hash');

    const hdr = (block && (block.block_header || block)) || {};
    const txHashes = (block && block.tx_hashes) || [];
    el.innerHTML = `
      <div class="kv">
        <div class="k">Height</div>
        <div class="v mono">${escapeHtml(String(hdr.height ?? '—'))}</div>
        <div class="k">Hash</div>
        <div class="v mono">${escapeHtml(hdr.hash || '—')}</div>
        <div class="k">Time</div>
        <div class="v">${escapeHtml(ds.timeAgo(hdr.timestamp))} (${escapeHtml(String(hdr.timestamp ?? '—'))})</div>
        <div class="k">Difficulty</div>
        <div class="v mono">${escapeHtml(String(hdr.difficulty ?? '—'))}</div>
        <div class="k">Nonce</div>
        <div class="v mono">${escapeHtml(String(hdr.nonce ?? '—'))}</div>
        <div class="k">Reward</div>
        <div class="v mono">${escapeHtml(ds.fmtUsd8(hdr.reward))}</div>
        <div class="k">Tx count</div>
        <div class="v mono">${escapeHtml(String(txHashes.length || hdr.num_txes || 0))}</div>
        <div class="k">Previous</div>
        <div class="v mono"><a href="#/block/${escapeHtml(hdr.prev_hash || '')}">${escapeHtml(ds.shortHash(hdr.prev_hash || '—'))}</a></div>
        ${hdr.miner_tx_hash ? `<div class="k">Miner tx</div><div class="v mono"><a href="#/tx/${escapeHtml(hdr.miner_tx_hash)}">${escapeHtml(ds.shortHash(hdr.miner_tx_hash))}</a></div>` : ''}
      </div>

      <h2>Transactions</h2>
      ${txHashes.length === 0 ?
        '<div class="empty">No non-coinbase transactions in this block.</div>' :
        '<table><thead><tr><th>Tx hash</th></tr></thead><tbody>' +
        txHashes.map(h =>
          `<tr><td class="mono"><a href="#/tx/${escapeHtml(h)}">${escapeHtml(h)}</a></td></tr>`
        ).join('') +
        '</tbody></table>'
      }
    `;
  } catch (e) {
    el.innerHTML = `<div class="error">${escapeHtml(e.message)}</div>`;
  }
}
