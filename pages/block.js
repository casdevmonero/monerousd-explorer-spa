// pages/block.js — Block detail page (Phantom-style hero +
// glass-card overview + GHOSTDAG mergeset panel + transaction table).
//
// MonerousD is a GHOSTDAG block-DAG (width > 1): a block can merge MORE THAN
// ONE parent. The selected parent (prev_hash / prev_id) is the chain-selected
// ancestor; `additional_parents` are the rest of the merged parents (the
// mergeset). Height is NOT a total order here, so the page renders the real
// DAG shape — selected parent + mergeset + the hash-tuple settlement anchor —
// instead of only a single linear "Previous" link. The shapes come from the
// shared DAG/PQ SDK (ds.getDagBlock), verified against the live testnet daemon.
//
// Pagination — Prev/Next by height for convenience (selected-chain walk):
//   • Prev disabled at height 0.
//   • Next disabled at chain tip (currentHeight - 1).
//
// The TX list deep-links to /tx/<hash>.

import { escapeHtml, formatAmount, formatDifficulty, timeSince, detectTxBadge, getTxTypeName, badgeHtml } from '../lib/helpers.js';

export async function renderBlock({ ds, view }, idOrHash) {
  let dag;            // normalized GHOSTDAG block (SDK shape)
  let errorMsg = null;
  let currentHeight = 0;

  try {
    if (/^\d+$/.test(idOrHash) || /^[0-9a-fA-F]{64}$/.test(idOrHash)) {
      dag = await ds.getDagBlock(idOrHash);
    } else {
      throw new Error('Not a valid block height or hash.');
    }
  } catch (e) {
    errorMsg = e?.message || String(e);
  }

  try { currentHeight = await ds.getBlockCount(); } catch (_) {}

  if (errorMsg) {
    view.innerHTML = `<div class="error-box"><strong>Error</strong><p>${escapeHtml(errorMsg)}</p></div>`;
    return;
  }

  // The normalized DAG block exposes the raw header + the mergeset. Keep a
  // `header` alias so the existing display code reads naturally.
  const header  = (dag && dag.header) || {};
  const txHashes = (dag && dag.txHashes) || [];
  const minerTxHash = dag?.minerTxHash || header.miner_tx_hash || null;
  const height = Number(dag?.height ?? header.height ?? 0);
  const tip    = currentHeight ? currentHeight - 1 : null;
  const confirmations = tip != null ? Math.max(0, tip + 1 - height) : null;

  // The GHOSTDAG shape. selectedParent = chain-selected ancestor; mergeset =
  // the additional merged parents (blue/red set members). The settlement
  // anchor is the hash-tuple a settlement/L2 binds to (NEVER a height —
  // width > 1 means height is not a total order).
  const selectedParent = dag?.prevHash || null;
  const mergeset = Array.isArray(dag?.mergeset) ? dag.mergeset : [];
  const allParents = Array.isArray(dag?.prevHashes) ? dag.prevHashes : (selectedParent ? [selectedParent] : []);
  const isMerge = mergeset.length > 0;

  // Batch-fetch tx bodies so we can show fee / size. These are MonerousD PQ
  // rec-block carriers (DOMAIN_PQ_REC_BLOCK) — confidential amounts, no curve
  // on the data path. We surface fee/size only (privacy: no amount/linkage).
  let txs = [];
  if (txHashes.length > 0) {
    try {
      const r = await ds.getTransactions(txHashes);
      txs = r?.txs || [];
    } catch (_) {}
  }

  const prev = height > 0;
  const next = tip != null && height < tip;

  // Compact hash for parent links/lists.
  const shortH = (h) => (h && typeof h === 'string' && h.length > 22) ? (h.slice(0, 12) + '…' + h.slice(-8)) : (h || '—');

  view.innerHTML = `
    <header class="hero" style="padding:26px 30px">
      <span class="hero-eyebrow">DAG block</span>
      <h1 style="font-size:1.6rem">#${height.toLocaleString('en-US')}
        ${isMerge
          ? `<span class="badge badge-verified" style="vertical-align:middle;margin-left:8px" title="This block merged ${allParents.length} parents (GHOSTDAG mergeset)">⬡ merge · ${allParents.length} parents</span>`
          : `<span class="badge badge-muted" style="vertical-align:middle;margin-left:8px" title="Single selected parent (no concurrent blocks merged here)">⬡ linear</span>`}
      </h1>
      <p style="margin-top:6px;color:var(--text-secondary)">
        ${header.timestamp ? new Date(header.timestamp * 1000).toUTCString() : '—'}
        <span style="color:var(--text-muted)">(${escapeHtml(timeSince(header.timestamp))})</span>
        ${confirmations != null ? ` · <strong>${confirmations.toLocaleString('en-US')}</strong> confirmation${confirmations === 1 ? '' : 's'}` : ''}
      </p>
      <div class="hero-stats">
        <div class="hero-stat">
          <div class="hero-stat-label">Txs</div>
          <div class="hero-stat-value">${header.num_txes ?? txHashes.length}</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">Reward</div>
          <div class="hero-stat-value">${escapeHtml(formatAmount(header.reward))} <span style="font-size:11px;color:var(--text-muted)">USDm</span></div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">Size</div>
          <div class="hero-stat-value" style="font-size:1.05rem">${header.block_size ? (header.block_size / 1024).toFixed(2) + ' KB' : '—'}</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">Difficulty</div>
          <div class="hero-stat-value" style="font-size:1rem">${escapeHtml(formatDifficulty(header.difficulty))}</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">Nonce</div>
          <div class="hero-stat-value" style="font-size:1rem;font-family:var(--font-mono)">${escapeHtml(String(header.nonce ?? '—'))}</div>
        </div>
      </div>
      <div class="pager" style="margin-top:18px;justify-content:flex-start">
        <button class="btn btn-ghost btn-sm" data-prev-block="${prev ? height - 1 : ''}" ${prev ? '' : 'disabled'}>← Block #${prev ? (height - 1).toLocaleString('en-US') : ''}</button>
        <button class="btn btn-ghost btn-sm" data-next-block="${next ? height + 1 : ''}" ${next ? '' : 'disabled'}>Block #${next ? (height + 1).toLocaleString('en-US') : ''} →</button>
      </div>
    </header>

    <section class="card">
      <div class="card-header"><h2>Header</h2></div>
      <dl class="kv-table">
        <dt>Hash</dt>         <dd class="mono">${escapeHtml(header.hash || '—')}</dd>
        <dt>Height</dt>       <dd>${height.toLocaleString('en-US')}</dd>
        <dt>Timestamp</dt>    <dd>${header.timestamp ? new Date(header.timestamp * 1000).toUTCString() : '—'} <span style="color:var(--text-muted)">(${escapeHtml(timeSince(header.timestamp))})</span></dd>
        <dt>Confirmations</dt><dd>${confirmations != null ? confirmations.toLocaleString('en-US') : '—'}</dd>
        <dt>Tx count</dt>     <dd>${header.num_txes ?? txHashes.length}</dd>
        <dt>Size</dt>         <dd>${header.block_size ? (header.block_size / 1024).toFixed(2) + ' KB' : '—'}</dd>
        <dt>Difficulty</dt>   <dd>${header.difficulty ? Number(header.difficulty).toLocaleString('en-US') : '—'} <span style="color:var(--text-muted)">(${escapeHtml(formatDifficulty(header.difficulty))})</span></dd>
        <dt>Cumulative</dt>   <dd>${header.cumulative_difficulty ? Number(header.cumulative_difficulty).toLocaleString('en-US') : '—'}</dd>
        <dt>Nonce</dt>        <dd class="mono">${escapeHtml(String(header.nonce ?? '—'))}</dd>
        <dt>Reward</dt>       <dd>${escapeHtml(formatAmount(header.reward))} USDm</dd>
        <dt>PoW hash</dt>     <dd class="mono">${escapeHtml(header.pow_hash || '—')}</dd>
        <dt>Version</dt>      <dd>${dag?.majorVersion != null ? `v${dag.majorVersion}` : '—'}${dag?.minorVersion != null ? ` (minor ${dag.minorVersion})` : ''}</dd>
        ${minerTxHash ? `<dt>Miner tx</dt><dd class="mono"><a href="#/tx/${escapeHtml(minerTxHash)}">${escapeHtml(minerTxHash)}</a></dd>` : ''}
      </dl>
    </section>

    <section class="card">
      <div class="card-header">
        <h2>GHOSTDAG parents</h2>
        <div class="card-action">${allParents.length} parent${allParents.length === 1 ? '' : 's'}${isMerge ? ` · mergeset ${mergeset.length}` : ''}</div>
      </div>
      <p class="muted" style="margin:0 0 14px;font-size:.85rem">
        MonerousD is a block-DAG (GHOSTDAG, width &gt; 1). A block can merge several concurrent
        parents — height is <strong>not</strong> a total order. Settlement/ordering binds to the
        <strong>block-hash tuple below</strong>, never to a bare height.
      </p>
      <dl class="kv-table">
        <dt>Selected parent</dt>
        <dd class="mono">${selectedParent
          ? `<a href="#/block/${escapeHtml(selectedParent)}">${escapeHtml(selectedParent)}</a>`
          : '<span style="color:var(--text-muted)">none (genesis)</span>'}</dd>
        <dt>Mergeset (additional parents)</dt>
        <dd>${mergeset.length
          ? `<div class="dag-mergeset">${mergeset.map(p =>
              `<a class="dag-parent mono" href="#/block/${escapeHtml(p)}" title="${escapeHtml(p)}">${escapeHtml(shortH(p))}</a>`
            ).join('')}</div>`
          : '<span style="color:var(--text-muted)">∅ — no concurrent blocks merged (selected parent only)</span>'}</dd>
        <dt title="The hash-tuple a settlement / L2 anchor binds to. NEVER a height.">Settlement anchor</dt>
        <dd class="mono dag-anchor">[${[header.hash, ...allParents].filter(Boolean).map(h => escapeHtml(shortH(h))).join(', ')}]</dd>
      </dl>
    </section>

    ${txHashes.length > 0 ? `
    <section class="card">
      <div class="card-header">
        <h2>Transactions</h2>
        <div class="card-action">${txHashes.length} in block</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Hash</th>
              <th>Type</th>
              <th>Asset</th>
              <th class="num">Fee</th>
              <th class="num">Size</th>
              <th>Privacy</th>
            </tr>
          </thead>
          <tbody>
            ${txHashes.map((h, i) => {
              const tx = txs[i] || {};
              const j = tx.as_json ? safeJson(tx.as_json) : tx;
              const badge = detectTxBadge(tx);
              const typeName = getTxTypeName(tx);
              const typeCell = badge ? renderTypeBadge(badge, typeName) : `<span class="badge badge-muted">${escapeHtml(typeName)}</span>`;
              const assetCell = badge && badge.asset ? badgeHtml(badge.asset) : '<span style="color:var(--text-muted)">USDm</span>';
              const feeAtomic = j?.rct_signatures?.txnFee ?? tx.fee ?? 0;
              return `
                <tr>
                  <td class="mono"><a href="#/tx/${escapeHtml(h)}">${escapeHtml(h.slice(0, 16))}…</a></td>
                  <td>${typeCell}</td>
                  <td>${assetCell}</td>
                  <td class="num">${escapeHtml(formatAmount(feeAtomic))} USDm</td>
                  <td class="num">${tx.size ? (tx.size / 1024).toFixed(2) + ' KB' : '—'}</td>
                  <td><span class="badge badge-verified" title="Post-quantum confidential — amounts and parties hidden by ZK; PQ rec-block carrier (DOMAIN_PQ_REC_BLOCK)">PQ · confidential</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>` : `
    <section class="card">
      <div class="card-header"><h2>Transactions</h2></div>
      <p class="muted" style="margin:0">No user transactions in this block (coinbase only).</p>
    </section>`}
  `;

  // Wire pager buttons — re-bound on every render so navigation
  // works after every Prev/Next.
  const prevBtn = view.querySelector('[data-prev-block]');
  const nextBtn = view.querySelector('[data-next-block]');
  if (prevBtn && !prevBtn.disabled) {
    prevBtn.addEventListener('click', () => {
      const t = prevBtn.dataset.prevBlock;
      if (t) location.hash = '#/block/' + t;
    });
  }
  if (nextBtn && !nextBtn.disabled) {
    nextBtn.addEventListener('click', () => {
      const t = nextBtn.dataset.nextBlock;
      if (t) location.hash = '#/block/' + t;
    });
  }

  injectDagStyle();
}

// Mergeset / anchor styling (injected once). Uses theme CSS vars to match.
function injectDagStyle() {
  if (document.getElementById('dag-block-style')) return;
  const st = document.createElement('style');
  st.id = 'dag-block-style';
  st.textContent = `
.dag-mergeset{display:flex;flex-wrap:wrap;gap:8px}
.dag-parent{display:inline-block;padding:4px 9px;border-radius:8px;font-size:.78rem;
  background:var(--bg-popover,#1c1c1c);border:1px solid var(--monero-orange-soft,rgba(255,102,0,.18));
  color:var(--monero-orange,#FF6600);text-decoration:none}
.dag-parent:hover{border-color:var(--monero-orange,#FF6600);text-decoration:underline}
.dag-anchor{font-size:.8rem;color:var(--text-secondary,#bbb);word-break:break-all}
`;
  document.head.appendChild(st);
}

function safeJson(s) { try { return JSON.parse(s); } catch (_) { return {}; } }

function renderTypeBadge(badge, typeName) {
  if (!badge) return `<span class="badge badge-muted">${escapeHtml(typeName)}</span>`;
  if (badge.type === 'bridge-wrap')    return `<span class="badge badge-info">Bridge Wrap</span>`;
  if (badge.type === 'bridge-unwrap')  return `<span class="badge badge-info">Bridge Unwrap</span>`;
  if (badge.type === 'conversion')     return `<span class="badge badge-warning">${escapeHtml(badge.label || 'Convert')}</span>`;
  if (badge.type === 'asset-transfer') return `<span class="badge badge-verified">${escapeHtml(badge.label || 'Transfer')}</span>`;
  return `<span class="badge badge-muted">${escapeHtml(badge.label || typeName)}</span>`;
}
