// tx.js — /tx/<hash>
//
// Decodes the carrier-tx tx_extra for `ion://op/v1?` attestations
// (token transfers, LP ops, bridge ops, DC calls, site publishes,
// validator bonds, governance proposals, BINARY_RELEASE, etc.).
// The chain has zero-or-more attestations per tx; we surface them
// with deep-links to the relevant detail page.
//
// Ported to the legacy detail-table design (monerousd-explorer/views/tx.ejs).
import { escapeHtml, formatAmount, shortAddr, timeSince } from '../lib/helpers.js';

const ATT_RE = /ion:\/\/op\/v1\?[^\s\0]+/g;

function tryDecodeAttestation(extraStr) {
  try {
    if (!extraStr.startsWith('ion://op/v1?')) return null;
    const params = new URLSearchParams(extraStr.slice('ion://op/v1?'.length));
    const code = params.get('code');
    const payloadB64u = params.get('payload') || '';
    let payload = {};
    if (payloadB64u) {
      const b64 = payloadB64u.replace(/-/g, '+').replace(/_/g, '/');
      const pad = b64.length % 4 ? '='.repeat(4 - b64.length % 4) : '';
      try { payload = JSON.parse(atob(b64 + pad)); } catch (_) {}
    }
    return { code, payload };
  } catch (_) { return null; }
}

function extractAttestationsFromExtra(extraField) {
  if (!extraField) return [];
  let bytes;
  if (typeof extraField === 'string') {
    if (/^[0-9a-fA-F]+$/.test(extraField) && extraField.length % 2 === 0) {
      bytes = new Uint8Array(extraField.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(extraField.substr(i * 2, 2), 16);
      }
    } else { bytes = new TextEncoder().encode(extraField); }
  } else if (Array.isArray(extraField)) {
    bytes = new Uint8Array(extraField);
  } else { return []; }

  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const out = [];
  let m;
  while ((m = ATT_RE.exec(text)) !== null) {
    const decoded = tryDecodeAttestation(m[0]);
    if (decoded) out.push(decoded);
  }
  ATT_RE.lastIndex = 0;
  return out;
}

export async function renderTx({ ds, view }, hash) {
  if (!/^[0-9a-fA-F]{64}$/.test(hash)) {
    view.innerHTML = `<div class="error-box"><strong>Error:</strong> Not a valid 32-byte tx hash.</div>`;
    return;
  }

  let tx = null;
  let txInfo = null;
  let errorMsg = null;
  try {
    const r = await ds.getTransactions([hash]);
    tx = (r && r.txs && r.txs[0]) || null;
    if (!tx && r && r.txs_as_json && r.txs_as_json[0]) {
      tx = { as_json: r.txs_as_json[0] };
    }
    if (!tx) throw new Error('Transaction not found');
    txInfo = tx.as_json ? JSON.parse(tx.as_json) : tx;
  } catch (e) {
    errorMsg = e && e.message || String(e);
  }

  if (errorMsg) {
    view.innerHTML = `<div class="error-box"><strong>Error:</strong> ${escapeHtml(errorMsg)}</div>`;
    return;
  }

  const fee         = txInfo.rct_signatures?.txnFee ?? tx.fee ?? 0;
  const blockHeight = tx.block_height;
  const blockTime   = tx.block_timestamp;
  const inputCount  = txInfo.vin?.length ?? '?';
  const outputCount = txInfo.vout?.length ?? '?';
  const size        = tx.size || tx.tx_size || null;
  const inPool      = blockHeight == null || blockHeight === -1;

  const attestations = extractAttestationsFromExtra(txInfo.extra ?? tx.extra);

  view.innerHTML = `
    <section>
      <h2>Transaction</h2>
      <div class="detail-table">
        <table>
          <tbody>
            <tr><td class="label">Hash</td><td class="mono break-all">${escapeHtml(hash)}</td></tr>
            <tr><td class="label">Status</td><td>${inPool ? '<span class="badge badge-warn">In Mempool</span>' : `<a href="#/block/${escapeHtml(String(blockHeight))}">Block ${Number(blockHeight).toLocaleString()}</a>${blockTime ? ` <span class="muted">(${escapeHtml(timeSince(blockTime))})</span>` : ''}`}</td></tr>
            <tr><td class="label">Inputs</td><td>${escapeHtml(String(inputCount))}</td></tr>
            <tr><td class="label">Outputs</td><td>${escapeHtml(String(outputCount))}</td></tr>
            <tr><td class="label">Fee</td><td>${escapeHtml(formatAmount(fee))} USDm</td></tr>
            ${size ? `<tr><td class="label">Size</td><td>${(size / 1024).toFixed(2)} KB</td></tr>` : ''}
            ${txInfo.unlock_time != null ? `<tr><td class="label">Unlock time</td><td>${escapeHtml(String(txInfo.unlock_time))}</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h3>Protocol Attestations</h3>
      ${attestations.length === 0 ?
        '<p class="muted">No <code>ion://op/v1?</code> attestations decoded from tx_extra. This is a plain USDm transfer with no protocol op attached.</p>' :
        renderAttestations(attestations)}
    </section>
  `;
}

function renderAttestations(arr) {
  return arr.map((a) => {
    const code = a.code || '?';
    const payloadJson = JSON.stringify(a.payload, null, 2);
    const rows = renderPayloadDeepLinks(a.payload);
    return `
      <div class="detail-table" style="margin-bottom:14px">
        <table>
          <tbody>
            <tr><td class="label">Op Code</td><td><span class="badge">${escapeHtml(code)}</span></td></tr>
            ${rows}
          </tbody>
        </table>
      </div>
      <details style="margin: -6px 0 18px 0">
        <summary class="muted" style="cursor:pointer;font-size:0.85rem">Raw payload</summary>
        <pre class="mono" style="overflow:auto;background:var(--bg-card);border:1px solid var(--border);padding:12px;border-radius:6px;font-size:12px;margin-top:8px">${escapeHtml(payloadJson)}</pre>
      </details>
    `;
  }).join('');
}

function renderPayloadDeepLinks(p) {
  if (!p) return '';
  const rows = [];
  if (p.tokenId)      rows.push(['Token',    `<a href="#/token/${encodeURIComponent(p.tokenId)}" class="mono">${escapeHtml(p.tokenId)}</a>`]);
  if (p.poolId)       rows.push(['Pool',     `<a href="#/pool/${encodeURIComponent(p.poolId)}" class="mono">${escapeHtml(p.poolId)}</a>`]);
  if (p.contractId)   rows.push(['Contract', `<a href="#/contract/${encodeURIComponent(p.contractId)}" class="mono">${escapeHtml(p.contractId)}</a>`]);
  if (p.destStealth)  rows.push(['Dest',     `<a href="#/address/${encodeURIComponent(p.destStealth)}" class="mono">${escapeHtml(shortAddr(p.destStealth))}</a>`]);
  if (p.amount)       rows.push(['Amount',   `<span class="mono">${escapeHtml(String(p.amount))}</span>`]);
  if (p.entrypoint)   rows.push(['Entrypoint', `<span class="mono">${escapeHtml(p.entrypoint)}</span>`]);
  if (p.symbol)       rows.push(['Symbol',   `<span class="mono">${escapeHtml(p.symbol)}</span>`]);
  if (p.version)      rows.push(['Version',  `<span class="mono">${escapeHtml(String(p.version))}</span>`]);
  return rows.map(([k, v]) => `<tr><td class="label">${escapeHtml(k)}</td><td>${v}</td></tr>`).join('');
}
