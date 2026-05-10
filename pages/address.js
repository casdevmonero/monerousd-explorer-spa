// address.js — /address/<stealth>
// Shows a stealth address's recent on-chain activity via the federated
// indexer's /v1/activity endpoint.
import { escapeHtml, formatAmount, shortAddr, timeSince } from '../lib/helpers.js';

export async function renderAddress({ ds, view }, addr) {
  view.innerHTML = `
    <section>
      <h2>Address</h2>
      <div class="detail-table">
        <table>
          <tbody>
            <tr><td class="label">Stealth</td><td class="mono break-all">${escapeHtml(addr)}</td></tr>
            <tr><td class="label">Type</td><td>Stealth (FCMP++ ring signature receiver)</td></tr>
          </tbody>
        </table>
      </div>

      <div class="privacy-note">
        <strong>Privacy:</strong> Stealth addresses receive into one-time per-transaction output pubkeys. No on-chain balance is computable from the address alone &mdash; only inbound activity attested via <code>ion://op/v1</code> ops is shown here.
      </div>
    </section>

    <section>
      <h3>Activity</h3>
      <div id="activity-body"><p class="muted">Loading…</p></div>
    </section>
  `;

  const el = document.getElementById('activity-body');
  try {
    const r = await ds.getActivity(addr);
    const items = Array.isArray(r) ? r : (r && (r.activity || r.items || r.rows)) || [];
    if (!items.length) {
      el.innerHTML = '<p class="muted">No activity recorded for this address.</p>';
      return;
    }
    el.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Block</th>
              <th>Type</th>
              <th>Asset</th>
              <th>Amount</th>
              <th>Tx</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(it => {
              const dir = it.direction || it.dir || 'in';
              const sign = dir === 'out' ? '−' : '+';
              const cls  = dir === 'out' ? 'text-red' : 'text-green';
              return `
                <tr>
                  <td>${it.block ? `<a href="#/block/${it.block}">${Number(it.block).toLocaleString()}</a>` : '—'} ${it.timestamp ? `<div class="muted" style="font-size:0.78rem">${escapeHtml(timeSince(it.timestamp))}</div>` : ''}</td>
                  <td><span class="badge">${escapeHtml(it.type || it.eventType || '—')}</span></td>
                  <td class="mono">${escapeHtml(it.symbol || it.asset || it.tokenId || 'USDm')}</td>
                  <td class="${cls} mono">${sign}${escapeHtml(it.amount ? formatAmount(it.amount) : '—')}</td>
                  <td>${it.txHash ? `<a href="#/tx/${escapeHtml(it.txHash)}" class="mono">${escapeHtml(shortAddr(it.txHash))}</a>` : '—'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    el.innerHTML = `<p class="muted">No activity (or indexer unreachable).</p>`;
  }
}
