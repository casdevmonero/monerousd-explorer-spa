// app.js — MoneroUSD Explorer SPA boot + hash router +
// global search dropdown.
//
// Hash-based routing so the SPA works as a static bundle on any
// host (GitHub Pages, Tor hidden service, operator's home box).
// A 404.html sibling bootstraps path-based URLs (/tx/<hash>) onto
// the hash router, so wallet links pasted directly into a browser
// still resolve.

import * as ds from './lib/data-source.js';
import * as H  from './lib/helpers.js';
import { primeIndex, searchLocal, groupByKind, initialsFor } from './lib/search-index.js';
import { logoUrlFor } from './lib/registries.js';
import { goldCheckHTML } from './lib/helpers.js';

import { renderHome }       from './pages/home.js';
import { renderBlock }      from './pages/block.js';
import { renderTx }         from './pages/tx.js';
import { renderAddress }    from './pages/address.js';
import { renderToken }      from './pages/token.js';
import { renderTokens }     from './pages/tokens.js';
import { renderPool }       from './pages/pool.js';
import { renderContract }   from './pages/contract.js';
import { renderContracts }  from './pages/contracts.js';
import { renderSearch }     from './pages/search.js';
import { renderWrapped }    from './pages/wrapped.js';
import { renderNfts }       from './pages/nfts.js';
import { renderOrgs }       from './pages/orgs.js';
import { renderOrg }        from './pages/org.js';
import { renderSites }      from './pages/sites.js';
import { renderValidators } from './pages/validators.js';
import { renderPrivacy }    from './pages/privacy.js';

const view          = document.getElementById('view');
const sourcePill    = document.getElementById('source-pill');
const footerSource  = document.getElementById('footer-source');
const searchInput   = document.getElementById('search-input');
const searchForm    = document.getElementById('search-form');
const searchBtn     = document.getElementById('search-btn');
const dropdown      = document.getElementById('search-dropdown');
const loader        = document.getElementById('usdm-loader');
const networkSwitch = document.getElementById('network-switch');
const networkSelect = document.getElementById('network-select');
const testnetBanner = document.getElementById('testnet-banner');

// ── routes ─────────────────────────────────────────────────────────

const ROUTES = [
  { match: /^#\/?$/,                handler: renderHome,       args: () => [] },
  { match: /^#\/block\/(.+)$/,      handler: renderBlock,      args: m => [decodeURIComponent(m[1])] },
  { match: /^#\/tx\/(.+)$/,         handler: renderTx,         args: m => [decodeURIComponent(m[1])] },
  { match: /^#\/address\/(.+)$/,    handler: renderAddress,    args: m => [decodeURIComponent(m[1])] },
  { match: /^#\/token\/(.+)$/,      handler: renderToken,      args: m => [decodeURIComponent(m[1])] },
  { match: /^#\/tokens\/?$/,        handler: renderTokens,     args: () => [] },
  { match: /^#\/pool\/(.+)$/,       handler: renderPool,       args: m => [decodeURIComponent(m[1])] },
  { match: /^#\/contract\/(.+)$/,   handler: renderContract,   args: m => [decodeURIComponent(m[1])] },
  { match: /^#\/contracts\/?$/,     handler: renderContracts,  args: () => [] },
  { match: /^#\/wrapped\/?$/,       handler: renderWrapped,    args: () => [] },
  { match: /^#\/nfts\/?$/,          handler: renderNfts,       args: () => [] },
  { match: /^#\/orgs\/?$/,          handler: renderOrgs,       args: () => [] },
  { match: /^#\/org\/(.+)$/,        handler: renderOrg,        args: m => [decodeURIComponent(m[1])] },
  { match: /^#\/sites\/?$/,         handler: renderSites,      args: () => [] },
  { match: /^#\/site\/(.+)$/,       handler: renderSite,       args: m => [decodeURIComponent(m[1])] },
  { match: /^#\/validators\/?$/,    handler: renderValidators, args: () => [] },
  { match: /^#\/privacy\/?$/,       handler: renderPrivacy,    args: () => [] },
  { match: /^#\/q\/(.+)$/,          handler: renderSearch,     args: m => [decodeURIComponent(m[1])] },
];

// Inline /site/<domain> handler (no separate page module needed —
// the directory grid links here, this just renders a stub linking
// out to the actual sovereign URL + the chain anchor.)
async function renderSite(ctx, domain) {
  const { view } = ctx;
  view.innerHTML = `
    <div class="card">
      <div class="card-header"><h2>Sovereign site · ${escape(domain)}</h2></div>
      <div class="kv-table">
        <dt>Live URL</dt>           <dd><a href="https://${escape(domain)}/" target="_blank" rel="noopener noreferrer">https://${escape(domain)}/</a></dd>
        <dt>Sovereign mirror</dt>   <dd class="mono">http://localhost:27752/${escape(domain)}/</dd>
        <dt>Chain anchor query</dt> <dd class="mono">/v1/sites/${escape(domain)}</dd>
      </div>
      <p style="margin-top:18px;color:var(--text-secondary);font-size:13px">
        The wallet's sovereign-server (port 27752) serves a hash-verified mirror of this
        domain. Every public visit you make goes to the clearnet URL; every wallet user
        with the bundle installed gets the local mirror automatically when the clearnet
        host is unreachable.
      </p>
      <p style="margin-top:8px"><a class="btn btn-ghost btn-sm" href="#/sites">← All sites</a></p>
    </div>
  `;
}
function escape(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function dispatch() {
  const hash = location.hash || '#/';
  const ctx = { ds, H, navigate, view };

  showLoader();
  view.innerHTML = '<div class="loading">Loading…</div>';

  // Update nav-link active state.
  setActiveNav(hash);

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
      scrollTopIfNewRoute(hash);
      return;
    }
  }

  view.innerHTML = '<div class="empty">' +
    'No route matched <code>' + H.escapeHtml(hash) + '</code>.' +
    '<div class="hint">Try the <a href="#/">home page</a> or use the search bar above.</div>' +
    '</div>';
  hideLoader();
}

let _lastHash = '';
function scrollTopIfNewRoute(hash) {
  if (hash !== _lastHash) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    _lastHash = hash;
  }
}

export function navigate(path) {
  if (!path.startsWith('#')) path = '#' + (path.startsWith('/') ? path : '/' + path);
  if (location.hash !== path) location.hash = path;
  else dispatch();
}

// Map current hash to nav-link active state. Used by header + mobile.
function setActiveNav(hash) {
  const links = document.querySelectorAll('.header-nav-link, .mobile-nav-link');
  links.forEach(a => a.classList.remove('active'));
  const segMatch = hash.match(/^#\/?([^/]*)/);
  const seg = segMatch ? segMatch[1] : '';
  const map = {
    '':            ['', '/'],
    tokens:        ['tokens', 'token'],
    wrapped:       ['wrapped'],
    nfts:          ['nfts'],
    contracts:     ['contracts', 'contract'],
    orgs:          ['orgs', 'org'],
    sites:         ['sites', 'site'],
    validators:    ['validators'],
    privacy:       ['privacy'],
  };
  links.forEach(a => {
    const href = a.getAttribute('href') || '';
    const m = href.match(/^#\/?([^/]*)/);
    const linkSeg = m ? m[1] : '';
    if (linkSeg === seg) a.classList.add('active');
    // mobile nav uses data-mobile-route as canonical hint.
    const mobileRoute = a.dataset?.mobileRoute;
    if (mobileRoute !== undefined) {
      const mobileSeg = mobileRoute.replace(/^\//, '');
      if (mobileSeg === seg) a.classList.add('active');
      if (mobileSeg === '' && seg === '') a.classList.add('active');
    }
  });
}

// ── loader lifecycle ────────────────────────────────────────────────

function hideLoader() { if (loader) loader.classList.add('hidden'); }
function showLoader() { if (loader) loader.classList.remove('hidden'); }

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

// ── network switch (Mainnet / Testnet via /testnet path prefix) ─────
//
// Network is derived from the URL path (ds.getNetwork()), so the only
// job here is to reflect it in the header control + banner, and to
// turn a selection into a real navigation to the right base path.
function setupNetworkSwitch() {
  const net = ds.getNetwork();
  const testnet = net === 'testnet';

  if (networkSwitch) networkSwitch.classList.toggle('testnet', testnet);
  if (networkSelect) {
    networkSelect.value = net;
    networkSelect.addEventListener('change', () => {
      const target = networkSelect.value;
      if (target === ds.getNetwork()) return;          // already there
      // Full navigation to the new base path ('/' or '/testnet/'),
      // preserving the current hash route so we land on the same page.
      location.assign(ds.networkSwitchUrl(target));
    });
  }

  if (testnetBanner) {
    testnetBanner.hidden = !testnet;
    const exit = document.getElementById('testnet-banner-exit');
    // Make the "Back to Mainnet" link a real path navigation (the
    // static href="#/" would only change the hash, staying on /testnet).
    if (exit) exit.setAttribute('href', ds.networkSwitchUrl('mainnet'));
  }

  // Reflect the network in the document title so a backgrounded
  // testnet tab is distinguishable at a glance.
  if (testnet && !/Testnet/.test(document.title)) {
    document.title = 'Testnet · ' + document.title;
  }
}

// ── search dropdown ─────────────────────────────────────────────────

let _dropdownActiveIdx = -1;
let _dropdownEntries = [];

function renderDropdown(entries) {
  _dropdownEntries = entries;
  _dropdownActiveIdx = entries.length ? 0 : -1;
  if (!entries.length) {
    dropdown.classList.remove('open');
    dropdown.innerHTML = '';
    return;
  }
  const grouped = groupByKind(entries);
  dropdown.innerHTML = grouped.map(g => `
    <div class="search-section-title">${escape(g.label)}</div>
    ${g.entries.map((e, i) => searchResultHTML(e, _dropdownEntries.indexOf(e))).join('')}
  `).join('');
  dropdown.classList.add('open');
  paintActive();
}

function searchResultHTML(e, idx) {
  const isActive = idx === _dropdownActiveIdx ? ' active' : '';
  // Logo: real image (token logo) OR letter-initials fallback OR
  // a kind-specific icon (tx/block/address suggestions).
  let logo;
  if (e.logo) {
    logo = `<img src="${escape(e.logo)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${escape(initialsFor(e.label))}'}))">`;
  } else if (e.iconGlyph) {
    logo = `<span aria-hidden="true">${e.iconGlyph}</span>`;
  } else {
    logo = `<span>${escape(initialsFor(e.label))}</span>`;
  }
  // Verified entries get a gold-check; non-verified status (e.g.
  // "tx hash", "address", "block") gets the small text pill.
  const badge = e.badge === 'verified'
    ? goldCheckHTML()
    : (e.badge ? `<span class="search-result-badge">${escape(e.badge)}</span>` : '');
  return `
    <div class="search-result${isActive}" role="option" data-href="${escape(e.href)}" data-idx="${idx}">
      <div class="search-result-logo">${logo}</div>
      <div class="search-result-text">
        <div class="search-result-title">${escape(e.label)} ${badge}</div>
        <div class="search-result-sub">${escape(e.sub || '')}</div>
      </div>
    </div>
  `;
}

function paintActive() {
  dropdown.querySelectorAll('.search-result').forEach((el, i) => {
    el.classList.toggle('active', i === _dropdownActiveIdx);
  });
  // Scroll active into view.
  const active = dropdown.querySelector('.search-result.active');
  if (active) {
    const drect = dropdown.getBoundingClientRect();
    const arect = active.getBoundingClientRect();
    if (arect.bottom > drect.bottom) active.scrollIntoView({ block: 'nearest' });
    if (arect.top    < drect.top)    active.scrollIntoView({ block: 'nearest' });
  }
}

function closeDropdown() {
  dropdown.classList.remove('open');
  _dropdownEntries = [];
  _dropdownActiveIdx = -1;
}

function onSearchInput() {
  const q = (searchInput.value || '').trim();
  if (!q) { closeDropdown(); return; }
  const entries = searchLocal(q, 12);
  renderDropdown(entries);
}

function submitSearch() {
  // Prefer the highlighted dropdown entry; otherwise treat the
  // raw query as a free-text search (tx/block/address fallback).
  if (_dropdownActiveIdx >= 0 && _dropdownEntries[_dropdownActiveIdx]) {
    const href = _dropdownEntries[_dropdownActiveIdx].href;
    closeDropdown();
    location.hash = href.startsWith('#') ? href.slice(1) : href;
    location.hash = href.replace(/^#/, '');
    if (href.startsWith('#')) location.assign(href);
    return;
  }
  const q = (searchInput.value || '').trim();
  if (q) {
    closeDropdown();
    navigate('#/q/' + encodeURIComponent(q));
  }
}

// ── boot ───────────────────────────────────────────────────────────

window.addEventListener('hashchange', dispatch);

window.addEventListener('DOMContentLoaded', () => {
  // Search input — live dropdown + arrow-key nav + Enter to submit.
  if (searchInput) {
    searchInput.addEventListener('input', onSearchInput);
    searchInput.addEventListener('focus', () => {
      if ((searchInput.value || '').trim()) onSearchInput();
    });
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') {
        if (_dropdownEntries.length) {
          _dropdownActiveIdx = Math.min(_dropdownEntries.length - 1, _dropdownActiveIdx + 1);
          paintActive();
        }
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        if (_dropdownEntries.length) {
          _dropdownActiveIdx = Math.max(0, _dropdownActiveIdx - 1);
          paintActive();
        }
        e.preventDefault();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        submitSearch();
      } else if (e.key === 'Escape') {
        closeDropdown();
        searchInput.blur();
      }
    });
  }
  if (searchBtn)  searchBtn.addEventListener('click', submitSearch);
  if (searchForm) searchForm.addEventListener('submit', e => { e.preventDefault(); submitSearch(); });

  // Click a dropdown row → navigate.
  if (dropdown) {
    dropdown.addEventListener('click', e => {
      const row = e.target.closest('.search-result');
      if (!row) return;
      const href = row.dataset.href;
      if (href) {
        closeDropdown();
        searchInput.value = '';
        location.hash = href.replace(/^#/, '');
      }
    });
  }

  // Close dropdown on outside click.
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-form')) closeDropdown();
  });

  setupNetworkSwitch();  // reflect Mainnet/Testnet + wire the switch
  primeIndex();  // background-load custom tokens + sites
  probeSource().finally(() => {});
  dispatch();
});

// ── click-to-copy on .mono identifiers (kept from legacy) ──────────

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
