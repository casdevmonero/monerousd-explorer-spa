// tokens.js — /tokens
// Token registry browser. Mirrors monerousd-explorer/views/tokens.ejs.
import { escapeHtml, formatAmount, badgeHtml, isVerified, shortAddr } from '../lib/helpers.js';

export async function renderTokens({ ds, view }) {
  // hash query string ?search=foo
  const hashQuery = (location.hash.split('?')[1] || '');
  const params = new URLSearchParams(hashQuery);
  const search = (params.get('search') || '').trim();

  let tokens = [];
  let errorMsg = null;
  try {
    const r = await ds.getTokens();
    tokens = Array.isArray(r) ? r : (r.tokens || r.items || []);
  } catch (e) {
    errorMsg = e && e.message || String(e);
  }

  // Filter on symbol or name (case-insensitive).
  if (search) {
    const needle = search.toLowerCase();
    tokens = tokens.filter(t => {
      const sym = (t.symbol_public || t.symbol || '').toLowerCase();
      const nam = (t.name_public || t.name || '').toLowerCase();
      return sym.includes(needle) || nam.includes(needle);
    });
  }

  // Verified-first sort.
  const verified = [];
  const community = [];
  tokens.forEach(t => {
    const sym = t.symbol_public || t.symbol || '';
    (isVerified(sym) ? verified : community).push(t);
  });
  const sorted = verified.concat(community);

  view.innerHTML = `
    <section>
      <h2>Token Registry</h2>
      <p class="muted" style="margin-bottom:16px;">All registered USDm-T1 tokens on MoneroUSD. Verified tokens are official protocol assets.</p>

      <form class="search-form token-search" id="tokens-search-form" style="max-width:400px;margin-bottom:20px;">
        <div class="search-wrapper">
          <input type="text" id="tokens-search-input" placeholder="Search by name or symbol" value="${escapeHtml(search)}" autocomplete="off">
        </div>
        <button type="submit">Search</button>
      </form>

      ${errorMsg ? `<div class="error-box"><strong>Error:</strong> ${escapeHtml(errorMsg)}</div>` : ''}

      ${sorted.length > 0 ? `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Badge</th>
              <th>Name</th>
              <th>Symbol</th>
              <th>Address</th>
              <th>Supply Rule</th>
              <th>Max Supply</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(t => {
              const sym = t.symbol_public || t.symbol || '?';
              const name = t.name_public || t.name || 'Unknown';
              const tid = t.token_id || t.tokenId || '';
              const supplyRule = t.supply_rule || t.supplyRule || 'fixed';
              const maxSupply = t.max_supply || t.maxSupply || '0';
              const createdBlock = t.creation_block || t.createdBlock || 0;
              return `
                <tr>
                  <td>${badgeHtml(sym)}</td>
                  <td><a href="#/token/${encodeURIComponent(tid || sym)}">${escapeHtml(name)}</a></td>
                  <td class="mono">${escapeHtml(sym)}</td>
                  <td class="mono muted" style="font-size:12px" title="${escapeHtml(tid)}" data-copy="${escapeHtml(tid)}">${escapeHtml(shortAddr(tid))}</td>
                  <td><span class="badge badge-supply-${escapeHtml(supplyRule)}">${escapeHtml(supplyRule)}</span></td>
                  <td class="mono">${maxSupply === '0' || maxSupply === 0 ? 'Unlimited' : escapeHtml(formatAmount(maxSupply))}</td>
                  <td>${createdBlock > 0 ? `<a href="#/block/${createdBlock}">${Number(createdBlock).toLocaleString()}</a>` : '—'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      ` : !errorMsg ? `<p class="muted">No tokens registered yet${search ? ' matching “' + escapeHtml(search) + '”' : ''}.</p>` : ''}
    </section>
  `;

  // Wire the search form
  const form = document.getElementById('tokens-search-form');
  const input = document.getElementById('tokens-search-input');
  if (form && input) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const q = (input.value || '').trim();
      location.hash = '#/tokens' + (q ? '?search=' + encodeURIComponent(q) : '');
    });
  }
}
