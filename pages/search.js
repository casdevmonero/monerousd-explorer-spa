// search.js — /q/<query>
// Heuristic dispatcher: figures out what the user typed (block height,
// tx hash, address, tokenId, contractId) and either redirects directly
// to the matching detail page or shows a list of candidate matches.
import { escapeHtml } from '../app.js';

export async function renderSearch({ ds, navigate, view }, rawQuery) {
  const q = decodeURIComponent(String(rawQuery || '')).trim();
  view.innerHTML = `
    <h1>Search</h1>
    <div class="section">
      <div class="kv">
        <div class="k">Query</div>
        <div class="v mono">${escapeHtml(q)}</div>
      </div>
    </div>
    <div class="section" id="search-results">Looking up…</div>
  `;
  const el = document.getElementById('search-results');

  if (!q) {
    el.innerHTML = '<div class="empty">Empty query.</div>';
    return;
  }

  // Numeric → block height
  if (/^\d+$/.test(q)) {
    navigate(`#/block/${encodeURIComponent(q)}`);
    return;
  }

  // 64-hex → could be a block hash or tx hash. Probe block first.
  if (/^[0-9a-fA-F]{64}$/.test(q)) {
    try {
      const b = await ds.getBlockByHash(q);
      if (b && (b.block_header || b)) {
        navigate(`#/block/${encodeURIComponent(q)}`);
        return;
      }
    } catch (_) { /* fall through to tx */ }
    navigate(`#/tx/${encodeURIComponent(q)}`);
    return;
  }

  // Starts with `ion1_` → custom-token id
  if (/^ion1_[0-9a-fA-F]+$/.test(q)) {
    navigate(`#/token/${encodeURIComponent(q)}`);
    return;
  }

  // Starts with `dc1_` → dark-contract id
  if (/^dc1_[0-9a-fA-F]+$/.test(q)) {
    navigate(`#/contract/${encodeURIComponent(q)}`);
    return;
  }

  // Looks like a stealth (long base58, 90+ chars)
  if (q.length >= 90 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(q)) {
    navigate(`#/address/${encodeURIComponent(q)}`);
    return;
  }

  // Symbol ticker (3-12 chars alphanum) — try as token symbol
  if (/^[A-Za-z0-9_-]{2,16}$/.test(q)) {
    try {
      const t = await ds.getToken(q);
      if (t && (t.tokenId || t.token_id)) {
        navigate(`#/token/${encodeURIComponent(q)}`);
        return;
      }
    } catch (_) {}
  }

  // Couldn't classify — show explanation + the formats we recognize
  el.innerHTML = `
    <div class="empty">
      Couldn't determine what to look up from <code>${escapeHtml(q)}</code>.
      <div class="hint" style="margin-top:12px;text-align:left;max-width:520px;margin-left:auto;margin-right:auto">
        Recognized formats:
        <ul style="margin-top:8px;line-height:1.7">
          <li><code>123456</code> — block height</li>
          <li><code>4fab2cfea54e7dd6…</code> (64 hex) — block or tx hash</li>
          <li><code>ion1_…</code> — token id</li>
          <li><code>dc1_…</code> — dark-contract id</li>
          <li><code>4Abc…</code> (90+ base58) — stealth address</li>
          <li><code>USDm</code>, <code>wBTC</code>, etc. — verified token symbol</li>
        </ul>
      </div>
    </div>
  `;
}
