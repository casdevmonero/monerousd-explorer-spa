// address.js — /address/<stealth>
// Shows a stealth address's balances + activity feed via the
// federated indexer's /v1/activity endpoint.
import { escapeHtml } from '../app.js';

export async function renderAddress({ ds, view }, addr) {
  view.innerHTML = `
    <h1>Address</h1>
    <div class="section">
      <div class="kv">
        <div class="k">Stealth</div>
        <div class="v mono">${escapeHtml(addr)}</div>
      </div>
    </div>
    <h2>Activity</h2>
    <div class="section" id="activity">Loading…</div>
  `;
  const el = document.getElementById('activity');

  try {
    const r = await ds.getActivity(addr);
    const items = (r && (r.activity || r.items || r)) || [];
    if (!Array.isArray(items) || !items.length) {
      el.innerHTML = '<div class="empty">No activity for this address yet.</div>';
      return;
    }
    el.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Block</th>
            <th>Type</th>
            <th>Asset</th>
            <th class="right">Amount</th>
            <th>Tx</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(it => `
            <tr>
              <td class="mono">${escapeHtml(String(it.block ?? '—'))}</td>
              <td>${escapeHtml(it.type || it.eventType || '—')}</td>
              <td class="mono">${escapeHtml(it.symbol || it.asset || it.tokenId || '—')}</td>
              <td class="right mono ${it.direction === 'out' ? 'muted' : ''}">${escapeHtml(it.direction === 'out' ? '−' : '+')}${escapeHtml(it.amount ? ds.fmtUsd8(it.amount) : '—')}</td>
              <td>${it.txHash ? `<a href="#/tx/${escapeHtml(it.txHash)}" class="mono">${escapeHtml(ds.shortHash(it.txHash))}</a>` : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    el.innerHTML = `<div class="error">${escapeHtml(e.message)}</div>`;
  }
}
