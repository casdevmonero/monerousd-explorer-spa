// contract.js — /contract/<contractId>
// Mirrors monerousd-explorer/views/contract.ejs (legacy server-rendered view).
import { escapeHtml, shortAddr, timeSince } from '../lib/helpers.js';

export async function renderContract({ ds, view }, contractId) {
  let c = null;
  let errorMsg = null;

  try {
    c = await ds.getContract(contractId);
  } catch (e) {
    errorMsg = e && e.message || String(e);
  }

  if (!c) {
    view.innerHTML = `<div class="error-box"><strong>Error:</strong> ${escapeHtml(errorMsg || 'Contract not found')}</div>`;
    return;
  }

  const id           = c.contractId || c.id || contractId;
  const name         = (c.abi && c.abi.name) || c.name || c.verifiedName || '(unnamed)';
  const codeHash     = c.codeHash || c.code_hash || '';
  const deployer     = c.deployer || c.deployerStealth || c.deployer_stealth || '';
  const deployedTx   = c.deployedTx || c.deployed_tx || '';
  const createdBlock = c.createdBlock || c.created_block || 0;
  const verified     = !!c.verified;
  const entries      = (c.abi && c.abi.entries) || [];
  const publicState  = c.publicState || c.public_state || null;

  view.innerHTML = `
    <section>
      <div class="token-header-row">
        <h2 style="margin:0">${escapeHtml(name)}</h2>
        ${verified ? `<span class="badge badge-verified badge-lg">&#10003; Verified</span>` : `<span class="badge badge-community badge-lg">Community</span>`}
      </div>

      <div class="detail-table">
        <table>
          <tbody>
            <tr><td class="label">Contract ID</td><td class="mono break-all">${escapeHtml(id)}</td></tr>
            <tr><td class="label">Code Hash</td><td class="mono break-all">${escapeHtml(codeHash || '—')}</td></tr>
            <tr><td class="label">Deployer</td><td>${deployer ? `<a href="#/address/${encodeURIComponent(deployer)}" class="mono">${escapeHtml(shortAddr(deployer))}</a>` : '—'}</td></tr>
            <tr><td class="label">Deployed Tx</td><td>${deployedTx ? `<a href="#/tx/${encodeURIComponent(deployedTx)}" class="mono">${escapeHtml(shortAddr(deployedTx))}</a>` : '—'}</td></tr>
            ${createdBlock > 0 ? `<tr><td class="label">Deployed Block</td><td><a href="#/block/${createdBlock}">${Number(createdBlock).toLocaleString()}</a></td></tr>` : ''}
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h3>Entrypoints</h3>
      ${entries.length === 0 ? '<p class="muted">No entrypoints in ABI.</p>' : `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Params</th>
              <th>Mode</th>
            </tr>
          </thead>
          <tbody>
            ${entries.map(e => `
              <tr>
                <td class="mono">${escapeHtml(e.name || '?')}</td>
                <td class="mono muted">${escapeHtml((e.params || []).map(p => `${p.type} ${p.name}`).join(', '))}</td>
                <td class="muted"><span class="badge">${escapeHtml(e.annotation || '@batch')}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      `}
    </section>

    ${publicState ? `
    <section>
      <h3>Public state</h3>
      <div class="detail-table">
        <table>
          <tbody>
            ${Object.entries(publicState).map(([k, v]) => `
              <tr><td class="label">${escapeHtml(k)}</td><td class="mono break-all">${escapeHtml(typeof v === 'string' ? v : JSON.stringify(v))}</td></tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
    ` : ''}
  `;
}
