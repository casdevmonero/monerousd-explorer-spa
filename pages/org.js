// pages/org.js — Organization profile.
//
// Aggregates every chain-anchored artifact for one verified org
// into one Phantom-style profile: issued tokens, custodied wrapped
// assets, NFT collections, deployed dark contracts, published
// sovereign sites, and live source-of-truth indicators per section.
//
// Data path:
//   lib/ecosystem.js::getOrgFootprint(slug)
//     ├── live indexer fetch (multi-endpoint failover, 30s cache)
//     └── seeds from lib/registries.js if indexer is offline
//
// Every section soft-fails independently — if the contracts query
// returns 502 the sites + tokens + wrapped sections still render
// because each one fetched separately.

import { logoUrlFor } from '../lib/registries.js';
import { getOrgFootprint } from '../lib/ecosystem.js';
import { goldCheckHTML, escapeHtml as escape } from '../lib/helpers.js';

export async function renderOrg(ctx, slug) {
  const { view } = ctx;

  const fp = await getOrgFootprint(slug);
  if (!fp) {
    view.innerHTML = `
      <div class="empty">
        Unknown organization <code>${escape(slug)}</code>.
        <div class="hint"><a href="#/orgs">← All organizations</a></div>
      </div>
    `;
    return;
  }

  const { org, tokens, wrapped, nfts, contracts, sites, sources } = fp;

  view.innerHTML = `
    <header class="hero" style="padding:30px 32px">
      <span class="hero-eyebrow">${escape((org.badges || []).filter(b => b !== 'verified').join(' · ') || 'Verified')}</span>
      <h1 style="font-size:1.6rem;display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <span class="entity-logo" style="width:48px;height:48px;font-size:18px">
          ${org.logoUrl
            ? `<img src="${escape(org.logoUrl)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${escape(initials(org.name))}'}))">`
            : `<span>${escape(initials(org.name))}</span>`}
        </span>
        <span style="display:inline-flex;align-items:center;gap:10px">
          ${escape(org.name)}
          ${goldCheckHTML('xl')}
        </span>
      </h1>
      <p style="margin-top:8px">${escape(org.blurb || '')}</p>
      <div class="entity-meta" style="margin-top:14px;font-size:12px">
        ${org.website ? `<span>Website: <a href="${escape(org.website)}" target="_blank" rel="noopener noreferrer">${escape(org.website.replace(/^https?:\/\//, ''))}</a></span>` : ''}
        ${org.explorerSite ? `<span>Sovereign site: <a href="#/site/${escape(org.explorerSite)}">${escape(org.explorerSite)}</a></span>` : ''}
        <span>Slug: <code>${escape(org.slug)}</code></span>
      </div>
    </header>

    <section class="card">
      <div class="card-header">
        <h2>Issued tokens</h2>
        <div class="card-action">${tokens.length} ${tokens.length === 1 ? 'verified token' : 'verified tokens'}${sourceTag(sources.tokens)}</div>
      </div>
      ${tokens.length
        ? entityGrid(tokens.map(toTokenCard))
        : '<div class="empty">This organization has not issued any verified tokens.</div>'}
    </section>

    <section class="card">
      <div class="card-header">
        <h2>Custodied wrapped assets</h2>
        <div class="card-action">${wrapped.length} ${wrapped.length === 1 ? 'wrapper' : 'wrappers'}</div>
      </div>
      ${wrapped.length
        ? entityGrid(wrapped.map(toWrappedCard))
        : '<div class="empty">This organization does not custody any wrapped assets.</div>'}
    </section>

    <section class="card">
      <div class="card-header">
        <h2>NFT collections</h2>
        <div class="card-action">${nfts.length} ${nfts.length === 1 ? 'verified collection' : 'verified collections'}</div>
      </div>
      ${nfts.length
        ? entityGrid(nfts.map(toNftCard))
        : '<div class="empty">No verified NFT collections from this organization yet.</div>'}
    </section>

    <section class="card">
      <div class="card-header">
        <h2>Active dark contracts</h2>
        <div class="card-action">${contracts.length} ${contracts.length === 1 ? 'contract' : 'contracts'}${sourceTag(sources.contracts)}</div>
      </div>
      ${contracts.length
        ? entityGrid(contracts.map(toContractCard))
        : '<div class="empty">No contracts wired to this organization yet.</div>'}
    </section>

    <section class="card">
      <div class="card-header">
        <h2>Published sovereign sites</h2>
        <div class="card-action">${sites.length} ${sites.length === 1 ? 'site' : 'sites'}${sourceTag(sources.sites)}</div>
      </div>
      ${sites.length
        ? entityGrid(sites.map(toSiteCard))
        : '<div class="empty">No sovereign sites published by this org yet.</div>'}
    </section>
  `;
}

// ─── card renderers ──────────────────────────────────────────────

function entityGrid(cards) {
  return `<div class="entity-grid">${cards.join('')}</div>`;
}

function toTokenCard(t) {
  const sym = t.symbol || t.symbol_public || '';
  const tid = t.tokenId || t.token_id || '';
  return `
    <a class="entity-card" href="#/token/${encodeURIComponent(tid || sym)}">
      <div class="entity-head">
        <div class="entity-logo">
          <img src="${escape(logoUrlFor({ symbol: sym, tokenId: tid }))}" alt=""
               onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${escape(initials(t.name || sym))}'}))">
        </div>
        <div>
          <div class="entity-title">${escape(sym)} ${goldCheckHTML()}</div>
          <div class="entity-sub">${escape(t.name || '')}</div>
        </div>
      </div>
      <p class="entity-body">${escape(t.description || (t.kind ? (t.kind + ' asset') : 'Verified token'))}</p>
      <div class="entity-meta">
        <span>tokenId: <strong>${escape(short(tid))}</strong></span>
      </div>
    </a>
  `;
}

function toWrappedCard(w) {
  return `
    <a class="entity-card" href="#/token/${encodeURIComponent(w.tokenId || w.symbol)}">
      <div class="entity-head">
        <div class="entity-logo">
          <img src="${escape(logoUrlFor(w))}" alt=""
               onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${escape(initials(w.symbol))}'}))">
        </div>
        <div>
          <div class="entity-title">${escape(w.symbol)} ${goldCheckHTML()}</div>
          <div class="entity-sub">${escape(w.name || '')}</div>
        </div>
      </div>
      <p class="entity-body">Home chain: <strong>${escape(w.homeChain)}</strong></p>
      <div class="entity-meta">
        <span>tokenId: <strong>${escape(short(w.tokenId || ''))}</strong></span>
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
          <div class="entity-title">${escape(n.name || n.symbol)} ${goldCheckHTML()}</div>
          <div class="entity-sub">${escape(short(n.tokenId || ''))}</div>
        </div>
      </div>
      <p class="entity-body">${escape(n.description || 'NFT collection.')}</p>
    </a>
  `;
}

function toContractCard(c) {
  const cid = c.contractId || c.id || c.codeHash || '';
  const dest = cid ? '#/contract/' + encodeURIComponent(cid) : '#/contracts';
  const isLive = !c._seeded && (c.codeHash || c.contractId);
  return `
    <a class="entity-card" href="${dest}">
      <div class="entity-head">
        <div class="entity-logo">C</div>
        <div>
          <div class="entity-title">${escape(c.name || 'Unnamed')}</div>
          <div class="entity-sub">${cid ? escape(short(cid)) : escape(c.sourceUrl ? new URL(c.sourceUrl, 'https://x').pathname.split('/').slice(-1)[0] : '—')}</div>
        </div>
      </div>
      <p class="entity-body">${escape(c.role || c.description || 'On-chain contract.')}</p>
      <div class="entity-meta">
        ${c.codeHash ? `<span>codeHash: <strong>${escape(short(c.codeHash))}</strong></span>` : ''}
        ${c.version ? `<span>v${escape(String(c.version))}</span>` : ''}
        <span class="badge ${isLive ? 'badge-success' : 'badge-muted'}">${isLive ? 'on chain' : 'backend module'}</span>
      </div>
    </a>
  `;
}

function toSiteCard(s) {
  return `
    <a class="entity-card" href="#/site/${encodeURIComponent(s.domain)}">
      <div class="entity-head">
        <div class="entity-logo">${escape(initials(s.domain))}</div>
        <div>
          <div class="entity-title">${escape(s.domain)} ${goldCheckHTML()}</div>
          <div class="entity-sub">v${escape(String(s.version || '?'))}</div>
        </div>
      </div>
      <div class="entity-meta">
        ${s.size_bytes ? `<span>${(Number(s.size_bytes)/1024).toFixed(1)} KB gz</span>` : ''}
        ${s.generated_at ? `<span>${escape(s.generated_at)}</span>` : ''}
      </div>
    </a>
  `;
}

// ─── helpers ─────────────────────────────────────────────────────

function sourceTag(src) {
  if (!src) return '';
  if (src === 'indexer') return ' · <span style="color:var(--success)">live</span>';
  if (src === 'cache')   return ' · <span style="color:var(--text-muted)">cached</span>';
  if (src === 'offline') return ' · <span style="color:var(--warning)">indexer offline</span>';
  if (src === 'fallback')return ' · <span style="color:var(--warning)">registry fallback</span>';
  return '';
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
