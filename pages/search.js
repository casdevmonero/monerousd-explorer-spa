// search.js — /q/<query>
// Heuristic dispatcher: figures out what the user typed (block height,
// tx hash, address, tokenId, contractId) and either redirects directly
// to the matching detail page or shows a list of candidate matches.
// Mirrors monerousd-explorer/views/search.ejs (legacy server-rendered view).
import { escapeHtml, isVerified, isCloneAttempt, shortAddr } from '../lib/helpers.js';

export async function renderSearch({ ds, navigate, view }, rawQuery) {
  const q = String(rawQuery || '').trim();

  view.innerHTML = `
    <section>
      <h2>Search Results</h2>
      <div class="detail-table">
        <table>
          <tbody>
            <tr><td class="label">Query</td><td class="mono">${escapeHtml(q)}</td></tr>
          </tbody>
        </table>
      </div>
      <div id="search-body" style="margin-top:18px"><p class="muted">Looking up…</p></div>
    </section>
  `;
  const el = document.getElementById('search-body');

  if (!q) {
    el.innerHTML = '<p class="muted">Empty query.</p>';
    return;
  }

  // Numeric → block height
  if (/^\d+$/.test(q)) {
    navigate('#/block/' + encodeURIComponent(q));
    return;
  }

  // 64-hex → could be a block hash or tx hash. Probe block first.
  if (/^[0-9a-fA-F]{64}$/.test(q)) {
    try {
      const b = await ds.getBlockByHash(q);
      if (b && (b.block_header || b)) {
        navigate('#/block/' + encodeURIComponent(q));
        return;
      }
    } catch (_) { /* fall through to tx */ }
    navigate('#/tx/' + encodeURIComponent(q));
    return;
  }

  // Starts with `ion1_` → custom-token id
  if (/^ion1_[0-9a-fA-F]+$/.test(q)) {
    navigate('#/token/' + encodeURIComponent(q));
    return;
  }

  // Starts with `dc1_` → dark-contract id
  if (/^dc1_[0-9a-fA-F]+$/.test(q)) {
    navigate('#/contract/' + encodeURIComponent(q));
    return;
  }

  // Looks like a stealth (long base58, 90+ chars)
  if (q.length >= 90 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(q)) {
    navigate('#/address/' + encodeURIComponent(q));
    return;
  }

  // Symbol / name (2-16 chars) — search the token registry.
  if (/^[A-Za-z0-9_ -]{2,32}$/.test(q)) {
    try {
      // Try direct symbol lookup first; if it returns a single token,
      // navigate. Otherwise list matching tokens like legacy search.ejs.
      let tokens = [];
      try {
        const single = await ds.getToken(q);
        if (single && (single.token_id || single.tokenId)) {
          navigate('#/token/' + encodeURIComponent(q));
          return;
        }
      } catch (_) { /* no direct match; try registry list */ }

      const list = await ds.getTokens();
      const all = Array.isArray(list) ? list : (list.tokens || list.items || []);
      const needle = q.toLowerCase();
      tokens = all.filter(t => {
        const sym = (t.symbol_public || t.symbol || '').toLowerCase();
        const nam = (t.name_public || t.name || '').toLowerCase();
        return sym.includes(needle) || nam.includes(needle);
      });

      if (tokens.length === 1) {
        const t = tokens[0];
        navigate('#/token/' + encodeURIComponent(t.token_id || t.tokenId || (t.symbol_public || t.symbol)));
        return;
      }

      if (tokens.length > 0) {
        el.innerHTML = renderTokenResults(tokens);
        return;
      }
    } catch (_) { /* fall through to no-match */ }
  }

  // Couldn't classify — show explanation + recognized formats.
  el.innerHTML = `
    <p class="muted">No results found for <code>${escapeHtml(q)}</code>.</p>
    <div class="privacy-note" style="margin-top:14px">
      <strong>Recognized formats:</strong>
      <ul style="margin-top:8px;line-height:1.7;list-style:disc;padding-left:24px">
        <li><code>123456</code> &mdash; block height</li>
        <li><code>4fab2cfea54e7dd6…</code> (64 hex) &mdash; block or tx hash</li>
        <li><code>ion1_…</code> &mdash; token id</li>
        <li><code>dc1_…</code> &mdash; dark-contract id</li>
        <li><code>4Abc…</code> (90+ base58) &mdash; stealth address</li>
        <li><code>USDm</code>, <code>wBTC</code>, etc. &mdash; verified token symbol</li>
      </ul>
    </div>
  `;
}

function renderTokenResults(tokens) {
  return `
    <div class="token-results">
      ${tokens.map(t => {
        const sym = t.symbol_public || t.symbol || '?';
        const name = t.name_public || t.name || 'Unknown Token';
        const tid = t.token_id || t.tokenId || '';
        const verified = isVerified(sym);
        const clone = !verified && isCloneAttempt(sym);
        return `
          <a href="#/token/${encodeURIComponent(tid || sym)}" class="token-result-card">
            <div class="token-result-logo">
              <img src="https://ion.monerousd.org/api/token-logo/${encodeURIComponent(tid || sym)}?v=6"
                   alt="${escapeHtml(sym)}"
                   onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
                   width="40" height="40">
              <div class="token-result-fallback" style="display:none">${escapeHtml(sym.charAt(0))}</div>
            </div>
            <div class="token-result-info">
              <div class="token-result-name">
                ${escapeHtml(name)}
                ${verified
                  ? `<span class="badge badge-verified">&#10003; Verified</span>`
                  : clone
                  ? `<span class="badge badge-clone-warning">&#9888; Unofficial</span>`
                  : `<span class="badge badge-community">Community</span>`}
              </div>
              <div class="token-result-meta">
                <span class="token-result-sym">${escapeHtml(sym)}</span>
              </div>
              ${tid ? `<div class="token-result-id mono muted" title="${escapeHtml(tid)}" data-copy="${escapeHtml(tid)}">${escapeHtml(shortAddr(tid))}</div>` : ''}
            </div>
            <div class="token-result-arrow">&rarr;</div>
          </a>
        `;
      }).join('')}
    </div>
  `;
}
