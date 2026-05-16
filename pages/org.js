// pages/org.js — Organization profile.
//
// Aggregates everything an org touches on chain into one
// Phantom-style profile: tokens issued, wrapped assets custodied,
// dark contracts deployed, sovereign sites published, reserve
// contributions.
//
// Data is filtered from the static registries (lib/registries.js)
// + the federated indexer endpoints (/v1/tokens, /v1/contracts,
// /v1/sites). When the indexer is unreachable the page degrades
// gracefully — the verified registry sections still render.

import {
  VERIFIED_ORGS, VERIFIED_TOKENS, WRAPPED_ASSETS, VERIFIED_NFTS,
  logoUrlFor, getOrg,
} from '../lib/registries.js';

export async function renderOrg(ctx, slug) {
  const { ds, view } = ctx;
  const org = getOrg(slug);
  if (!org) {
    view.innerHTML = `
      <div class="empty">
        Unknown organization <code>${escape(slug)}</code>.
        <div class="hint"><a href="#/orgs">← All organizations</a></div>
      </div>
    `;
    return;
  }

  const issuedTokens   = VERIFIED_TOKENS.filter(t => t.org === slug);
  const issuedWrapped  = WRAPPED_ASSETS.filter(w => w.org === slug);
  const issuedNfts     = VERIFIED_NFTS.filter(n => n.org === slug);

  view.innerHTML = `
    <header class="hero" style="padding:30px 32px">
      <span class="hero-eyebrow">${escape((org.badges || []).join(' · ') || 'Verified')}</span>
      <h1 style="font-size:1.6rem;display:flex;align-items:center;gap:12px">
        <span class="entity-logo" style="width:40px;height:40px;font-size:16px">${escape(initials(org.name))}</span>
        ${escape(org.name)}
        <span class="badge badge-verified">verified</span>
      </h1>
      <p>${escape(org.blurb || '')}</p>
      <div class="entity-meta" style="margin-top:14px;font-size:12px">
        ${org.website ? `<span>Website: <a href="${escape(org.website)}" target="_blank" rel="noopener noreferrer">${escape(org.website.replace(/^https?:\/\//, ''))}</a></span>` : ''}
        ${org.explorerSite ? `<span>Sovereign site: <a href="#/site/${escape(org.explorerSite)}">${escape(org.explorerSite)}</a></span>` : ''}
        <span>Slug: <code>${escape(org.slug)}</code></span>
      </div>
    </header>

    <section class="card" id="tokens-card">
      <div class="card-header">
        <h2>Issued tokens</h2>
        <div class="card-action">${issuedTokens.length} verified</div>
      </div>
      ${issuedTokens.length ? entityGrid(issuedTokens.map(toTokenCard)) :
        '<div class="empty">This organization has not issued any verified tokens.</div>'}
    </section>

    <section class="card" id="wrapped-card">
      <div class="card-header">
        <h2>Custodied wrapped assets</h2>
        <div class="card-action">${issuedWrapped.length} bridged</div>
      </div>
      ${issuedWrapped.length ? entityGrid(issuedWrapped.map(toWrappedCard)) :
        '<div class="empty">This organization does not custody any wrapped assets.</div>'}
    </section>

    <section class="card" id="nfts-card">
      <div class="card-header">
        <h2>NFT collections</h2>
        <div class="card-action">${issuedNfts.length} verified</div>
      </div>
      ${issuedNfts.length ? entityGrid(issuedNfts.map(toNftCard)) :
        '<div class="empty">No verified NFT collections from this organization yet.</div>'}
    </section>

    <section class="card" id="contracts-card">
      <div class="card-header">
        <h2>Deployed Dark Contracts</h2>
        <div class="card-action" id="contracts-action">Loading…</div>
      </div>
      <div id="contracts-body"><div class="loading">Querying indexer…</div></div>
    </section>

    <section class="card" id="sites-card">
      <div class="card-header">
        <h2>Published sovereign sites</h2>
        <div class="card-action" id="sites-action">Loading…</div>
      </div>
      <div id="sites-body"><div class="loading">Querying indexer…</div></div>
    </section>
  `;

  // Indexer-fed sections (degrade gracefully on failure).
  loadContracts(ctx, slug);
  loadSites(ctx, org);
}

async function loadContracts(ctx, slug) {
  const { ds, view } = ctx;
  const body = view.querySelector('#contracts-body');
  const action = view.querySelector('#contracts-action');
  try {
    const r = await ds.callIndexerSafe(`/v1/contracts?org=${encodeURIComponent(slug)}`);
    const list = Array.isArray(r) ? r : (r && r.contracts) ? r.contracts : [];
    if (action) action.textContent = list.length + ' deployed';
    if (!list.length) {
      body.innerHTML = '<div class="empty">No contracts deployed by this org yet.</div>';
      return;
    }
    body.innerHTML = entityGrid(list.slice(0, 24).map(c => `
      <a class="entity-card" href="#/contract/${encodeURIComponent(c.contractId || c.id)}">
        <div class="entity-head">
          <div class="entity-logo">C</div>
          <div>
            <div class="entity-title">${escape(c.name || 'Unnamed contract')}</div>
            <div class="entity-sub">${escape(short(c.contractId || c.id || ''))}</div>
          </div>
        </div>
        <div class="entity-meta">
          <span>codeHash: <strong>${escape(short(c.codeHash || ''))}</strong></span>
          <span>v${escape(String(c.version || 1))}</span>
        </div>
      </a>
    `));
  } catch (_) {
    if (action) action.textContent = 'unavailable';
    body.innerHTML = '<div class="empty">Indexer unreachable.</div>';
  }
}

async function loadSites(ctx, org) {
  const { ds, view } = ctx;
  const body = view.querySelector('#sites-body');
  const action = view.querySelector('#sites-action');
  try {
    const r = await ds.getSites();
    const list = Array.isArray(r) ? r : (r && r.sites) ? r.sites : [];
    // Filter by org slug if the indexer returns it, otherwise by
    // matching against the org's known explorerSite domain.
    const mine = list.filter(s =>
      (s.org && s.org === org.slug) ||
      (org.explorerSite && (s.domain || '').includes(org.explorerSite))
    );
    if (action) action.textContent = mine.length + ' published';
    if (!mine.length) {
      body.innerHTML = '<div class="empty">No sovereign sites published by this org yet.</div>';
      return;
    }
    body.innerHTML = entityGrid(mine.slice(0, 24).map(s => `
      <a class="entity-card" href="#/site/${encodeURIComponent(s.domain)}">
        <div class="entity-head">
          <div class="entity-logo">${escape(initials(s.domain))}</div>
          <div>
            <div class="entity-title">${escape(s.domain)} <span class="badge badge-verified">SITE_PUBLISH</span></div>
            <div class="entity-sub">v${escape(String(s.version || '?'))}</div>
          </div>
        </div>
        <div class="entity-meta">
          ${s.size_bytes ? `<span>${(Number(s.size_bytes)/1024).toFixed(1)} KB gzipped</span>` : ''}
          ${s.generated_at ? `<span>${escape(s.generated_at)}</span>` : ''}
        </div>
      </a>
    `));
  } catch (_) {
    if (action) action.textContent = 'unavailable';
    body.innerHTML = '<div class="empty">Indexer unreachable.</div>';
  }
}

function entityGrid(cards) {
  return `<div class="entity-grid">${cards.join('')}</div>`;
}

function toTokenCard(t) {
  return `
    <a class="entity-card" href="#/token/${encodeURIComponent(t.tokenId || t.symbol)}">
      <div class="entity-head">
        <div class="entity-logo">
          <img src="${escape(logoUrlFor(t))}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${escape(initials(t.name || t.symbol))}'}))">
        </div>
        <div>
          <div class="entity-title">${escape(t.symbol)} <span class="badge badge-verified">verified</span></div>
          <div class="entity-sub">${escape(t.name || '')}</div>
        </div>
      </div>
      <p class="entity-body">${escape(t.description || (t.kind ? (t.kind + ' asset') : 'Verified token'))}</p>
      <div class="entity-meta">
        <span>tokenId: <strong>${escape(short(t.tokenId || ''))}</strong></span>
      </div>
    </a>
  `;
}

function toWrappedCard(w) {
  return `
    <a class="entity-card" href="#/token/${encodeURIComponent(w.tokenId || w.symbol)}">
      <div class="entity-head">
        <div class="entity-logo">
          <img src="${escape(logoUrlFor(w))}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${escape(initials(w.symbol))}'}))">
        </div>
        <div>
          <div class="entity-title">${escape(w.symbol)} <span class="badge badge-verified">wrapped</span></div>
          <div class="entity-sub">${escape(w.name || '')}</div>
        </div>
      </div>
      <p class="entity-body">Home chain: <strong>${escape(w.homeChain)}</strong></p>
      <div class="entity-meta">
        <span>tokenId: <strong>${escape(short(w.tokenId || ''))}</strong></span>
        <span>Issuer: <strong>${escape(w.issuer || '')}</strong></span>
      </div>
    </a>
  `;
}

function toNftCard(n) {
  return `
    <a class="entity-card" href="#/token/${encodeURIComponent(n.tokenId || n.symbol)}">
      <div class="entity-head">
        <div class="entity-logo">N</div>
        <div>
          <div class="entity-title">${escape(n.name || n.symbol)}</div>
          <div class="entity-sub">${escape(short(n.tokenId || ''))}</div>
        </div>
      </div>
      <p class="entity-body">${escape(n.description || 'NFT collection.')}</p>
    </a>
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
