// pages/sites.js — Sovereign sites directory.
//
// Surfaces every domain that has a SITE_PUBLISH attestation on chain.
// Data via /v1/sites (federated indexer). The page degrades gracefully
// when the endpoint isn't reachable — it still shows the three
// curated mirrors (monerousd.org / ionswap.monerousd.org / explorer)
// that ship with every wallet.

import { VERIFIED_ORGS } from '../lib/registries.js';

const SEED_SITES = [
  { domain: 'monerousd.org',         org: 'monerousd-protocol', blurb: 'The MoneroUSD ecosystem hub.', verified: true },
  { domain: 'ionswap.monerousd.org', org: 'ion-swap',           blurb: 'AMM + dark pool + bridge + launchpad.', verified: true },
  { domain: 'explorer.monerousd.org',org: 'monerousd-protocol', blurb: 'This explorer.', verified: true },
  { domain: 'ide.monerousd.org',     org: 'monerousd-protocol', blurb: 'Build dark contracts, publish sovereign sites.', verified: true },
];

export async function renderSites(ctx) {
  const { ds, view } = ctx;

  view.innerHTML = `
    <header class="hero" style="padding:26px 28px">
      <span class="hero-eyebrow">Sovereign hosting · SITE_PUBLISH</span>
      <h1 style="font-size:1.6rem">Chain-anchored sites</h1>
      <p>Each entry below is a static site whose contents are SHA-256-anchored on the MoneroUSD chain.
        Every publish strengthens the protocol reserve. The desktop wallet also serves these mirrors at
        <code>http://localhost:27752/&lt;domain&gt;/</code> when DNS is dark.</p>
    </header>

    <section class="card">
      <div class="card-header">
        <h2>Directory</h2>
        <div class="card-action" id="sites-action">Loading…</div>
      </div>
      <div id="sites-body"><div class="loading">Querying indexer…</div></div>
    </section>
  `;

  let live = [];
  try {
    const r = await ds.getSites();
    live = Array.isArray(r) ? r : (r && r.sites) ? r.sites : (r && r.items) ? r.items : [];
  } catch (_) { /* soft-fail, fall back to seed list */ }

  // Merge live + seed: keep first occurrence per domain (live wins).
  const seen = new Map();
  for (const s of live)    seen.set(s.domain, s);
  for (const s of SEED_SITES) if (!seen.has(s.domain)) seen.set(s.domain, s);
  const merged = Array.from(seen.values());

  const action = view.querySelector('#sites-action');
  const body   = view.querySelector('#sites-body');
  if (action) action.textContent = merged.length + ' sites';
  if (!merged.length) {
    body.innerHTML = '<div class="empty">No sovereign sites found yet.</div>';
    return;
  }

  body.innerHTML = `
    <div class="entity-grid">
      ${merged.map(s => {
        const org = VERIFIED_ORGS.find(o => o.slug === s.org);
        const verified = s.verified || (org && org.badges?.includes('verified'));
        return `
          <a class="entity-card" href="#/site/${encodeURIComponent(s.domain)}">
            <div class="entity-head">
              <div class="entity-logo">${escape(initials(s.domain))}</div>
              <div>
                <div class="entity-title">
                  ${escape(s.domain)}
                  ${verified ? '<span class="badge badge-verified">verified</span>' : ''}
                </div>
                <div class="entity-sub">v${escape(String(s.version || '?'))}</div>
              </div>
            </div>
            <p class="entity-body">${escape(s.blurb || (org && org.blurb) || '')}</p>
            <div class="entity-meta">
              ${s.size_bytes ? `<span>${(Number(s.size_bytes)/1024).toFixed(1)} KB gz</span>` : ''}
              ${s.height ? `<span>anchored @ ${escape(String(s.height))}</span>` : ''}
              ${org ? `<span>By <a href="#/org/${escape(org.slug)}">${escape(org.name)}</a></span>` : ''}
            </div>
          </a>
        `;
      }).join('')}
    </div>
  `;
}

function initials(name) {
  if (!name) return '?';
  return name.split(/[\s-_/.]+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
}
function escape(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
