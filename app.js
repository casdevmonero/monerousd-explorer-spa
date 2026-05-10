// app.js — MoneroUSD Explorer SPA boot + router.
//
// Hash-based routing so the SPA works as a static bundle on any
// host (GitHub Pages, Tor hidden service, operator's home box).
// No backend required.

import * as ds from './lib/data-source.js';
import { renderHome }     from './pages/home.js';
import { renderBlock }    from './pages/block.js';
import { renderTx }       from './pages/tx.js';
import { renderAddress }  from './pages/address.js';
import { renderToken }    from './pages/token.js';
import { renderPool }     from './pages/pool.js';
import { renderContract } from './pages/contract.js';
import { renderSearch }   from './pages/search.js';

const view = document.getElementById('view');
const sourcePill = document.getElementById('data-source-pill');
const footerSource = document.getElementById('footer-source');
const searchInput = document.getElementById('search-input');

// ── routes ─────────────────────────────────────────────────────────

const ROUTES = [
  { match: /^#\/?$/,                      handler: renderHome,     args: () => [] },
  { match: /^#\/block\/(.+)$/,            handler: renderBlock,    args: m => [m[1]] },
  { match: /^#\/tx\/(.+)$/,               handler: renderTx,       args: m => [m[1]] },
  { match: /^#\/address\/(.+)$/,          handler: renderAddress,  args: m => [m[1]] },
  { match: /^#\/token\/(.+)$/,            handler: renderToken,    args: m => [m[1]] },
  { match: /^#\/pool\/(.+)$/,             handler: renderPool,     args: m => [m[1]] },
  { match: /^#\/contract\/(.+)$/,         handler: renderContract, args: m => [m[1]] },
  { match: /^#\/q\/(.+)$/,                handler: renderSearch,   args: m => [m[1]] },
];

async function dispatch() {
  const hash = location.hash || '#/';
  const ctx = { ds, navigate, view };

  view.innerHTML = '<div class="loading">Loading…</div>';

  for (const r of ROUTES) {
    const m = hash.match(r.match);
    if (m) {
      try {
        await r.handler(ctx, ...r.args(m));
      } catch (e) {
        view.innerHTML =
          '<div class="error">' +
          '<strong>Error rendering page</strong><br>' +
          escapeHtml(e && e.message || String(e)) +
          '</div>';
        console.error(e);
      }
      return;
    }
  }

  view.innerHTML = '<div class="empty">' +
    'No route matched <code>' + escapeHtml(hash) + '</code>.' +
    '<div class="hint">Try the home page (<a href="#/">#/</a>) or use the search bar above.</div>' +
    '</div>';
}

function navigate(path) {
  if (!path.startsWith('#')) path = '#' + (path.startsWith('/') ? path : '/' + path);
  if (location.hash !== path) location.hash = path;
  else dispatch();   // same-route reload
}

window.addEventListener('hashchange', dispatch);
window.addEventListener('DOMContentLoaded', () => {
  // search bar
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = searchInput.value.trim();
      if (q) navigate('#/q/' + encodeURIComponent(q));
    }
  });

  // initial source label
  sourcePill.textContent = ds.getActiveSourceLabel();
  sourcePill.classList.add('ok');
  if (footerSource) footerSource.textContent = 'data via ' + ds.getActiveSourceLabel();

  dispatch();
});

// ── shared helpers exported for pages ──────────────────────────────

export function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Make for module-internal pages too
window.__explorerEscape = escapeHtml;
