// pages/nfts.js — NFT collections directory.
//
// At v1 the verified-NFT registry is empty (collections will
// onboard via lib/registries.js when curated). The page also
// queries /v1/tokens for any token entries with kind === 'nft'
// (or `nft: true`) so newly-minted collections surface without a
// code change. Verified ones get a badge; everything else shows
// the raw on-chain metadata.

import { VERIFIED_NFTS, logoUrlFor } from '../lib/registries.js';
import { goldCheckHTML } from '../lib/helpers.js';

export async function renderNfts(ctx) {
  const { ds, view } = ctx;

  view.innerHTML = `
    <header class="hero" style="padding:26px 28px">
      <span class="hero-eyebrow">Privacy-preserving NFTs</span>
      <h1 style="font-size:1.6rem">NFT collections</h1>
      <p>NFT collections minted via the MoneroUSD token-protocol v2 (NFT_MINT). Ownership is
        ring-signed + stealth-addressed by default; metadata is on-chain.</p>
    </header>

    <section class="card">
      <div class="card-header">
        <h2>Verified collections</h2>
        <div class="card-action">${VERIFIED_NFTS.length} curated</div>
      </div>
      ${VERIFIED_NFTS.length ? `
        <div class="entity-grid">
          ${VERIFIED_NFTS.map(n => nftCard(n, true)).join('')}
        </div>` : `
        <div class="empty">
          No verified collections yet. The first batch of curated
          MoneroUSD collections will land in <code>lib/registries.js</code>.
          <div class="hint">Newly-minted collections still show up below, fetched from the live indexer.</div>
        </div>`}
    </section>

    <section class="card">
      <div class="card-header">
        <h2>On-chain collections</h2>
        <div class="card-action" id="onchain-action">Loading…</div>
      </div>
      <div id="onchain-body"><div class="loading">Querying indexer…</div></div>
    </section>
  `;

  loadOnChain(ctx);
}

async function loadOnChain(ctx) {
  const { ds, view } = ctx;
  const body = view.querySelector('#onchain-body');
  const action = view.querySelector('#onchain-action');
  try {
    const r = await ds.callIndexerSafe('/v1/tokens?type=nft');
    const list = Array.isArray(r) ? r : (r && r.tokens) ? r.tokens : (r && r.items) ? r.items : [];
    const nfts = list.filter(t =>
      (t.kind === 'nft' || t.type === 'nft' || t.nft === true ||
       (Array.isArray(t.tags) && t.tags.includes('nft')))
    );
    if (action) action.textContent = nfts.length + ' on chain';
    if (!nfts.length) {
      body.innerHTML = '<div class="empty">No on-chain NFT collections found.</div>';
      return;
    }
    body.innerHTML = `
      <div class="entity-grid">
        ${nfts.slice(0, 60).map(n => nftCard(n, false)).join('')}
      </div>
    `;
  } catch (_) {
    if (action) action.textContent = 'unavailable';
    body.innerHTML = '<div class="empty">Indexer unreachable. Verified collections above still render.</div>';
  }
}

function nftCard(n, verified) {
  const sym = n.symbol || n.ticker || '';
  const tokenId = n.tokenId || n.id || '';
  return `
    <a class="entity-card" href="#/token/${encodeURIComponent(tokenId || sym)}">
      <div class="entity-head">
        <div class="entity-logo">
          <img src="${escape(logoUrlFor({ symbol: sym, tokenId, logoUrl: n.logoUrl }))}" alt=""
               onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${escape(initials(n.name || sym))}'}))">
        </div>
        <div>
          <div class="entity-title">
            ${escape(n.name || sym)}
            ${verified ? goldCheckHTML() : ''}
          </div>
          <div class="entity-sub">${escape(short(tokenId))}</div>
        </div>
      </div>
      <p class="entity-body">${escape(n.description || 'NFT collection on MoneroUSD.')}</p>
      <div class="entity-meta">
        ${n.supply != null ? `<span>Supply: <strong>${escape(String(n.supply))}</strong></span>` : ''}
        ${n.minted != null ? `<span>Minted: <strong>${escape(String(n.minted))}</strong></span>` : ''}
      </div>
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
