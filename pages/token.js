// token.js — /token/<tokenId-or-symbol>
import { escapeHtml } from '../app.js';

export async function renderToken({ ds, view }, idOrSym) {
  view.innerHTML = `<h1>Token</h1><div class="section" id="token-body">Loading…</div>`;
  const el = document.getElementById('token-body');
  try {
    const t = await ds.getToken(idOrSym);
    el.innerHTML = `
      <div class="kv">
        <div class="k">Symbol</div>
        <div class="v mono">${escapeHtml(t.symbol_public ?? t.symbol ?? '—')}</div>
        <div class="k">Name</div>
        <div class="v">${escapeHtml(t.name ?? '—')}</div>
        <div class="k">Token ID</div>
        <div class="v mono">${escapeHtml(t.tokenId ?? t.token_id ?? '—')}</div>
        <div class="k">Decimals</div>
        <div class="v mono">${escapeHtml(String(t.decimals ?? 8))}</div>
        <div class="k">Max supply</div>
        <div class="v mono">${escapeHtml(t.max_supply ?? '—')}</div>
        <div class="k">Circulating</div>
        <div class="v mono">${escapeHtml(t.circulating_supply ?? '—')}</div>
        ${t.creator_stealth ? `<div class="k">Creator</div><div class="v mono"><a href="#/address/${escapeHtml(t.creator_stealth)}">${escapeHtml(ds.shortHash(t.creator_stealth))}</a></div>` : ''}
      </div>
    `;
  } catch (e) {
    el.innerHTML = `<div class="error">${escapeHtml(e.message)}</div>`;
  }
}
