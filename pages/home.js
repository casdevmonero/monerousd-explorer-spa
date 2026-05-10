// home.js — landing page: network info-grid + recent blocks table.
// Mirrors monerousd-explorer/views/index.ejs (the legacy server-rendered
// view) so users get the same dashboard they had before.
import { escapeHtml, formatDifficulty, formatHashrate, formatAmount, timeSince } from '../lib/helpers.js';

const BLOCKS_PER_PAGE = 20;

export async function renderHome({ ds, navigate, view }) {
  // Read page from hash query string (#/?page=N) — supports legacy
  // /?page=N bookmarks via the hash router.
  const hashQuery = (location.hash.split('?')[1] || '');
  const params = new URLSearchParams(hashQuery);
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);

  let info = null;
  let tip = 0;
  let errorMsg = null;

  try {
    info = await ds.callDaemon('get_info', {});
    tip = Number(info.height || 0);
  } catch (e) {
    errorMsg = 'Unable to fetch chain info: ' + (e && e.message || e);
  }

  // Pagination: page 1 = blocks (tip-1) .. (tip-N), etc.
  const top = Math.max(0, tip - 1 - (page - 1) * BLOCKS_PER_PAGE);
  let blocks = [];
  if (info && tip > 0) {
    blocks = await fetchBlockRange(ds, top, BLOCKS_PER_PAGE);
  }
  const totalPages = Math.max(1, Math.ceil(tip / BLOCKS_PER_PAGE));

  view.innerHTML = `
    ${errorMsg ? `
      <div class="error-box">
        <strong>Error:</strong> ${escapeHtml(errorMsg)}
        <p>Trying federated indexer + community RPCs. Set <code>localStorage.daemon_rpcs</code> to a working URL if your validator is offline.</p>
      </div>
    ` : ''}

    ${info ? `
    <section class="network-info">
      <h2>Network Status</h2>
      <div class="info-grid">
        <div class="info-card">
          <div class="info-label">Height</div>
          <div class="info-value">${info.height != null ? Number(info.height).toLocaleString() : 'N/A'}</div>
        </div>
        <div class="info-card">
          <div class="info-label">Difficulty</div>
          <div class="info-value">${formatDifficulty(info.difficulty)}</div>
        </div>
        <div class="info-card">
          <div class="info-label">Hashrate</div>
          <div class="info-value">${formatHashrate(info.difficulty / (info.target || 120))}</div>
        </div>
        <div class="info-card">
          <div class="info-label">TX Pool</div>
          <div class="info-value">${info.tx_pool_size != null ? info.tx_pool_size : 'N/A'}</div>
        </div>
        <div class="info-card">
          <div class="info-label">Network</div>
          <div class="info-value">${info.mainnet ? 'Mainnet' : info.testnet ? 'Testnet' : info.stagenet ? 'Stagenet' : '—'}</div>
        </div>
        <div class="info-card">
          <div class="info-label">Version</div>
          <div class="info-value">${escapeHtml(info.version || 'N/A')}</div>
        </div>
      </div>
    </section>
    ` : ''}

    <section class="recent-blocks">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <h2 style="margin:0;">Recent Blocks</h2>
        <div style="display:flex;gap:8px;align-items:center;">
          <span id="lastRefresh" style="font-size:11px;color:#888;"></span>
          <button id="btnRefresh" style="padding:6px 16px;border-radius:6px;border:1px solid #555;background:#232323;color:#eee;cursor:pointer;font-size:13px;"
                  onmouseover="this.style.background='#333'" onmouseout="this.style.background='#232323'">&#8635; Refresh</button>
        </div>
      </div>

      ${blocks.length === 0 && !errorMsg ? `
        <p class="muted">No blocks available.</p>
      ` : blocks.length > 0 ? `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Height</th>
              <th>Time</th>
              <th>TXs</th>
              <th>Reward</th>
              <th>Size</th>
              <th>Difficulty</th>
            </tr>
          </thead>
          <tbody>
            ${blocks.map(b => `
              <tr>
                <td><a href="#/block/${escapeHtml(String(b.height))}">${Number(b.height).toLocaleString()}</a></td>
                <td class="mono">${escapeHtml(timeSince(b.timestamp))}</td>
                <td>${b.num_txes != null ? b.num_txes : '?'}</td>
                <td>${formatAmount(b.reward)} USDm</td>
                <td>${b.block_size ? (b.block_size / 1024).toFixed(2) + ' KB' : '?'}</td>
                <td>${formatDifficulty(b.difficulty)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="nav-blocks" style="display:flex;justify-content:center;gap:12px;margin-top:16px;flex-wrap:wrap;align-items:center;">
        ${page > 1 ? `
          <a href="#/?page=1" style="padding:6px 14px;border-radius:6px;background:#232323;color:#3498db;text-decoration:none;border:1px solid #444;">Latest</a>
          <a href="#/?page=${page - 1}" style="padding:6px 14px;border-radius:6px;background:#232323;color:#3498db;text-decoration:none;border:1px solid #444;">Newer</a>
        ` : ''}
        <span style="color:#aaa;font-size:13px;">Page ${page} of ${totalPages}</span>
        ${page < totalPages ? `
          <a href="#/?page=${page + 1}" style="padding:6px 14px;border-radius:6px;background:#232323;color:#3498db;text-decoration:none;border:1px solid #444;">Older</a>
        ` : ''}
      </div>
      ` : ''}
    </section>
  `;

  const btn = document.getElementById('btnRefresh');
  const ts = document.getElementById('lastRefresh');
  if (ts) ts.textContent = 'Updated ' + new Date().toLocaleTimeString();
  if (btn) {
    btn.addEventListener('click', () => {
      btn.textContent = 'Refreshing…';
      btn.disabled = true;
      navigate('#/');
    });
  }
  if (page === 1) {
    setTimeout(() => {
      if (location.hash === '#/' || location.hash === '') navigate('#/');
    }, 60_000);
  }
}

async function fetchBlockRange(ds, top, count) {
  const heights = [];
  for (let h = top; h > top - count && h >= 0; h--) heights.push(h);
  const results = await Promise.all(heights.map(async (h) => {
    try {
      const r = await ds.getBlockByHeight(h);
      return r.block_header || r;
    } catch (_) { return null; }
  }));
  return results.filter(Boolean);
}
