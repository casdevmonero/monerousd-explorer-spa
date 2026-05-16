// pages/token.js — Token detail page.
//
// Resolves a token from EITHER its tokenId (ion1_...) OR its
// symbol (e.g. wBTC). The indexer's /v1/tokens/<id> handles both.
// If the indexer is offline AND the symbol matches our verified
// registry, we fall back to the registry entry so verified tokens
// (USDm, every wrapper) always render — never blank.
//
// Verified tokens get the gold Twitter/X-style check next to their
// name in the hero AND a "Operator-verified" pill in the Protocol
// Details section. Clone-name attempts get a red warning instead.

import {
  escapeHtml, formatAmount, VERIFIED_TOKENS, VERIFIED_BY_ADDR,
  isVerified, isCloneAttempt, goldCheckHTML,
} from '../lib/helpers.js';
import {
  VERIFIED_TOKENS as REG_TOKENS, WRAPPED_ASSETS, logoUrlFor,
} from '../lib/registries.js';

export async function renderToken({ ds, view }, idOrSymbol) {
  let token = null;
  let errorMsg = null;

  try {
    token = await ds.getToken(idOrSymbol);
  } catch (e) {
    errorMsg = e?.message || String(e);
  }

  // Fallback: build a registry entry if the indexer didn't return.
  if (!token) {
    const key = String(idOrSymbol).toLowerCase();
    const reg = REG_TOKENS.find(t => t.symbol.toLowerCase() === key || t.tokenId === idOrSymbol)
             || WRAPPED_ASSETS.find(w => w.symbol.toLowerCase() === key || w.tokenId === idOrSymbol);
    if (reg) {
      token = {
        symbol: reg.symbol,
        name: reg.name,
        tokenId: reg.tokenId,
        _registryFallback: true,
        _issuer: reg.issuer,
        _wrapped: !!reg.homeChain,
        _homeChain: reg.homeChain,
        _description: reg.description,
      };
      errorMsg = null;
    }
  }

  if (!token) {
    view.innerHTML = `
      <div class="error-box">
        <strong>Token not found</strong>
        <p>${escapeHtml(errorMsg || 'No token matches <code>' + idOrSymbol + '</code> on the federated indexer.')}</p>
      </div>
      <div class="hint" style="margin-top:12px"><a href="#/tokens">← All tokens</a></div>
    `;
    return;
  }

  const sym = token.symbol_public || token.symbol || '?';
  const name = token.name_public || token.name || 'Unknown Token';
  const tid = token.token_id || token.tokenId || '';
  const decimals = token.decimals != null ? token.decimals : 8;
  const maxSupply = token.max_supply || token.maxSupply || '0';
  const circSupply = token.circulating_supply || token.circulatingSupply || '0';
  const supplyRule = token.supply_rule || token.supplyRule || (token._wrapped ? 'mintable' : 'fixed');
  const bondPaid = token.bond_paid || token.bondPaid || '0';
  const createdBlock = token.creation_block || token.createdBlock || 0;
  const metadata = token.metadata_public || token.metadataPublic || null;

  const verified = isVerified(sym) || !!(tid && VERIFIED_BY_ADDR[tid]);
  const clone = !verified && isCloneAttempt(sym);
  const vInfo = verified
    ? (VERIFIED_TOKENS[sym] || VERIFIED_TOKENS[VERIFIED_BY_ADDR[tid]] || {
        issuer: token._issuer || 'MoneroUSD',
        verified: true,
      })
    : null;

  const logoUrl = logoUrlFor({ symbol: sym, tokenId: tid });
  const wrappedHomeChain = token._homeChain
    || WRAPPED_ASSETS.find(w => w.symbol === sym)?.homeChain;

  view.innerHTML = `
    <header class="hero" style="padding:30px 32px">
      <span class="hero-eyebrow">${escapeHtml(wrappedHomeChain ? 'Wrapped asset · ' + wrappedHomeChain : (verified ? 'Verified token' : 'On-chain token'))}</span>
      <h1 style="font-size:1.6rem;display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:6px">
        <span class="entity-logo" style="width:52px;height:52px;font-size:18px;background:rgba(255,102,0,0.10)">
          <img src="${escapeHtml(logoUrl)}" alt=""
               onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${escapeHtml((sym||'?').slice(0,2).toUpperCase())}'}))">
        </span>
        <span style="display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap">
          ${escapeHtml(name)}
          ${verified ? goldCheckHTML('xl') : ''}
          ${clone ? '<span class="badge badge-warning" style="font-size:11px">⚠ unofficial</span>' : ''}
          ${token._registryFallback ? '<span class="badge badge-muted" style="font-size:11px">indexer offline · registry</span>' : ''}
        </span>
      </h1>
      <p style="margin-top:8px;color:var(--text-secondary)">
        ${token._description
          ? escapeHtml(token._description)
          : (verified
              ? 'Verified on chain. The gold check is operator-curated; clone-name attempts surface a red warning instead.'
              : (clone
                  ? '⚠ This token shares a symbol with a verified asset but is NOT the official one. Always double-check the tokenId before transacting.'
                  : 'Community-issued token on MoneroUSD.'))}
      </p>
      <div class="hero-stats">
        <div class="hero-stat">
          <div class="hero-stat-label">Symbol</div>
          <div class="hero-stat-value">${escapeHtml(sym)}</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">Decimals</div>
          <div class="hero-stat-value">${decimals}</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">Supply rule</div>
          <div class="hero-stat-value" style="font-size:1rem;text-transform:capitalize">${escapeHtml(supplyRule)}</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">Max supply</div>
          <div class="hero-stat-value">${maxSupply === '0' || maxSupply === 0 ? 'Unlimited' : escapeHtml(formatAmount(maxSupply))}</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">Circulating</div>
          <div class="hero-stat-value">${escapeHtml(formatAmount(circSupply))}</div>
        </div>
      </div>
    </header>

    <section class="card">
      <div class="card-header"><h2>Token details</h2></div>
      <dl class="kv-table">
        <dt>Name</dt>           <dd>${escapeHtml(name)} ${verified ? goldCheckHTML() : ''}</dd>
        <dt>Symbol</dt>         <dd class="mono">${escapeHtml(sym)}</dd>
        <dt>Token id</dt>       <dd class="mono">${escapeHtml(tid)}</dd>
        <dt>Decimals</dt>       <dd>${decimals}</dd>
        <dt>Supply rule</dt>    <dd>
          <span class="badge badge-supply-${escapeHtml(supplyRule)}">${escapeHtml(supplyRule)}</span>
          ${supplyRule === 'fixed' ? '<span class="muted" style="margin-left:6px">— all supply minted at creation</span>' : ''}
          ${supplyRule === 'mintable' ? '<span class="muted" style="margin-left:6px">— creator can mint more (50 bps fee per mint)</span>' : ''}
          ${supplyRule === 'deflationary' ? '<span class="muted" style="margin-left:6px">— burn-only after creation</span>' : ''}
        </dd>
        <dt>Max supply</dt>     <dd class="mono">${maxSupply === '0' || maxSupply === 0 ? 'Unlimited' : escapeHtml(formatAmount(maxSupply))}</dd>
        <dt>Circulating</dt>    <dd class="mono">${escapeHtml(formatAmount(circSupply))}</dd>
        ${verified && vInfo ? `<dt>Issuer</dt><dd>${escapeHtml(vInfo.issuer || '')}${vInfo.org ? ` · <a href="#/org/${escapeHtml(vInfo.org)}">profile →</a>` : ''}</dd>` : ''}
        ${wrappedHomeChain ? `<dt>Home chain</dt><dd><strong>${escapeHtml(wrappedHomeChain)}</strong></dd>` : ''}
        <dt>Creator</dt>        <dd style="color:var(--text-muted)">Stealth creator (privacy-preserving)</dd>
        ${createdBlock > 0 ? `<dt>Created at</dt><dd>Block <a href="#/block/${createdBlock}">${Number(createdBlock).toLocaleString('en-US')}</a></dd>` : ''}
        ${bondPaid !== '0' && bondPaid !== 0 ? `<dt>Creation bond</dt><dd>${escapeHtml(formatAmount(bondPaid))} USDm</dd>` : ''}
      </dl>
    </section>

    <section class="card">
      <div class="card-header"><h2>Protocol details</h2></div>
      <dl class="kv-table">
        <dt>Asset type</dt>   <dd>Protocol-native asset (FCMP++ + Seraphis privacy)</dd>
        <dt>Privacy</dt>      <dd>Amounts · senders · recipients · asset type all <a href="#/privacy">concealed by design</a>.</dd>
        <dt>Pool pairing</dt> <dd>Every pool pairs against USDm (v1).</dd>
        ${verified ? `<dt>Verification</dt><dd>${goldCheckHTML()} <span style="margin-left:4px">Operator-verified — hardcoded in the protocol registry</span></dd>` : ''}
      </dl>
    </section>

    ${metadata ? `
      <section class="card">
        <div class="card-header"><h2>Metadata</h2></div>
        <dl class="kv-table">
          <dt>Public metadata</dt><dd class="mono">${escapeHtml(typeof metadata === 'string' ? metadata : JSON.stringify(metadata))}</dd>
        </dl>
      </section>
    ` : ''}

    <section class="card">
      <div class="card-header"><h2>Privacy note</h2></div>
      <p style="margin:0;font-size:13px;color:var(--text-secondary);line-height:1.6">
        This is a privacy chain. Holder count is not displayed —
        individual holdings are hidden across stealth addresses. Supply
        totals are public; individual balances are not.
        <a href="#/privacy">Why? →</a>
      </p>
    </section>
  `;
}
