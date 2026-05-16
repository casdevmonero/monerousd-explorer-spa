// pages/validators.js — Bonded validators + network nodes.
//
// Surfaces every public-on-chain signal the protocol exposes about
// the FROST bridge custody set, plus a separate "Network nodes"
// section from the FROST-signed peer-manifest. Both are pulled via
// the central ecosystem layer (30 s cache + multi-endpoint
// failover); each section soft-fails into a Phantom-style empty
// state if its endpoint isn't reachable.
//
// What's surfaced (production-reachable, no view-key disclosure):
//
//   • Active validator count          /v1/bridge/validator-count
//   • Applications open                  ↳ same payload
//   • Min bond (current scaling-curve)   ↳ same payload
//   • Slashing schedule per failure mode /v1/bridge/validator-economics
//   • Network nodes (FROST-signed seeds) update.monerousd.org/peer-manifest.json
//
// Per-validator pubkeys are intentionally NOT exposed by the
// production indexer (privacy posture — see /privacy). If a future
// endpoint surfaces them this page auto-renders the list.

import { getValidators, getNetworkNodes } from '../lib/ecosystem.js';

export async function renderValidators(ctx) {
  const { view } = ctx;

  view.innerHTML = `
    <header class="hero" style="padding:26px 28px">
      <span class="hero-eyebrow">Bridge security</span>
      <h1 style="font-size:1.6rem">Validators &amp; network nodes</h1>
      <p>The MoneroUSD bridge uses a FROST threshold-signing group to custody wrapped-asset
        deposits. Each validator bonds USDm in the BridgeValidatorBond contract; slashing on
        cryptographic evidence is automatic. The numbers below are public, chain-anchored, and
        update every 30 s.</p>
    </header>

    <div class="stat-grid" id="val-stats">
      <div class="stat-tile">
        <div class="stat-tile-label">Active validators</div>
        <div class="stat-tile-value" id="stat-active">—</div>
        <div class="stat-tile-sub" id="stat-active-sub">loading…</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-label">Applications open</div>
        <div class="stat-tile-value" id="stat-apps" style="font-size:1.05rem">—</div>
        <div class="stat-tile-sub" id="stat-apps-sub"></div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-label">Min bond (current)</div>
        <div class="stat-tile-value" id="stat-bond">—</div>
        <div class="stat-tile-sub">scaling curve · per-validator</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-label">Known network nodes</div>
        <div class="stat-tile-value" id="stat-nodes">—</div>
        <div class="stat-tile-sub" id="stat-nodes-sub">FROST-signed seed manifest</div>
      </div>
    </div>

    <section class="card" id="card-validators">
      <div class="card-header">
        <h2>Bonded validators</h2>
        <div class="card-action" id="val-action">Loading…</div>
      </div>
      <div id="val-body"><div class="loading">Querying federated indexer…</div></div>
    </section>

    <!--
      Network-nodes detail section REMOVED in v1.2.229. Exposing
      per-node IP addresses leaks operator metadata (MoneroUSD nodes
      are meant to stay anonymized). The aggregate count in the
      Known Network Nodes tile above is preserved and auto-refreshes
      every 30 s via the ecosystem layer's getNetworkNodes() helper.
    -->
    <section class="card" id="card-slashing" style="display:none">
      <div class="card-header">
        <h2>Slashing schedule</h2>
        <div class="card-action">Public · enforced by BridgeValidatorBond</div>
      </div>
      <div id="slashing-body"></div>
    </section>
  `;

  // Fan-out load — validators stats + nodes in parallel.
  const [vr, nr] = await Promise.all([getValidators(), getNetworkNodes()]);
  paintValidators(view, vr);
  paintNodes(view, nr);
  paintSlashing(view, vr);

  // Live auto-refresh — the Known Network Nodes + Active Validators
  // tiles re-fetch every 30 s so an operator adding/removing a seed
  // surfaces here without a manual reload. Clear the interval when
  // the user navigates away (the next dispatch wipes `#val-stats`).
  const interval = setInterval(async () => {
    if (!view.querySelector('#val-stats')) {
      clearInterval(interval);
      return;
    }
    const [vr2, nr2] = await Promise.all([getValidators(), getNetworkNodes()]);
    paintValidators(view, vr2);
    paintNodes(view, nr2);
  }, 30_000);
}

function paintValidators(view, r) {
  const data = r.data || r;
  const count = data?.count || {};
  const economics = data?.economics || {};
  const list = data?.list || [];

  const activeEl  = view.querySelector('#stat-active');
  const activeSub = view.querySelector('#stat-active-sub');
  const appsEl    = view.querySelector('#stat-apps');
  const appsSub   = view.querySelector('#stat-apps-sub');
  const bondEl    = view.querySelector('#stat-bond');

  const active = Number(count.active_validators ?? 0);
  activeEl.textContent = active.toLocaleString('en-US');
  activeSub.innerHTML = sourceLabel(r.source);

  const open = count.applications_open;
  appsEl.innerHTML = open
    ? '<span style="color:var(--success)">Open</span>'
    : (open === false ? '<span style="color:var(--warning)">Closed</span>' : '—');
  appsSub.textContent = open ? 'New validators welcome' : (open === false ? 'Set is full or paused' : '');

  const minBondDisplay = count.min_bond_display || economics.min_bond_display || '—';
  bondEl.textContent = minBondDisplay;

  // Validator list — when the indexer exposes per-validator data
  // we render a table. Otherwise the empty state explains why.
  const body = view.querySelector('#val-body');
  const action = view.querySelector('#val-action');
  if (list.length) {
    action.innerHTML = `${list.length} bonded · ${sourceLabel(r.source)}`;
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
  } else if (active > 0) {
    action.innerHTML = `${active} bonded · per-validator detail hidden`;
    body.innerHTML = `
      <div class="empty">
        <strong>${active}</strong> validators bonded right now. Per-validator pubkeys
        are intentionally not exposed by the production indexer — leaking the FROST
        signer-set composition would weaken the bridge's collusion-resistance
        properties. See <a href="#/privacy">/privacy</a> for the full
        concealed-vs-public table.
        <div class="hint">
          The aggregate stats above are sufficient for ecosystem health monitoring;
          per-validator slash events publish to the chain when they occur.
        </div>
      </div>
    `;
  } else {
    action.innerHTML = r.source === 'offline' ? 'indexer offline' : 'no validators bonded yet';
    body.innerHTML = `
      <div class="empty">
        ${r.source === 'offline'
          ? '<strong>Indexer unreachable.</strong> Validator data is on chain — when any federated indexer responds, this page auto-populates.'
          : 'Zero validators bonded. The bridge is in its bootstrap phase; the first validator can bond at <strong>' + escape(minBondDisplay) + '</strong> via BridgeValidatorBond.'}
        <div class="hint">
          <a href="#/contract/BridgeValidatorBond">View the bond contract →</a>
        </div>
      </div>
    `;
  }
}

// Updates only the "Known Network Nodes" stat tile. The full
// detail listing was REMOVED in v1.2.229 — per-node IP addresses
// leak operator metadata. The wallet's no-islanding stack still
// consumes the full peer manifest for connectivity; the explorer
// just shows a privacy-safe count.
//
// The displayed count prefers `manifest.known_node_count` (the
// operator-asserted total, set via KNOWN_NODE_COUNT env when
// publish-peer-manifest.js was run). That count includes operator-
// run nodes whose IPs are intentionally NOT in the public seed
// list (home labs / on-call boxes). Falls back to seeds.length
// when the field isn't present.
function paintNodes(view, r) {
  const data = r.data || r;
  const seeds = data?.seeds || [];
  const count = Number.isInteger(data?.knownNodeCount)
    ? data.knownNodeCount
    : seeds.length;
  const nodesEl  = view.querySelector('#stat-nodes');
  const nodesSub = view.querySelector('#stat-nodes-sub');
  if (nodesEl) nodesEl.textContent = count.toLocaleString('en-US');
  if (nodesSub) {
    if (data?.publishedAt) {
      nodesSub.innerHTML = `manifest @ block ${Number(data.publishedAt).toLocaleString('en-US')} · ${sourceLabel(r.source)}`;
    } else {
      nodesSub.innerHTML = sourceLabel(r.source);
    }
  }
}

function paintSlashing(view, r) {
  const data = r.data || r;
  const ec = data?.economics;
  if (!ec || !ec.slashing_schedule) return;
  const card = view.querySelector('#card-slashing');
  const body = view.querySelector('#slashing-body');
  if (!card || !body) return;
  card.style.display = '';
  const rows = [];
  for (const [k, v] of Object.entries(ec.slashing_schedule)) {
    rows.push(`
      <tr>
        <td><strong>${escape(k.replace(/_/g, ' '))}</strong></td>
        <td class="mono">${escape(formatSlash(v))}</td>
      </tr>
    `);
  }
  body.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Failure mode</th><th>Penalty</th></tr>
        </thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>
    <p style="margin:14px 0 0;color:var(--text-secondary);font-size:12px;line-height:1.55">
      All slashing is automatic on cryptographic evidence — no operator signature
      required. Bonds are held in escrow for a 14-day unbond window after voluntary
      withdrawal so post-hoc evidence still triggers slashing.
    </p>
  `;
}

function formatSlash(v) {
  if (!v || typeof v !== 'object') return String(v);
  const parts = [];
  if (v.bps_per_event != null) parts.push((v.bps_per_event / 100).toFixed(2) + '% per event');
  if (v.bps_per_hour != null)  parts.push((v.bps_per_hour / 100).toFixed(2) + '% per hour');
  if (v.cap_bps_per_epoch != null) parts.push('cap ' + (v.cap_bps_per_epoch / 100).toFixed(2) + '% / epoch');
  return parts.join(' · ') || JSON.stringify(v);
}

function sourceLabel(s) {
  if (s === 'indexer') return '<span style="color:var(--success)">live</span>';
  if (s === 'cache')   return '<span style="color:var(--text-muted)">cached</span>';
  if (s === 'offline') return '<span style="color:var(--warning)">offline</span>';
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
