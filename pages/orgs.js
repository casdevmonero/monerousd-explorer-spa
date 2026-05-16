// pages/orgs.js — list of verified organizations on MoneroUSD.
//
// An "organization" here is a curated identity that publishes
// chain artifacts: tokens, dark contracts, sovereign sites, NFTs.
// The registry is hardcoded in lib/registries.js for the same
// reason VERIFIED_TOKENS is: clone-name protection. Anyone CAN
// deploy under any name on chain — the badge marks the genuine
// publisher.
//
// Click an org → /org/<slug>: profile + aggregated footprint.

import { VERIFIED_ORGS } from '../lib/registries.js';

export async function renderOrgs(ctx) {
  const { view } = ctx;
  view.innerHTML = `
    <header class="hero" style="padding:26px 28px">
      <span class="hero-eyebrow">Verified entities</span>
      <h1 style="font-size:1.6rem">Organizations</h1>
      <p>Verified publishers of tokens, contracts, and sovereign sites.
         A verified badge means the org's deployments are signed by the
         registered stealth key; everything else lives at <a href="#/contracts">/contracts</a>
         without a badge.</p>
    </header>

    <section class="card">
      <div class="card-header">
        <h2>${VERIFIED_ORGS.length} verified organizations</h2>
        <div class="card-action">Curated · clone-protection enforced</div>
      </div>
      <div class="entity-grid">
        ${VERIFIED_ORGS.map(o => `
          <a class="entity-card" href="#/org/${encodeURIComponent(o.slug)}">
            <div class="entity-head">
              <div class="entity-logo">${escape(initials(o.name))}</div>
              <div>
                <div class="entity-title">
                  ${escape(o.name)}
                  <span class="badge badge-verified">verified</span>
                </div>
                <div class="entity-sub">${escape(o.slug)}</div>
              </div>
            </div>
            <p class="entity-body">${escape(o.blurb || '')}</p>
            <div class="entity-meta">
              ${(o.badges || []).map(b => `<span class="badge badge-muted">${escape(b)}</span>`).join('')}
            </div>
          </a>
        `).join('')}
      </div>
    </section>
  `;
}

function initials(name) {
  if (!name) return '?';
  return name.split(/[\s-_/]+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
}
function escape(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
