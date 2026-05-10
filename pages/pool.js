// pool.js — /pool/<poolId>
// Renders LP pool detail (reserves, k-product, share supply).
import { escapeHtml, formatAmount } from '../lib/helpers.js';

export async function renderPool({ ds, view }, poolId) {
  let p = null;
  let errorMsg = null;

  try {
    p = await ds.getPool(poolId);
  } catch (e) {
    errorMsg = e && e.message || String(e);
  }

  if (!p) {
    view.innerHTML = `<div class="error-box"><strong>Error:</strong> ${escapeHtml(errorMsg || 'Pool not found')}</div>`;
    return;
  }

  const id        = p.id || p.poolId || poolId;
  const a0        = p.asset0 || p.symbol0 || '?';
  const a1        = p.asset1 || p.symbol1 || '?';
  const r0        = p.reserve0 || p.reserveA || 0;
  const r1        = p.reserve1 || p.reserveB || 0;
  const totalShares = p.total_shares || p.totalShares || '—';
  const kind      = p.kind || 'standard';

  view.innerHTML = `
    <section>
      <h2>Pool ${escapeHtml(a0)} / ${escapeHtml(a1)}</h2>

      <div class="detail-table">
        <table>
          <tbody>
            <tr><td class="label">Pool ID</td><td class="mono break-all">${escapeHtml(id)}</td></tr>
            <tr><td class="label">Asset 0</td><td><a href="#/token/${encodeURIComponent(a0)}" class="mono">${escapeHtml(a0)}</a></td></tr>
            <tr><td class="label">Asset 1</td><td><a href="#/token/${encodeURIComponent(a1)}" class="mono">${escapeHtml(a1)}</a></td></tr>
            <tr><td class="label">Reserve ${escapeHtml(a0)}</td><td class="mono">${escapeHtml(formatAmount(r0))}</td></tr>
            <tr><td class="label">Reserve ${escapeHtml(a1)}</td><td class="mono">${escapeHtml(formatAmount(r1))}</td></tr>
            <tr><td class="label">Total LP shares</td><td class="mono">${escapeHtml(String(totalShares))}</td></tr>
            <tr><td class="label">Kind</td><td><span class="badge">${escapeHtml(kind)}</span></td></tr>
          </tbody>
        </table>
      </div>
    </section>
  `;
}
