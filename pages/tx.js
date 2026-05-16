// pages/tx.js — Transaction detail page (FCMP++-aware).
//
// MoneroUSD uses FCMP++ (Full-Chain Membership Proof Plus Plus)
// for membership-of-input proofs. That replaces the legacy MLSAG
// ring signature + Borromean rangeproof combo. This page surfaces
// the FCMP++-specific structures when present:
//
//   • Membership proof: vin[*].fcmp_pp.proof  (curve-tree path
//     proving the spent output existed somewhere in the tree
//     without revealing WHERE it was — that's the "concealed" part).
//   • Key image: vin[*].key.k_image  (one-time identifier proving
//     non-double-spend; opaque w.r.t. sender identity).
//   • Output one-time keys: vout[*].target.key.
//   • Range proofs: rct_signatures.rangeSigs / .Bulletproofs+.
//   • Confidential commitments: vout commitments (amount hidden).
//
// All of these are PUBLIC on chain but UNLINKABLE without view
// keys — see /privacy for the full table of concealed vs public.

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

// FCMP++ + RingCT detection helpers ---------------------------------

// Resolves the rct_signatures.type to a human label.
//
// MoneroUSD descends from Haven (Monero fork) and uses its own RCT
// type ladder. Type 11 is the live FCMP++ + Seraphis-tagged-output
// type — what every recent tx on chain looks like. Pre-fork types
// stay supported below for back-compat.
//
//   0  null              (coinbase)
//   1  full              (legacy)
//   2  simple            (legacy)
//   3  bulletproof       (legacy)
//   4  bulletproof2
//   5  CLSAG + Bulletproof
//   6  Bulletproof+
//   7  CLSAG + Bulletproof+
//   8  RCT FCMP++  (mainline Monero anticipated number)
//   9, 10  intermediate Haven types
//   11 FCMP++ + Seraphis tagged outputs (USDmd post-fork)
function rctTypeLabel(t) {
  return ({
    0: 'Coinbase',
    1: 'RCT-Full (legacy)',
    2: 'RCT-Simple (legacy)',
    3: 'Bulletproof',
    4: 'Bulletproof v2',
    5: 'CLSAG + Bulletproof',
    6: 'Bulletproof+',
    7: 'CLSAG + Bulletproof+',
    8: 'FCMP++',
    9: 'Haven RCT v9',
    10: 'Haven RCT v10',
    11: 'FCMP++ · Seraphis',
  })[t] || (t != null ? 'RCT v' + t : 'unknown');
}

// True if the tx carries any FCMP++ artifact. USDmd writes the
// proof under `rctsig_prunable.fcmp_proof` + a tree root under
// `.fcmp_tree_root`. The vin entries also use `haven_key` /
// `haven_seraphis_tagged_key` shapes — both signal the new format.
function detectFcmpPP(txInfo) {
  const rsp = txInfo?.rctsig_prunable || {};
  if (rsp.fcmp_proof || rsp.fcmp_tree_root || rsp.fcmp_layers ||
      rsp.fcmp_key_images || rsp.fcmp_c_tildes) return true;
  const t = txInfo?.rct_signatures?.type;
  if (t === 7 || t === 8 || t === 11) return true;
  // Per-input shape sniff (kept for forward compat).
  const vin = txInfo?.vin || [];
  for (const v of vin) {
    if (!v) continue;
    if (v.fcmp_pp || v.fcmp_plus_plus) return true;
    if (v.key && v.key.fcmp_pp) return true;
  }
  return false;
}

// Extract the key image from a vin entry, regardless of shape.
// USDmd post-fork uses `haven_key.k_image`. Pre-fork Monero
// uses `key.k_image`. Coinbase has neither (`gen`).
function extractKeyImage(v) {
  if (!v) return null;
  if (v.gen) return '(coinbase)';
  return v.haven_key?.k_image
      || v.key?.k_image
      || v.k_image
      || v.key_image
      || null;
}

// Extract one-time stealth pubkey + commitment + asset type from
// a vout entry. USDmd uses `haven_seraphis_tagged_key`; legacy
// Monero uses `tagged_key` or `key`.
function extractOutput(o) {
  const tgt = o?.target || {};
  const tk  = tgt.haven_seraphis_tagged_key
           || tgt.tagged_key
           || tgt;
  return {
    key:        tk.key  || (typeof tk === 'string' ? tk : null),
    input_key:  tk.input_key  || null,
    commitment: tk.commitment || o?.amount_commitment || null,
    asset_type: tk.asset_type || o?.asset_type || null,
    view_tag:   tk.view_tag   || null,
    unlock_time: tk.unlock_time,
    is_collateral: tk.is_collateral === '01' || tk.is_collateral === true,
  };
}

function keyImageHTML(vin) {
  if (!vin) return '';
  return vin.map((v, i) => {
    const ki = extractKeyImage(v);
    if (!ki) return '';
    const assetType = v?.haven_key?.asset_type || v?.asset_type;
    const numOffsets = v?.haven_key?.key_offsets?.length || v?.key?.key_offsets?.length || 0;
    return `
      <tr>
        <td class="num" style="color:var(--text-muted);font-size:11px;font-family:var(--font-mono)">${i}</td>
        <td class="mono break-all" style="font-size:12px">${escapeHtml(ki)}</td>
        <td>${assetType ? `<span class="badge badge-muted">${escapeHtml(assetType)}</span>` : '—'}</td>
        <td class="num" style="color:var(--text-muted);font-size:11px">${numOffsets || '—'}</td>
      </tr>
    `;
  }).join('');
}

function outputKeysHTML(vout) {
  if (!vout) return '';
  return vout.map((o, i) => {
    const e = extractOutput(o);
    return `
      <tr>
        <td class="num" style="color:var(--text-muted);font-size:11px;font-family:var(--font-mono)">${i}</td>
        <td class="mono break-all" style="font-size:12px">${escapeHtml(e.key || '—')}</td>
        <td class="mono break-all" style="font-size:11px;color:var(--text-muted)">${escapeHtml(e.commitment || '—')}</td>
        <td>${e.asset_type ? `<span class="badge badge-muted">${escapeHtml(e.asset_type)}</span>` : '—'}</td>
        <td style="color:var(--text-muted);font-size:11px;font-family:var(--font-mono)">${escapeHtml(e.view_tag || '—')}</td>
      </tr>
    `;
  }).join('');
}

// ── render entry point ─────────────────────────────────────────────

export async function renderTx({ ds, view }, hash) {
  if (!/^[0-9a-fA-F]{64}$/.test(hash)) {
    view.innerHTML = `<div class="error-box"><strong>Invalid tx hash</strong>
      <p>Expected 64 hex characters (32 bytes), got ${hash.length}.</p></div>`;
    return;
  }

  let tx = null, txInfo = null, errorMsg = null;
  try {
    const r = await ds.getTransactions([hash]);
    tx = (r && r.txs && r.txs[0]) || null;
    if (!tx && r && r.txs_as_json && r.txs_as_json[0]) {
      tx = { as_json: r.txs_as_json[0] };
    }
    if (!tx) throw new Error('Transaction not found');
    txInfo = tx.as_json ? JSON.parse(tx.as_json) : tx;
  } catch (e) {
    errorMsg = e?.message || String(e);
  }

  if (errorMsg) {
    view.innerHTML = `<div class="error-box"><strong>Error</strong><p>${escapeHtml(errorMsg)}</p></div>`;
    return;
  }

  // ── extract universal fields ─────────────────────────────────────
  const fee         = txInfo.rct_signatures?.txnFee ?? tx.fee ?? 0;
  const blockHeight = tx.block_height;
  const blockTime   = tx.block_timestamp;
  const inputCount  = txInfo.vin?.length ?? 0;
  const outputCount = txInfo.vout?.length ?? 0;
  const size        = tx.size || tx.tx_size || null;
  const inPool      = blockHeight == null || blockHeight === -1;
  const rctType     = txInfo?.rct_signatures?.type;
  const isFcmp      = detectFcmpPP(txInfo);
  const version     = txInfo?.version;
  const unlock      = txInfo?.unlock_time;

  // ── extract Bulletproof+ + range proof stats ────────────────────
  const rs = txInfo?.rct_signatures || {};
  const rsp = txInfo?.rctsig_prunable || tx?.rctsig_prunable || {};
  const bpp = rsp.bpp || rsp.bulletproofs_plus || rs.bpp || rs.bulletproofs_plus || [];
  const numBpp = Array.isArray(bpp) ? bpp.length : (bpp ? 1 : 0);
  const nbp = rsp.nbp || (rsp.bpp ? rsp.bpp.length : 0);
  const clsags = rsp.CLSAGs || rs.CLSAGs || [];
  const numClsags = Array.isArray(clsags) ? clsags.length : 0;
  // USDmd FCMP++ shape — see `rctsig_prunable` keys returned by
  // `get_transactions`. The `fcmp_key_images` array is the per-input
  // image; `fcmp_proof` is the aggregate membership proof binding
  // all inputs to the tree root.
  const fcmpKeyImages   = rsp.fcmp_key_images || [];
  const fcmpCTildes     = rsp.fcmp_c_tildes || [];
  const fcmpLayers      = rsp.fcmp_layers || [];
  const fcmpTreeRoot    = rsp.fcmp_tree_root || null;
  const fcmpTreeRootTy  = rsp.fcmp_tree_root_type || null;
  const fcmpProof       = rsp.fcmp_proof || null;
  const numFcmpProofs   = Array.isArray(fcmpKeyImages) ? fcmpKeyImages.length
                       : (isFcmp ? inputCount : 0);

  const attestations = extractAttestationsFromExtra(txInfo.extra ?? tx.extra);

  // ── render: hero + overview + privacy summary + FCMP++ proofs +
  //           inputs (key images) + outputs (one-time keys) +
  //           protocol attestations ──────────────────────────────────
  view.innerHTML = `
    <header class="hero" style="padding:24px 28px">
      <span class="hero-eyebrow">Transaction</span>
      <h1 style="font-size:1.4rem">
        <code class="mono" style="font-size:1rem">${escapeHtml(shortAddr(hash, 14, 10))}</code>
      </h1>
      <p style="margin-top:6px;color:var(--text-secondary)">
        ${inPool
          ? '<span class="badge badge-warning">In mempool</span> Awaiting block inclusion.'
          : `Included in <a href="#/block/${escapeHtml(String(blockHeight))}">block #${Number(blockHeight).toLocaleString()}</a> ${blockTime ? `<span style="color:var(--text-muted)">(${escapeHtml(timeSince(blockTime))})</span>` : ''}`}
      </p>
      <div class="hero-stats">
        <div class="hero-stat">
          <div class="hero-stat-label">Type</div>
          <div class="hero-stat-value" style="font-size:0.95rem">${escapeHtml(rctTypeLabel(rctType))}</div>
          <div class="hero-stat-sub">${isFcmp ? 'FCMP++ proof' : 'RingCT'}</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">Fee</div>
          <div class="hero-stat-value">${escapeHtml(formatAmount(fee))} <span style="font-size:11px;color:var(--text-muted)">USDm</span></div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">Inputs</div>
          <div class="hero-stat-value">${inputCount}</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">Outputs</div>
          <div class="hero-stat-value">${outputCount}</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">Size</div>
          <div class="hero-stat-value" style="font-size:1rem">${size ? (size / 1024).toFixed(2) + ' KB' : '—'}</div>
        </div>
      </div>
    </header>

    <section class="card">
      <div class="card-header"><h2>Overview</h2></div>
      <dl class="kv-table">
        <dt>Hash</dt>            <dd class="mono">${escapeHtml(hash)}</dd>
        <dt>Status</dt>          <dd>${inPool ? '<span class="badge badge-warning">In mempool</span>' : `<a href="#/block/${escapeHtml(String(blockHeight))}">block #${Number(blockHeight).toLocaleString()}</a> ${blockTime ? `<span style="color:var(--text-muted)">${escapeHtml(timeSince(blockTime))}</span>` : ''}`}</dd>
        <dt>Tx version</dt>      <dd>${escapeHtml(String(version ?? '—'))}</dd>
        <dt>RCT type</dt>        <dd>${escapeHtml(rctTypeLabel(rctType))} ${rctType != null ? `<span style="color:var(--text-muted);font-size:11px">(type=${rctType})</span>` : ''}</dd>
        <dt>Privacy</dt>         <dd>${isFcmp
          ? '<span class="badge badge-verified">FCMP++ membership proof</span>'
          : '<span class="badge badge-muted">legacy RingCT</span>'}
          <a href="#/privacy" style="font-size:12px;margin-left:6px">What does this mean? →</a></dd>
        <dt>Unlock time</dt>     <dd>${unlock != null ? escapeHtml(String(unlock)) : '0'}</dd>
        <dt>Fee</dt>             <dd>${escapeHtml(formatAmount(fee))} USDm</dd>
        ${size ? `<dt>Size</dt><dd>${(size / 1024).toFixed(2)} KB</dd>` : ''}
      </dl>
    </section>

    ${(isFcmp || numBpp || numClsags || numFcmpProofs) ? `
    <section class="card">
      <div class="card-header">
        <h2>Cryptographic proofs</h2>
        <div class="card-action">${isFcmp ? 'FCMP++ (post-fork)' : 'legacy RingCT'}</div>
      </div>
      <div class="stat-grid">
        ${numFcmpProofs ? `
          <div class="stat-tile">
            <div class="stat-tile-label">FCMP++ key images</div>
            <div class="stat-tile-value">${numFcmpProofs}</div>
            <div class="stat-tile-sub">per-input non-double-spend</div>
          </div>` : ''}
        ${fcmpLayers.length ? `
          <div class="stat-tile">
            <div class="stat-tile-label">FCMP++ tree layers</div>
            <div class="stat-tile-value">${fcmpLayers.length}</div>
            <div class="stat-tile-sub">curve-tree depth</div>
          </div>` : ''}
        ${numClsags ? `
          <div class="stat-tile">
            <div class="stat-tile-label">CLSAG signatures</div>
            <div class="stat-tile-value">${numClsags}</div>
            <div class="stat-tile-sub">per-input ring signature</div>
          </div>` : ''}
        ${numBpp ? `
          <div class="stat-tile">
            <div class="stat-tile-label">Bulletproof+ proofs</div>
            <div class="stat-tile-value">${numBpp}</div>
            <div class="stat-tile-sub">amount-in-range proofs</div>
          </div>` : ''}
        <div class="stat-tile">
          <div class="stat-tile-label">Concealed</div>
          <div class="stat-tile-value" style="font-size:1rem;color:var(--success)">sender · recipient · amount</div>
          <div class="stat-tile-sub">none of these are public on chain</div>
        </div>
      </div>
      ${fcmpTreeRoot ? `
        <dl class="kv-table" style="margin-top:14px">
          <dt>Tree root</dt>
          <dd class="mono" style="font-size:12px">${escapeHtml(fcmpTreeRoot)}</dd>
          ${fcmpTreeRootTy != null ? `<dt>Root type</dt><dd>${escapeHtml(String(fcmpTreeRootTy))}</dd>` : ''}
          ${fcmpProof ? `<dt>Proof bytes</dt><dd style="color:var(--text-muted)">${fcmpProof.length} hex chars (${(fcmpProof.length / 2).toLocaleString('en-US')} bytes)</dd>` : ''}
        </dl>
      ` : ''}
      <p style="margin-top:14px;color:var(--text-secondary);font-size:12px;line-height:1.6">
        ${isFcmp
          ? 'FCMP++ proves each input was an output of a prior block, without revealing which prior output it was. Combined with stealth one-time output keys, Bulletproof+ amount commitments, and key images, the protocol conceals the sender, recipient, and amount in cryptographic public-verifiable form. <a href="#/privacy">What does this mean? →</a>'
          : 'This transaction uses legacy RingCT proofs (ring signatures + Bulletproof amount commitments). All MoneroUSD transactions become FCMP++ after the network passes the activation height — see <a href="#/privacy">/privacy</a>.'}
      </p>
    </section>` : ''}

    ${inputCount > 0 ? `
    <section class="card">
      <div class="card-header">
        <h2>Inputs (key images)</h2>
        <div class="card-action">${inputCount} input${inputCount === 1 ? '' : 's'}</div>
      </div>
      <p style="margin:0 0 12px;color:var(--text-secondary);font-size:12px">
        A key image is a one-time identifier derived from the spent output's
        private key. It proves non-double-spend without revealing which prior
        output was spent. Each row also shows the asset type and how many
        ring-mixin offsets the FCMP++ proof aggregates over.
      </p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Key image</th><th>Asset</th><th class="num">Mixins</th></tr>
          </thead>
          <tbody>${keyImageHTML(txInfo.vin)}</tbody>
        </table>
      </div>
    </section>` : ''}

    ${outputCount > 0 ? `
    <section class="card">
      <div class="card-header">
        <h2>Outputs (one-time stealth keys)</h2>
        <div class="card-action">${outputCount} output${outputCount === 1 ? '' : 's'}</div>
      </div>
      <p style="margin:0 0 12px;color:var(--text-secondary);font-size:12px">
        Every output goes to a fresh stealth public key derived from the
        recipient's view + spend keys. The recipient address is never on chain.
        Amount commitments are Pedersen-blinded; the view tag is an 8-bit
        scan-acceleration hint used by recipient wallets.
      </p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>One-time stealth key</th><th>Amount commitment</th><th>Asset</th><th>View tag</th></tr>
          </thead>
          <tbody>${outputKeysHTML(txInfo.vout)}</tbody>
        </table>
      </div>
    </section>` : ''}

    <section class="card">
      <div class="card-header">
        <h2>Protocol attestations</h2>
        <div class="card-action">${attestations.length || 0} attached</div>
      </div>
      ${attestations.length === 0
        ? '<p class="muted" style="margin:0">No <code>ion://op/v1?</code> attestation decoded from tx_extra. This is a plain USDm transfer with no protocol op attached.</p>'
        : renderAttestations(attestations)}
    </section>
  `;
}

function renderAttestations(arr) {
  return arr.map((a) => {
    const code = a.code || '?';
    const payloadJson = JSON.stringify(a.payload, null, 2);
    const rows = renderPayloadDeepLinks(a.payload);
    return `
      <div style="margin-bottom:14px">
        <dl class="kv-table">
          <dt>Op code</dt><dd><span class="badge badge-verified">${escapeHtml(code)}</span></dd>
          ${rows}
        </dl>
        <details style="margin-top:8px">
          <summary class="muted" style="cursor:pointer;font-size:12px">Raw payload</summary>
          <pre class="mono" style="overflow:auto;background:var(--bg-elevated);border:1px solid var(--border-subtle);padding:12px;border-radius:8px;font-size:12px;margin-top:8px">${escapeHtml(payloadJson)}</pre>
        </details>
      </div>
    `;
  }).join('');
}

function renderPayloadDeepLinks(p) {
  if (!p) return '';
  const rows = [];
  if (p.tokenId)     rows.push(['Token',      `<a href="#/token/${encodeURIComponent(p.tokenId)}" class="mono">${escapeHtml(p.tokenId)}</a>`]);
  if (p.poolId)      rows.push(['Pool',       `<a href="#/pool/${encodeURIComponent(p.poolId)}" class="mono">${escapeHtml(p.poolId)}</a>`]);
  if (p.contractId)  rows.push(['Contract',   `<a href="#/contract/${encodeURIComponent(p.contractId)}" class="mono">${escapeHtml(p.contractId)}</a>`]);
  if (p.destStealth) rows.push(['Destination',`<a href="#/address/${encodeURIComponent(p.destStealth)}" class="mono">${escapeHtml(shortAddr(p.destStealth))}</a>`]);
  if (p.domain)      rows.push(['Domain',     `<a href="#/site/${encodeURIComponent(p.domain)}">${escapeHtml(p.domain)}</a>`]);
  if (p.rootHash)    rows.push(['Root hash',  `<span class="mono">${escapeHtml(p.rootHash)}</span>`]);
  if (p.amount)      rows.push(['Amount',     `<span class="mono">${escapeHtml(String(p.amount))}</span>`]);
  if (p.entrypoint)  rows.push(['Entrypoint', `<span class="mono">${escapeHtml(p.entrypoint)}</span>`]);
  if (p.symbol)      rows.push(['Symbol',     `<span class="mono">${escapeHtml(p.symbol)}</span>`]);
  if (p.version)     rows.push(['Version',    `<span class="mono">${escapeHtml(String(p.version))}</span>`]);
  return rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${v}</dd>`).join('');
}
