// home.js — landing page: latest N blocks + chain summary.
import { escapeHtml } from '../app.js';

const N_BLOCKS = 12;

export async function renderHome({ ds, navigate, view }) {
  view.innerHTML = `
    <h1>MoneroUSD chain</h1>
    <div class="section" id="summary">Loading chain summary…</div>
    <h2>Latest blocks</h2>
    <div class="section" id="blocks">Loading latest blocks…</div>
  `;

  const summaryEl = document.getElementById('summary');
  const blocksEl = document.getElementById('blocks');

  try {
    const tip = await ds.getBlockCount();
    summaryEl.innerHTML = `
      <div class="kv">
        <div class="k">Block height</div>
        <div class="v mono">${escapeHtml(String(tip))}</div>
        <div class="k">Network</div>
        <div class="v">USDm mainnet</div>
      </div>
    `;
  } catch (e) {
    summaryEl.innerHTML =
      `<div class="error">Cannot reach any daemon RPC.<br>${escapeHtml(e.message)}</div>`;
    return;
  }

  try {
    const blocks = await ds.getRecentBlocks(N_BLOCKS);
    if (!blocks.length) {
      blocksEl.innerHTML = '<div class="empty">No blocks returned.</div>';
      return;
    }
    blocksEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Height</th>
            <th>Time</th>
            <th class="right">Txs</th>
            <th>Hash</th>
          </tr>
        </thead>
        <tbody>
        ${blocks.map(b => {
          const hdr = (b && (b.block_header || b)) || {};
          const height = hdr.height ?? '—';
          const ts = hdr.timestamp ?? null;
          const txCount = (hdr.num_txes ?? hdr.txCount ?? 0);
          const hash = hdr.hash || '—';
          return `
            <tr>
              <td><a href="#/block/${escapeHtml(String(height))}" class="mono">${escapeHtml(String(height))}</a></td>
              <td class="muted">${escapeHtml(ds.timeAgo(ts))}</td>
              <td class="right mono">${escapeHtml(String(txCount))}</td>
              <td><a href="#/block/${escapeHtml(hash)}" class="mono">${escapeHtml(ds.shortHash(hash))}</a></td>
            </tr>`;
        }).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    blocksEl.innerHTML =
      `<div class="error">Cannot fetch recent blocks.<br>${escapeHtml(e.message)}</div>`;
  }
}
