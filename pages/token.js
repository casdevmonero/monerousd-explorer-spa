// token.js — /token/<tokenId-or-symbol>
// Mirrors monerousd-explorer/views/token.ejs (legacy server-rendered view).
import { escapeHtml, formatAmount, VERIFIED_TOKENS, VERIFIED_BY_ADDR, isVerified, isCloneAttempt } from '../lib/helpers.js';

export async function renderToken({ ds, view }, idOrSymbol) {
  let token = null;
  let errorMsg = null;

  try {
    token = await ds.getToken(idOrSymbol);
  } catch (e) {
    errorMsg = e && e.message || String(e);
  }

  if (!token) {
    view.innerHTML = `<div class="error-box"><strong>Error:</strong> ${escapeHtml(errorMsg || 'Token not found')}</div>`;
    return;
  }

  const sym = token.symbol_public || token.symbol || '?';
  const name = token.name_public || token.name || 'Unknown Token';
  const tid = token.token_id || token.tokenId || '';
  const decimals = token.decimals != null ? token.decimals : 8;
  const maxSupply = token.max_supply || token.maxSupply || '0';
  const circSupply = token.circulating_supply || token.circulatingSupply || '0';
  const supplyRule = token.supply_rule || token.supplyRule || 'fixed';
  const bondPaid = token.bond_paid || token.bondPaid || '0';
  const createdBlock = token.creation_block || token.createdBlock || 0;
  const metadata = token.metadata_public || token.metadataPublic || null;

  const verified = isVerified(sym) || !!(tid && VERIFIED_BY_ADDR[tid]);
  const clone = !verified && isCloneAttempt(sym);
  const vInfo = verified ? (VERIFIED_TOKENS[sym] || VERIFIED_TOKENS[VERIFIED_BY_ADDR[tid]]) : null;

  view.innerHTML = `
    ${errorMsg ? `<div class="error-box"><strong>Error:</strong> ${escapeHtml(errorMsg)}</div>` : ''}

    <section>
      <div class="token-header-row">
        <img src="https://ion.monerousd.org/api/token-logo/${encodeURIComponent(tid || sym)}?v=6"
             alt="${escapeHtml(sym)}"
             onerror="this.style.display='none'"
             width="48" height="48"
             style="border-radius:8px;background:#1a1a1a;object-fit:contain" />
        <h2 style="margin:0">${escapeHtml(name)}</h2>
        ${verified
          ? `<span class="badge badge-verified badge-lg">&#10003; Official</span>`
          : clone
          ? `<span class="badge badge-clone-warning badge-lg">&#9888; Unofficial &mdash; not the official ${escapeHtml(sym)} token</span>`
          : `<span class="badge badge-community badge-lg">Community</span>`}
      </div>

      <div class="detail-table">
        <table>
          <tbody>
            <tr><td class="label">Token Address</td><td class="mono break-all">${escapeHtml(tid)}</td></tr>
            <tr><td class="label">Symbol</td><td class="mono">${escapeHtml(sym)}</td></tr>
            <tr><td class="label">Name</td><td>${escapeHtml(name)}</td></tr>
            <tr><td class="label">Decimals</td><td>${decimals}</td></tr>
            <tr><td class="label">Supply Rule</td><td>
              <span class="badge badge-supply-${escapeHtml(supplyRule)}">${escapeHtml(supplyRule)}</span>
              ${supplyRule === 'fixed' ? '<span class="muted">&mdash; all supply minted at creation</span>' : ''}
              ${supplyRule === 'mintable' ? '<span class="muted">&mdash; creator can mint more (50 bps fee per mint)</span>' : ''}
              ${supplyRule === 'deflationary' ? '<span class="muted">&mdash; burn-only after creation</span>' : ''}
            </td></tr>
            <tr><td class="label">Max Supply</td><td class="mono">${maxSupply === '0' || maxSupply === 0 ? 'Unlimited' : escapeHtml(formatAmount(maxSupply))}</td></tr>
            <tr><td class="label">Circulating</td><td class="mono">${escapeHtml(formatAmount(circSupply))}</td></tr>
            ${verified && vInfo ? `<tr><td class="label">Issuer</td><td>${escapeHtml(vInfo.issuer)}</td></tr>` : ''}
            <tr><td class="label">Creator</td><td class="muted">Stealth creator (privacy-preserving)</td></tr>
            ${createdBlock > 0 ? `<tr><td class="label">Created at Block</td><td><a href="#/block/${createdBlock}">${Number(createdBlock).toLocaleString()}</a></td></tr>` : ''}
            ${bondPaid !== '0' && bondPaid !== 0 ? `<tr><td class="label">Creation Bond</td><td>${escapeHtml(formatAmount(bondPaid))} USDm</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h3>Protocol Details</h3>
      <div class="detail-table">
        <table>
          <tbody>
            <tr><td class="label">Asset Type</td><td>Protocol-native asset (FCMP++ privacy)</td></tr>
            <tr><td class="label">Privacy</td><td>Amounts, senders, recipients, and asset type hidden via FCMP++ + CMAP</td></tr>
            <tr><td class="label">Pool Pairing</td><td>All pools pair against USDm (v1)</td></tr>
            ${verified ? `<tr><td class="label">Verification</td><td><span class="badge badge-verified">&#10003; Operator-verified</span> &mdash; hardcoded in protocol registry</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    </section>

    ${metadata ? `
      <section>
        <h3>Metadata</h3>
        <div class="detail-table">
          <table>
            <tbody>
              <tr><td class="label">Public Metadata</td><td class="mono break-all">${escapeHtml(typeof metadata === 'string' ? metadata : JSON.stringify(metadata))}</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    ` : ''}

    <section>
      <div class="privacy-note">
        <strong>Privacy:</strong> This is a privacy chain. Holder count is not displayed &mdash; individual holdings are hidden across stealth addresses. Supply totals are public; individual balances are not.
      </div>
    </section>
  `;
}
