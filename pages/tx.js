// tx.js — /tx/<hash>
//
// Decodes the carrier-tx tx_extra for `ion://op/v1?` attestations
// (token transfers, LP ops, bridge ops, DC calls, site publishes,
// validator bonds, governance proposals, BINARY_RELEASE, etc.).
// The chain has zero-or-more attestations per tx; we surface them
// with a deep-link to the relevant detail page.
import { escapeHtml } from '../app.js';

const ATT_RE = /ion:\/\/op\/v1\?[^\s\0]+/g;

function tryDecodeAttestation(extraStr) {
  // A minimal decoder mirroring dapp-browser/attestation.js. We
  // don't bring the full module in — we just want the op + payload
  // for human display.
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
  // tx_extra is a hex string in get_transactions output. Decode to
  // bytes, convert to UTF-8 for the substring scan, regex-match.
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
  view.innerHTML = `<h1>Transaction</h1><div class="section" id="tx-body">Loading…</div>`;
  const el = document.getElementById('tx-body');

  if (!/^[0-9a-fA-F]{64}$/.test(hash)) {
    el.innerHTML = '<div class="error">Not a valid 32-byte tx hash.</div>';
    return;
  }

  try {
    const r = await ds.getTransactions([hash]);
    const tx = (r && (r.txs && r.txs[0])) || (r && r.txs_as_json && JSON.parse(r.txs_as_json[0])) || null;
    if (!tx) { el.innerHTML = '<div class="error">Transaction not found.</div>'; return; }

    const txInfo = tx.as_json ? JSON.parse(tx.as_json) : tx;
    const fee = txInfo.rct_signatures?.txnFee ?? '—';
    const block_height = tx.block_height ?? '—';
    const inputCount = txInfo.vin?.length ?? '—';
    const outputCount = txInfo.vout?.length ?? '—';

    const attestations = extractAttestationsFromExtra(txInfo.extra ?? tx.extra);

    el.innerHTML = `
      <div class="kv">
        <div class="k">Tx hash</div>
        <div class="v mono">${escapeHtml(hash)}</div>
        <div class="k">In block</div>
        <div class="v mono">
          ${block_height === '—' ? '— (in mempool)' : `<a href="#/block/${escapeHtml(String(block_height))}">${escapeHtml(String(block_height))}</a>`}
        </div>
        <div class="k">Inputs</div>
        <div class="v mono">${escapeHtml(String(inputCount))}</div>
        <div class="k">Outputs</div>
        <div class="v mono">${escapeHtml(String(outputCount))}</div>
        <div class="k">Fee</div>
        <div class="v mono">${escapeHtml(ds.fmtUsd8(fee))} USDm</div>
      </div>

      <h2>Protocol attestations</h2>
      ${attestations.length === 0 ?
        '<div class="empty">No <code>ion://op/v1?</code> attestations decoded from tx_extra.<div class="hint">This is a plain USDm transfer with no protocol op attached.</div></div>' :
        renderAttestations(attestations)}
    `;
  } catch (e) {
    el.innerHTML = `<div class="error">${escapeHtml(e.message)}</div>`;
  }
}

function renderAttestations(arr) {
  return arr.map((a, i) => {
    const code = a.code || '?';
    const payloadJson = JSON.stringify(a.payload, null, 2);
    return `
      <div class="section">
        <div class="kv">
          <div class="k">Op code</div>
          <div class="v mono"><strong>${escapeHtml(code)}</strong></div>
          ${renderPayloadDeepLinks(code, a.payload)}
        </div>
        <details style="margin-top:12px">
          <summary class="muted">Raw payload</summary>
          <pre class="mono" style="overflow:auto;background:var(--bg-elevated);padding:12px;border-radius:8px;font-size:12px">${escapeHtml(payloadJson)}</pre>
        </details>
      </div>
    `;
  }).join('');
}

function renderPayloadDeepLinks(code, p) {
  const out = [];
  if (p?.tokenId) out.push(['Token', `<a href="#/token/${escapeHtml(p.tokenId)}" class="mono">${escapeHtml(p.tokenId)}</a>`]);
  if (p?.poolId)  out.push(['Pool',  `<a href="#/pool/${escapeHtml(p.poolId)}" class="mono">${escapeHtml(p.poolId)}</a>`]);
  if (p?.contractId) out.push(['Contract', `<a href="#/contract/${escapeHtml(p.contractId)}" class="mono">${escapeHtml(p.contractId)}</a>`]);
  if (p?.destStealth) out.push(['Dest', `<a href="#/address/${escapeHtml(p.destStealth)}" class="mono">${escapeHtml(p.destStealth.slice(0,18) + '…')}</a>`]);
  if (p?.amount) out.push(['Amount', `<span class="mono">${escapeHtml(p.amount)}</span>`]);
  return out.map(([k, v]) => `<div class="k">${escapeHtml(k)}</div><div class="v">${v}</div>`).join('');
}
