// pages/sites.js — Sovereign sites directory.
//
// Surfaces every domain that has a SITE_PUBLISH attestation on chain.
// Live data via lib/ecosystem.js::getSites() (federated indexer,
// 30 s cache, soft-fail). Pre-fix this page nested `<a>` tags inside
// each card which the browser auto-closes prematurely, breaking
// the layout into a jumbled stack of fragments. The redesign:
//
//   • One card per site, with the card body click-target going to
//     the explorer detail page (/site/<domain>).
//   • Two explicit action buttons in the card footer: "Open site ↗"
//     (opens the live clearnet URL in a new tab) and "Anchor"
//     (the chain-anchored detail page on this explorer).
//   • Gold check next to the domain name for verified entries.
//   • Owner-org link rendered AS A BADGE (not as a nested anchor),
//     using onclick to navigate so the parent card stays intact.
//
// Seed list is the four canonical sovereign mirrors that ship in
// every wallet build — they're always shown even when the indexer
// is offline so the page is never empty.

import { VERIFIED_ORGS } from '../lib/registries.js';
import { getSites } from '../lib/ecosystem.js';
import { goldCheckHTML, escapeHtml as escape, escapeAttr } from '../lib/helpers.js';

const SEED_SITES = [
  {
    domain: 'monerousd.org',
    org: 'monerousd-protocol',
    blurb: 'The MoneroUSD ecosystem hub — wallet downloads, whitepaper, run-a-node guide, developer docs.',
    verified: true,
  },
  {
    domain: 'ionswap.monerousd.org',
    org: 'ion-swap',
    blurb: 'AMM + dark pool + FROST bridge + PSM converter + token launchpad.',
    verified: true,
  },
  {
    domain: 'explorer.monerousd.org',
    org: 'monerousd-protocol',
    blurb: 'This explorer. Sovereign-mirrored at localhost:27752 in every wallet.',
    verified: true,
  },
  {
    domain: 'ide.monerousd.org',
    org: 'monerousd-protocol',
    blurb: 'Build dark contracts. Publish sovereign sites. Strengthen the peg.',
    verified: true,
  },
  {
    domain: 'installers.monerousd.org',
    org: 'monerousd-protocol',
    blurb: 'Sovereign binary distribution — chain-anchored SHA256SUMS for every wallet release.',
    verified: true,
  },
];

export async function renderSites(ctx) {
  const { view } = ctx;

  view.innerHTML = `
    <header class="hero" style="padding:26px 28px">
      <span class="hero-eyebrow">Sovereign hosting · SITE_PUBLISH</span>
      <h1 style="font-size:1.6rem">Chain-anchored sites</h1>
      <p>Each entry below is a static site whose contents are SHA-256-anchored on the MoneroUSD
        chain. Every publish strengthens the protocol reserve. The desktop wallet also serves
        these mirrors at <code>http://localhost:27752/&lt;domain&gt;/</code> when DNS is dark.</p>
    </header>

    <section class="card">
      <div class="card-header">
        <h2>Directory</h2>
        <div class="card-action" id="sites-action">Loading…</div>
      </div>
      <div id="sites-body"><div class="loading">Querying federated indexer…</div></div>
    </section>
  `;

  const r = await getSites();
  const live = r.data || [];

  // Merge live with seed — keep first occurrence per domain (live wins).
  const seen = new Map();
  for (const s of live) seen.set(s.domain, s);
  for (const s of SEED_SITES) if (!seen.has(s.domain)) seen.set(s.domain, s);
  const merged = Array.from(seen.values());

  const action = view.querySelector('#sites-action');
  const body   = view.querySelector('#sites-body');
  if (action) action.innerHTML = `${merged.length} sites${sourceTag(r.source)}`;

  if (!merged.length) {
    body.innerHTML = '<div class="empty">No sovereign sites found yet.</div>';
    return;
  }

  body.innerHTML = `
    <div class="entity-grid">
      ${merged.map(s => siteCard(s)).join('')}
    </div>
  `;

  // Wire the "By <Org>" badges to navigate (they're spans, not
  // nested anchors, so we delegate click to the parent body).
  body.addEventListener('click', e => {
    const orgPill = e.target.closest('[data-org-link]');
    if (orgPill) {
      e.preventDefault();
      e.stopPropagation();
      location.hash = '#/org/' + encodeURIComponent(orgPill.dataset.orgLink);
    }
    const openExt = e.target.closest('[data-open-external]');
    if (openExt) {
      e.preventDefault();
      e.stopPropagation();
      // Open the live clearnet site in a new tab.
      window.open(openExt.dataset.openExternal, '_blank', 'noopener,noreferrer');
    }
  });
}

function siteCard(s) {
  const org = VERIFIED_ORGS.find(o => o.slug === s.org);
  const verified = s.verified || (org && org.badges?.includes('verified'));
  const liveUrl = 'https://' + s.domain + '/';
  const explorerUrl = '#/site/' + encodeURIComponent(s.domain);

  return `
    <article class="site-card${verified ? ' site-card--verified' : ''}">
      <a class="site-card-head" href="${escapeAttr(explorerUrl)}">
        <div class="entity-logo" style="width:42px;height:42px;font-size:15px">${escape(initials(s.domain))}</div>
        <div class="site-card-title">
          <div class="site-card-domain">${escape(s.domain)} ${verified ? goldCheckHTML() : ''}</div>
          <div class="site-card-version">v${escape(String(s.version || '?'))}${s.size_bytes ? ' · ' + (Number(s.size_bytes)/1024).toFixed(1) + ' KB gz' : ''}${s.height ? ' · anchored @ ' + s.height : ''}</div>
        </div>
      </a>
      <p class="site-card-blurb">${escape(s.blurb || (org && org.blurb) || 'Sovereign site.')}</p>
      <div class="site-card-actions">
        <button class="btn btn-primary btn-sm" type="button" data-open-external="${escapeAttr(liveUrl)}" aria-label="Open ${escapeAttr(s.domain)} in a new tab">
          Open site ↗
        </button>
        <a class="btn btn-ghost btn-sm" href="${escapeAttr(explorerUrl)}">Anchor</a>
        ${org ? `<button class="badge badge-muted site-card-by" type="button" data-org-link="${escapeAttr(org.slug)}">By ${escape(org.name)}</button>` : ''}
      </div>
    </article>
  `;
}

function sourceTag(src) {
  if (src === 'indexer')  return ' · <span style="color:var(--success)">live</span>';
  if (src === 'cache')    return ' · <span style="color:var(--text-muted)">cached</span>';
  if (src === 'offline')  return ' · <span style="color:var(--warning)">indexer offline (seed only)</span>';
  if (src === 'fallback') return ' · <span style="color:var(--warning)">registry only</span>';
  return '';
}
function initials(name) {
  if (!name) return '?';
  return name.split(/[\s-_/.]+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
}
