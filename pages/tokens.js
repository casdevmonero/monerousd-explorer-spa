// pages/tokens.js — /tokens
//
// Token registry browser. The inline search bar in this page was
// removed in favor of the global header search (which has a live
// dropdown). The /tokens page now focuses on its single job:
// surface every registered token on chain in one scannable table.
// Verified tokens float to the top, gold-checked.
//
// Optional hash-query `?search=foo` is still honored so deep-links
// like `#/tokens?search=Sats` work.

import {
  escapeHtml, formatAmount, badgeHtml, isVerified, shortAddr,
  goldCheckHTML,
} from '../lib/helpers.js';
import { VERIFIED_TOKENS, WRAPPED_ASSETS, logoUrlFor } from '../lib/registries.js';

export async function renderTokens({ ds, view }) {
  // Optional `?search=` deep-link support.
  const hashQuery = (location.hash.split('?')[1] || '');
  const params = new URLSearchParams(hashQuery);
  const search = (params.get('search') || '').trim();

  let tokens = [];
  let errorMsg = null;
  try {
    const r = await ds.getTokens();
    tokens = Array.isArray(r) ? r : (r.tokens || r.items || []);
  } catch (e) {
    errorMsg = e?.message || String(e);
  }

  // Apply ?search filter (substring on symbol OR name).
  if (search) {
    const needle = search.toLowerCase();
    tokens = tokens.filter(t => {
      const sym = (t.symbol_public || t.symbol || '').toLowerCase();
      const nam = (t.name_public || t.name || '').toLowerCase();
      return sym.includes(needle) || nam.includes(needle);
    });
  }

  // Verified-first sort. Names of every verified asset stay
  // pre-sorted by the order in lib/registries.js to keep USDm
  // and wrappers grouped naturally.
  const verified = [];
  const community = [];
  tokens.forEach(t => {
    const sym = t.symbol_public || t.symbol || '';
    (isVerified(sym) ? verified : community).push(t);
  });

  // If the federated indexer is offline OR returned an empty list,
  // fall back to the static registries so the page is never empty.
  // The user still sees USDm + every wrapped asset with logos.
  let usingFallback = false;
  let sorted = verified.concat(community);
  if (!sorted.length && !search) {
    usingFallback = true;
    sorted = [
      ...VERIFIED_TOKENS.map(t => ({ ...t, _fromRegistry: true })),
      ...WRAPPED_ASSETS.map(t => ({ ...t, _fromRegistry: true, _wrapped: true })),
    ];
  }

  view.innerHTML = `
    <header class="hero" style="padding:26px 28px">
      <span class="hero-eyebrow">Token registry</span>
      <h1 style="font-size:1.6rem">Every token on MoneroUSD</h1>
      <p>USDm + bridged wrappers + community-issued assets. Verified entries are gold-checked
        and surfaced first; clones of verified names are blocked at the registry layer.
        Use the header search to jump to a specific symbol, tokenId, or hash.</p>
    </header>

    ${errorMsg && !sorted.length ? `<div class="error-box"><strong>Indexer error</strong><p>${escapeHtml(errorMsg)}</p></div>` : ''}

    <section class="card">
      <div class="card-header">
        <h2>${sorted.length.toLocaleString('en-US')} ${search ? 'matching' : 'registered'} token${sorted.length === 1 ? '' : 's'}</h2>
        <div class="card-action">${usingFallback ? 'Showing verified registry (indexer offline)' : 'Live from indexer'}</div>
      </div>

      ${sorted.length ? `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Symbol</th>
              <th>Address</th>
              <th>Supply rule</th>
              <th class="num">Max supply</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(t => {
              const sym = t.symbol_public || t.symbol || '?';
              const name = t.name_public || t.name || 'Unknown';
              const tid = t.token_id || t.tokenId || t.addr || '';
              const supplyRule = t.supply_rule || t.supplyRule || 'fixed';
              const maxSupply = t.max_supply || t.maxSupply || '0';
              const createdBlock = t.creation_block || t.createdBlock || 0;
              const verifiedRow = isVerified(sym) || t._fromRegistry;
              const logo = verifiedRow ? logoUrlFor({ symbol: sym, tokenId: tid }) : null;
              return `
                <tr>
                  <td style="width:36px">
                    <div class="entity-logo" style="width:26px;height:26px;font-size:11px">
                      ${logo ? `<img src="${escapeHtml(logo)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${escapeHtml((sym||'?').slice(0,2).toUpperCase())}'}))">` : `<span>${escapeHtml((sym||'?').slice(0,2).toUpperCase())}</span>`}
                    </div>
                  </td>
                  <td>
                    <a href="#/token/${encodeURIComponent(tid || sym)}">${escapeHtml(name)}</a>
                    ${verifiedRow ? goldCheckHTML() : ''}
                  </td>
                  <td class="mono">${escapeHtml(sym)}</td>
                  <td class="mono" style="font-size:12px;color:var(--text-muted)" title="${escapeHtml(tid)}" data-copy="${escapeHtml(tid)}">${escapeHtml(shortAddr(tid))}</td>
                  <td><span class="badge badge-supply-${escapeHtml(supplyRule)}">${escapeHtml(supplyRule)}</span></td>
                  <td class="num">${maxSupply === '0' || maxSupply === 0 ? 'Unlimited' : escapeHtml(formatAmount(maxSupply))}</td>
                  <td>${createdBlock > 0 ? `<a href="#/block/${createdBlock}">${Number(createdBlock).toLocaleString('en-US')}</a>` : '—'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      ` : `<div class="empty">No tokens registered yet${search ? ` matching <code>${escapeHtml(search)}</code>` : ''}.</div>`}
    </section>
  `;
}
