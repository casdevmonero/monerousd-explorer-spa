// pool.js — /pool/<poolId>
import { escapeHtml } from '../app.js';

export async function renderPool({ ds, view }, poolId) {
  view.innerHTML = `<h1>Pool</h1><div class="section" id="pool-body">Loading…</div>`;
  const el = document.getElementById('pool-body');
  try {
    const p = await ds.getPool(poolId);
    el.innerHTML = `
      <div class="kv">
        <div class="k">Pool ID</div>
        <div class="v mono">${escapeHtml(p.id ?? p.poolId ?? '—')}</div>
        <div class="k">Asset 0</div>
        <div class="v mono">${escapeHtml(p.asset0 ?? '—')}</div>
        <div class="k">Asset 1</div>
        <div class="v mono">${escapeHtml(p.asset1 ?? '—')}</div>
        <div class="k">Reserve 0</div>
        <div class="v mono">${escapeHtml(ds.fmtUsd8(p.reserve0))}</div>
        <div class="k">Reserve 1</div>
        <div class="v mono">${escapeHtml(ds.fmtUsd8(p.reserve1))}</div>
        <div class="k">Total shares</div>
        <div class="v mono">${escapeHtml(p.total_shares ?? '—')}</div>
        <div class="k">Kind</div>
        <div class="v">${escapeHtml(p.kind ?? 'standard')}</div>
      </div>
    `;
  } catch (e) {
    el.innerHTML = `<div class="error">${escapeHtml(e.message)}</div>`;
  }
}
