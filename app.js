// app.js — MoneroUSD Explorer SPA boot + hash-router.
//
// Hash-based routing so the SPA works as a static bundle on any host
// (GitHub Pages, Tor hidden service, operator's home box). No backend
// required — all data flows through lib/data-source.js (wallet provider
// when present, federated daemon RPC + indexer fallback otherwise).

import * as ds from './lib/data-source.js';
import * as H  from './lib/helpers.js';
import { renderHome }      from './pages/home.js';
import { renderBlock }     from './pages/block.js';
import { renderTx }        from './pages/tx.js';
import { renderAddress }   from './pages/address.js';
import { renderToken }     from './pages/token.js';
import { renderTokens }    from './pages/tokens.js';
import { renderPool }      from './pages/pool.js';
import { renderContract }  from './pages/contract.js';
import { renderContracts } from './pages/contracts.js';
import { renderSearch }    from './pages/search.js';

const view         = document.getElementById('view');
const sourcePill   = document.getElementById('source-pill');
const footerSource = document.getElementById('footer-source');
const searchInput  = document.getElementById('search-input');
const searchForm   = document.getElementById('search-form');
const searchBtn    = document.getElementById('search-btn');
const loader       = document.getElementById('usdm-loader');

// ── routes ─────────────────────────────────────────────────────────

const ROUTES = [
  { match: /^#\/?$/,                handler: renderHome,      args: () => [] },
  { match: /^#\/block\/(.+)$/,      handler: renderBlock,     args: m => [decodeURIComponent(m[1])] },
  { match: /^#\/tx\/(.+)$/,         handler: renderTx,        args: m => [decodeURIComponent(m[1])] },
  { match: /^#\/address\/(.+)$/,    handler: renderAddress,   args: m => [decodeURIComponent(m[1])] },
  { match: /^#\/token\/(.+)$/,      handler: renderToken,     args: m => [decodeURIComponent(m[1])] },
  { match: /^#\/tokens\/?$/,        handler: renderTokens,    args: () => [] },
  { match: /^#\/pool\/(.+)$/,       handler: renderPool,      args: m => [decodeURIComponent(m[1])] },
  { match: /^#\/contract\/(.+)$/,   handler: renderContract,  args: m => [decodeURIComponent(m[1])] },
  { match: /^#\/contracts\/?$/,     handler: renderContracts, args: () => [] },
  { match: /^#\/q\/(.+)$/,          handler: renderSearch,    args: m => [decodeURIComponent(m[1])] },
];

async function dispatch() {
  const hash = location.hash || '#/';
  const ctx = { ds, H, navigate, view };

  showLoader();
  view.innerHTML = '<div class="loading">Loading…</div>';

  for (const r of ROUTES) {
    const m = hash.match(r.match);
    if (m) {
      try {
        await r.handler(ctx, ...r.args(m));
      } catch (e) {
        view.innerHTML =
          '<div class="error-box"><strong>Error rendering page</strong>' +
          '<p>' + H.escapeHtml(e && e.message || String(e)) + '</p></div>';
        console.error(e);
      }
      hideLoader();
      return;
    }
  }

  view.innerHTML = '<div class="empty">' +
    'No route matched <code>' + H.escapeHtml(hash) + '</code>.' +
    '<div class="hint">Try the <a href="#/">home page</a> or use the search bar above.</div>' +
    '</div>';
  hideLoader();
}

export function navigate(path) {
  if (!path.startsWith('#')) path = '#' + (path.startsWith('/') ? path : '/' + path);
  if (location.hash !== path) location.hash = path;
  else dispatch();   // same-route reload
}

// ── loader lifecycle (animation matches legacy header.ejs) ─────────

function hideLoader() {
  if (loader) loader.classList.add('hidden');
}
function showLoader() {
  if (loader) loader.classList.remove('hidden');
}

// ── source detection / pill ────────────────────────────────────────

async function probeSource() {
  try {
    await ds.getBlockCount();
    const label = ds.getActiveSourceLabel();
    sourcePill.textContent = label;
    sourcePill.classList.remove('connecting', 'error');
    if (footerSource) footerSource.textContent = 'via ' + label;
  } catch (e) {
    sourcePill.textContent = 'unreachable';
    sourcePill.classList.remove('connecting');
    sourcePill.classList.add('error');
    if (footerSource) footerSource.textContent = 'data source unreachable';
  }
}

// ── boot ───────────────────────────────────────────────────────────

window.addEventListener('hashchange', dispatch);

window.addEventListener('DOMContentLoaded', () => {
  // Search form Enter + button click
  function doSearch() {
    const q = (searchInput.value || '').trim();
    if (q) navigate('#/q/' + encodeURIComponent(q));
  }
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
  });
  searchBtn.addEventListener('click', doSearch);
  searchForm.addEventListener('submit', e => { e.preventDefault(); doSearch(); });

  probeSource().finally(() => { /* pill updates inline */ });
  dispatch();
});

// ── click-to-copy on .mono identifiers (ported from footer.ejs) ────

(function () {
  function isCopyTarget(el) {
    if (!el) return null;
    if (el.classList && el.classList.contains('copyable')) return el;
    if (el.classList && el.classList.contains('mono')) {
      if (el.closest('button, input, textarea, a[href]:not(.mono)')) return null;
      return el;
    }
    return null;
  }

  function flashCopied(el) {
    const prev = el.style.background;
    const prevTitle = el.title;
    el.style.background = 'rgba(34,197,94,0.25)';
    el.style.color = '#86efac';
    el.style.borderRadius = '3px';
    el.style.transition = 'background 0.6s ease, color 0.6s ease';
    el.title = 'Copied!';
    setTimeout(() => {
      el.style.background = prev;
      el.style.color = '';
      el.title = prevTitle || '';
    }, 700);
  }

  document.addEventListener('click', function (e) {
    const t = isCopyTarget(e.target);
    if (!t) return;
    let text = (t.textContent || '').replace(/\s+…\s*$|\s+$/g, '').trim();
    if (t.dataset && t.dataset.copy) text = t.dataset.copy;
    if (!text || text.length < 3) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => flashCopied(t));
      } else {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
        flashCopied(t);
      }
    } catch (_) {}
  });

  document.addEventListener('mouseover', function (e) {
    const t = isCopyTarget(e.target);
    if (!t) return;
    if (!t.dataset._copyHover) {
      t.dataset._copyHover = '1';
      if (!t.title) t.title = 'Click to copy';
      t.style.cursor = 'pointer';
    }
  });
})();

// ── shared helpers exported for pages ──────────────────────────────

export const escapeHtml = H.escapeHtml;
