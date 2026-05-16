// pages/wrapped.js — grid of bridged wrapped assets.
//
// Renders the WRAPPED_ASSETS registry as Phantom-style cards. Each
// card links to /token/<tokenId> for the full token detail page.
// FROST custody groups are noted (Bridge vs PSM) so users can tell
// at a glance which threshold-signed group holds the home-chain
// custody for that wrapper.

import { WRAPPED_ASSETS, logoUrlFor } from '../lib/registries.js';
import { goldCheckHTML } from '../lib/helpers.js';

export async function renderWrapped(ctx) {
  const { view } = ctx;
  view.innerHTML = `
    <header class="hero" style="padding:26px 28px">
      <span class="hero-eyebrow">FROST custody</span>
      <h1 style="font-size:1.6rem">Wrapped assets</h1>
      <p>1:1 bridged tokens for ${WRAPPED_ASSETS.length} home chains. Custody is held by a
        threshold-signed FROST group — no single operator can move funds. Tap a wrapper
        to see its tokenId, custody group, and recent bridge mint/burn events.</p>
    </header>

    <section class="card">
      <div class="card-header">
        <h2>Bridged tokens</h2>
        <div class="card-action">${WRAPPED_ASSETS.length} verified wrappers</div>
      </div>
      <div class="entity-grid">
        ${WRAPPED_ASSETS.map(w => `
          <a class="entity-card" href="#/token/${encodeURIComponent(w.tokenId)}">
            <div class="entity-head">
              <div class="entity-logo">
                <img src="${escape(logoUrlFor(w))}" alt=""
                     onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${escape(initials(w.symbol))}'}))">
              </div>
              <div>
                <div class="entity-title">${escape(w.symbol)} ${goldCheckHTML()}</div>
                <div class="entity-sub">${escape(w.name)}</div>
              </div>
            </div>
            <p class="entity-body">Home chain: <strong>${escape(w.homeChain)}</strong></p>
            <div class="entity-meta">
              <span>Custodian: <strong>${escape(w.issuer)}</strong></span>
              <span>tokenId: <strong>${escape(short(w.tokenId))}</strong></span>
            </div>
          </a>
        `).join('')}
      </div>
    </section>
  `;
}

function short(s, lead = 10, trail = 6) {
  if (!s) return '—';
  if (s.length <= lead + trail + 3) return s;
  return s.slice(0, lead) + '…' + s.slice(-trail);
}
function initials(name) {
  if (!name) return '?';
  return name.split(/[\s-_/.]+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
}
function escape(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
