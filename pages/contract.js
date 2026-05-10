// contract.js — /contract/<contractId>
import { escapeHtml } from '../app.js';

export async function renderContract({ ds, view }, contractId) {
  view.innerHTML = `<h1>Dark Contract</h1><div class="section" id="contract-body">Loading…</div>`;
  const el = document.getElementById('contract-body');
  try {
    const c = await ds.getContract(contractId);
    const stateRows = c.public_state
      ? Object.entries(c.public_state).map(([k, v]) =>
          `<div class="k">${escapeHtml(k)}</div><div class="v mono">${escapeHtml(String(v))}</div>`
        ).join('')
      : '';
    const entries = (c.abi && c.abi.entries) || [];
    el.innerHTML = `
      <div class="kv">
        <div class="k">Contract ID</div>
        <div class="v mono">${escapeHtml(c.contractId ?? c.id ?? '—')}</div>
        <div class="k">Name</div>
        <div class="v">${escapeHtml((c.abi && c.abi.name) ?? '—')}</div>
        <div class="k">Code hash</div>
        <div class="v mono">${escapeHtml(c.code_hash ?? '—')}</div>
        <div class="k">Deployed by</div>
        <div class="v mono">${c.deployer_stealth ? `<a href="#/address/${escapeHtml(c.deployer_stealth)}">${escapeHtml(ds.shortHash(c.deployer_stealth))}</a>` : '—'}</div>
        <div class="k">Deployed in tx</div>
        <div class="v mono">${c.deployed_tx ? `<a href="#/tx/${escapeHtml(c.deployed_tx)}">${escapeHtml(ds.shortHash(c.deployed_tx))}</a>` : '—'}</div>
      </div>

      <h2>Public state</h2>
      ${stateRows ? `<div class="section"><div class="kv">${stateRows}</div></div>` : '<div class="empty">No public state.</div>'}

      <h2>Entrypoints</h2>
      ${entries.length === 0 ? '<div class="empty">No entrypoints in ABI.</div>' :
        '<table><thead><tr><th>Entry</th><th>Args</th><th>Annotation</th></tr></thead><tbody>' +
        entries.map(e => `
          <tr>
            <td class="mono">${escapeHtml(e.name)}</td>
            <td class="mono muted">${escapeHtml((e.params || []).map(p => `${p.type} ${p.name}`).join(', '))}</td>
            <td class="muted">${escapeHtml(e.annotation || '@batch')}</td>
          </tr>
        `).join('') + '</tbody></table>'}
    `;
  } catch (e) {
    el.innerHTML = `<div class="error">${escapeHtml(e.message)}</div>`;
  }
}
