// pages/validators.js — bonded validators dashboard.
//
// Validators are members of the FROST signer set that custodies
// wrapped-asset deposits. Their bonds are public, their signal
// records are public, slashing events are public. None of this
// requires view-key disclosure — all on chain by construction.
//
// Data pulled via lib/ecosystem.js::getValidators() which tries
// three endpoint shapes (`/v1/bridge/validators`, `/v1/validators`,
// `/v1/governance/validators`) with 30 s cache + soft-fail.
//
// On total failure (every endpoint 502s) we still render the page
// with a "Coming soon" empty state explaining that the validator
// register hasn't been deployed to the federated indexer yet — the
// page is never blank.

import { getValidators } from '../lib/ecosystem.js';

export async function renderValidators(ctx) {
  const { view } = ctx;

  view.innerHTML = `
    <header class="hero" style="padding:26px 28px">
      <span class="hero-eyebrow">Bridge security</span>
      <h1 style="font-size:1.6rem">Validators</h1>
      <p>The MoneroUSD bridge uses a FROST threshold-signing group to custody wrapped-asset
        deposits. Each member bonds USDm in the BridgeValidatorBond contract; slashing on
        cryptographic evidence is automatic. The list below is everyone publicly bonded right now.</p>
    </header>

    <div class="stat-grid" id="val-stats">
      <div class="stat-tile"><div class="stat-tile-label">Active</div><div class="stat-tile-value" id="val-active">—</div></div>
      <div class="stat-tile"><div class="stat-tile-label">Total bond</div><div class="stat-tile-value" id="val-bond">—</div></div>
      <div class="stat-tile"><div class="stat-tile-label">Min bond</div><div class="stat-tile-value" id="val-min">—</div></div>
      <div class="stat-tile"><div class="stat-tile-label">Slashed (90d)</div><div class="stat-tile-value" id="val-slashed">—</div></div>
    </div>

    <section class="card">
      <div class="card-header">
        <h2>Bonded validators</h2>
        <div class="card-action" id="val-action">Loading…</div>
      </div>
      <div id="val-body"><div class="loading">Querying indexer…</div></div>
    </section>
  `;

  const r = await getValidators();
  const list = r.data || [];
  const body = view.querySelector('#val-body');
  const action = view.querySelector('#val-action');

  if (!list.length) {
    if (action) action.textContent = r.error ? 'indexer offline' : 'endpoint unavailable';
    body.innerHTML = `
      <div class="empty">
        ${r.error
          ? '<strong>Indexer unreachable.</strong><br>Validator data is on chain — when any federated indexer reports `/v1/bridge/validators` the page will auto-populate on refresh.'
          : 'The bonded validator set hasn\'t been seeded on the federated indexer yet.'}
        <div class="hint">
          Validators stake USDm in <a href="#/contract/BridgeValidatorBond">BridgeValidatorBond</a>
          and are added to the FROST signer group via DKG2.
          Read more in <a href="#/privacy">/privacy</a>.
        </div>
      </div>
    `;
    return;
  }

  // Compute aggregate stats.
  const active = list.filter(v => v.status === 'active' || v.active);
  const total  = list.reduce((s, v) => s + Number(v.bond_atomic || v.bond || 0), 0);
  const minBond = list.reduce((m, v) => Math.min(m, Number(v.bond_atomic || v.bond || Infinity)), Infinity);
  const slashed = list.reduce((s, v) => s + (Number(v.slashed_atomic || v.slashed || 0) ? 1 : 0), 0);

  view.querySelector('#val-active').textContent  = active.length.toLocaleString('en-US');
  view.querySelector('#val-bond').textContent    = (total / 1e8).toFixed(2) + ' USDm';
  view.querySelector('#val-min').textContent     = isFinite(minBond) ? (minBond / 1e8).toFixed(2) + ' USDm' : '—';
  view.querySelector('#val-slashed').textContent = slashed.toLocaleString('en-US');

  if (action) action.textContent = `${list.length} validators · ${sourceLabel(r.source)}`;

  body.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Validator</th>
            <th class="num">Bond</th>
            <th class="num">Signal rate</th>
            <th>Since</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((v, i) => `
            <tr>
              <td>${i + 1}</td>
              <td class="mono">${escape(short(v.pubkey || v.validator || v.id || ''))}</td>
              <td class="num">${((Number(v.bond_atomic || v.bond || 0)) / 1e8).toFixed(2)} USDm</td>
              <td class="num">${v.signal_rate != null ? (Number(v.signal_rate) * 100).toFixed(1) + '%' : '—'}</td>
              <td>${escape(v.since_block ? '#' + v.since_block : (v.since || '—'))}</td>
              <td>${statusBadge(v.status || (v.active ? 'active' : 'inactive'))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function sourceLabel(s) {
  if (s === 'indexer') return '<span style="color:var(--success)">live</span>';
  if (s === 'cache')   return '<span style="color:var(--text-muted)">cached</span>';
  return s || '—';
}
function statusBadge(s) {
  s = (s || '').toLowerCase();
  if (s === 'active')   return '<span class="badge badge-success">active</span>';
  if (s === 'unbonding') return '<span class="badge badge-warning">unbonding</span>';
  if (s === 'slashed')  return '<span class="badge badge-warning">slashed</span>';
  if (s === 'inactive') return '<span class="badge badge-muted">inactive</span>';
  return `<span class="badge badge-muted">${escape(s)}</span>`;
}
function short(s, lead = 8, trail = 6) {
  if (!s) return '—';
  if (s.length <= lead + trail + 3) return s;
  return s.slice(0, lead) + '…' + s.slice(-trail);
}
function escape(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
