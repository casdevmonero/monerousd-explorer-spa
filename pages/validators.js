// pages/validators.js — bonded validators dashboard.
//
// Validators are members of the FROST signer set that custodies
// wrapped-asset deposits. Their bonds are public, their signal
// records are public, slashing events are public. None of this
// requires view-key disclosure — it's all on chain by construction.
//
// Endpoint: /v1/bridge/validators (falls back to /v1/validators).
// Soft-fails to a "endpoint not deployed yet" empty state if the
// indexer doesn't have it; everything else still renders.

export async function renderValidators(ctx) {
  const { ds, view } = ctx;

  view.innerHTML = `
    <header class="hero" style="padding:26px 28px">
      <span class="hero-eyebrow">Bridge security</span>
      <h1 style="font-size:1.6rem">Validators</h1>
      <p>The MoneroUSD bridge uses a FROST threshold-signing group to custody wrapped-asset
        deposits. Each member bonds USDm in the BridgeValidatorBond contract; slashing on
        cryptographic evidence is automatic. The list below is everyone publicly bonded right now.</p>
    </header>

    <div class="stat-grid" id="val-stats">
      <div class="stat-tile"><div class="stat-tile-label">Active</div><div class="stat-tile-value">—</div></div>
      <div class="stat-tile"><div class="stat-tile-label">Total bond</div><div class="stat-tile-value">—</div></div>
      <div class="stat-tile"><div class="stat-tile-label">Min bond</div><div class="stat-tile-value">—</div></div>
      <div class="stat-tile"><div class="stat-tile-label">Slashed (90d)</div><div class="stat-tile-value">—</div></div>
    </div>

    <section class="card">
      <div class="card-header">
        <h2>Bonded validators</h2>
        <div class="card-action" id="val-action">Loading…</div>
      </div>
      <div id="val-body"><div class="loading">Querying indexer…</div></div>
    </section>
  `;

  await load(ctx);
}

async function load(ctx) {
  const { ds, view } = ctx;
  const body = view.querySelector('#val-body');
  const action = view.querySelector('#val-action');
  let r = null;
  try { r = await ds.getValidators(); } catch (_) {}
  if (!r) {
    if (action) action.textContent = 'endpoint unavailable';
    body.innerHTML = `
      <div class="empty">
        The validator-list endpoint hasn't been deployed yet on the
        federated indexer. Once <code>/v1/bridge/validators</code> goes live
        it'll auto-render here — no code change needed.
      </div>
    `;
    return;
  }

  const list = Array.isArray(r) ? r : (r.validators || r.items || []);
  const active = list.filter(v => v.status === 'active' || v.active);
  const total  = list.reduce((s, v) => s + Number(v.bond_atomic || v.bond || 0), 0);
  const minBond = list.reduce((m, v) => Math.min(m, Number(v.bond_atomic || v.bond || Infinity)), Infinity);
  const slashed = list.reduce((s, v) => s + (Number(v.slashed_atomic || v.slashed || 0) ? 1 : 0), 0);

  // Update stat tiles.
  const stats = view.querySelectorAll('#val-stats .stat-tile-value');
  if (stats[0]) stats[0].textContent = active.length.toLocaleString('en-US');
  if (stats[1]) stats[1].textContent = (total / 1e8).toFixed(2) + ' USDm';
  if (stats[2]) stats[2].textContent = isFinite(minBond) ? (minBond / 1e8).toFixed(2) + ' USDm' : '—';
  if (stats[3]) stats[3].textContent = slashed.toLocaleString('en-US');

  if (action) action.textContent = list.length + ' validators';
  if (!list.length) {
    body.innerHTML = '<div class="empty">No validators bonded yet.</div>';
    return;
  }

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
