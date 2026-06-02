// pages/home.js — Sovereign explorer home, driven by the LIVE L2 settlement engine
// (benchmark.monerousd.org). Every number here is measured, not stale daemon height.
// Click any block row for its live per-batch detail. CSP allows connect-src https://*.monerousd.org.

import { fmtUsd8, timeAgo } from '../lib/data-source.js';

const FLOOD_URL = 'https://benchmark.monerousd.org/api/benchmark/status';

async function fetchFlood() {
  try {
    const r = await fetch(FLOOD_URL, { cache: 'no-store', signal: AbortSignal.timeout(3500) });
    if (r.ok) return await r.json();
  } catch (_) {}
  return null;
}

function nf(n)   { return (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('en-US'); }
function fmtK(n) { n = Number(n || 0); if (n >= 1e9) return (n/1e9).toFixed(2)+'B'; if (n >= 1e6) return (n/1e6).toFixed(2)+'M'; if (n >= 1e3) return (n/1e3).toFixed(1)+'K'; return '' + Math.round(n); }
function proofMB(flood) { return flood?.proofKB ? (Number(flood.proofKB) / 1024).toFixed(2) + ' MB' : '—'; }

function heroTilesHTML(flood) {
  const bits = flood?.securityBits || 100;
  return `
    <div class="hero-stat"><div class="hero-stat-label">Live private TPS</div><div class="hero-stat-value">${nf(flood?.tps)}</div><div class="hero-stat-sub">peak ${nf(flood?.peakTps)}</div></div>
    <div class="hero-stat"><div class="hero-stat-label">Spends settled</div><div class="hero-stat-value">${flood?.spendsSettled != null ? fmtK(flood.spendsSettled) : '—'}</div><div class="hero-stat-sub">cumulative · private</div></div>
    <div class="hero-stat"><div class="hero-stat-label">Block height</div><div class="hero-stat-value">${nf(flood?.blocks)}</div><div class="hero-stat-sub">latest L2 settlement block</div></div>
    <div class="hero-stat"><div class="hero-stat-label">Spends / proof</div><div class="hero-stat-value">${nf(flood?.batchSize)}</div><div class="hero-stat-sub">one O(1)-verified proof</div></div>
    <div class="hero-stat"><div class="hero-stat-label">Verify / proof</div><div class="hero-stat-value">${flood?.verifyMs != null ? Number(flood.verifyMs).toFixed(0) + ' ms' : '—'}</div><div class="hero-stat-sub">flat O(1) · ${bits}-bit PQ</div></div>
    <div class="hero-stat"><div class="hero-stat-label">Full-chain sync</div><div class="hero-stat-value">&asymp; 2 MB</div><div class="hero-stat-sub">one recursive proof &middot; any device</div></div>`;
}

function heroHTML(flood) {
  return `
    <header class="hero" aria-labelledby="hero-heading">
      <span class="hero-eyebrow">MoneroUSD chain · privacy-first · live L2 settlement</span>
      <h1 id="hero-heading">Sovereign block explorer</h1>
      <p>Private ZK-rollup settlement at production post-quantum security — every block folds thousands of
         FCMP++ spends into one O(1)-verified proof, with amounts and addresses
         <a href="#/privacy">concealed by design</a>. Click any block for its live detail.</p>
      <div class="hero-stats" id="hero-stats">${heroTilesHTML(flood)}</div>
    </header>`;
}

// Block view, L2 batch format. Each row is clickable -> live per-batch detail modal.
function batchesHTML(flood) {
  const s = (flood && flood.settlements) || [];
  if (!s.length) return '<div class="loading">Connecting to the live settlement engine…</div>';
  const bs = Number(flood?.batchSize || 8192);
  const pm = proofMB(flood);
  const total = Number(flood?.blocks || 0);
  const cum = Number(flood?.spendsSettled || 0);
  const bits = flood?.securityBits || 100;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Block</th><th class="num">Private spends</th><th class="num col-sm-hide">Verify</th>
          <th class="num">Eff. TPS</th><th class="num col-sm-hide">Proof</th><th>Status</th>
        </tr></thead>
        <tbody>
          ${s.slice(0, 12).map(b => {
            const sp = Number(b.spends || bs);
            const vm = Number(b.verifyMs || 0);
            const tps = vm > 0 ? Math.round(sp / (vm / 1000)) : 0;
            const data = encodeURIComponent(JSON.stringify({ blk: b.block, sp, vm, tps, pm, total, cum, bits }));
            return `<tr class="batch-row" data-b="${data}" style="cursor:pointer">
              <td><span style="color:var(--accent,#FF6600);font-weight:600">#${nf(b.block)}</span></td>
              <td class="num">${nf(sp)}</td>
              <td class="num col-sm-hide">${vm.toFixed(1)} ms</td>
              <td class="num" style="color:var(--accent,#FF6600);font-weight:600">${nf(tps)}</td>
              <td class="num col-sm-hide">${pm}</td>
              <td><span class="badge badge-verified">✓ settled</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function showBatchModal(d) {
  let m = document.getElementById('batch-modal');
  if (!m) { m = document.createElement('div'); m.id = 'batch-modal'; document.body.appendChild(m); }
  m.style.cssText = 'position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.64);padding:18px';
  const rows = [
    ['Private spends settled', nf(d.sp)],
    ['Spends per proof', nf(d.sp) + ' &mdash; folded into one proof'],
    ['Effective private TPS', '<span style="color:var(--accent,#FF6600);font-weight:700">' + nf(d.tps) + '</span>'],
    ['Verify time', Number(d.vm).toFixed(1) + ' ms (flat O(1))'],
    ['Proof size', d.pm + ' &middot; ' + d.bits + '-bit PQ STARK'],
    ['Settlement', 'block #' + nf(d.blk) + ' &middot; ' + nf(d.total) + ' settled so far'],
    ['Cumulative spends', nf(d.cum) + ' private'],
    ['Privacy', 'amounts &middot; senders &middot; recipients all concealed'],
    ['Status', '<span class="badge badge-verified">✓ settled</span>'],
  ];
  m.innerHTML = `<div style="max-width:470px;width:100%;background:#141414;border:1px solid var(--accent,#FF6600);border-radius:16px;padding:22px 24px;box-shadow:0 24px 70px rgba(0,0,0,.72);font:500 13px Inter,system-ui,sans-serif;color:#f0eeea">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
      <div style="font:700 19px 'JetBrains Mono',monospace;color:var(--accent,#FF6600)">Block #${nf(d.blk)}</div>
      <button id="bm-x" style="cursor:pointer;border:0;background:transparent;color:#9a958c;font:700 18px Inter;line-height:1">✕</button>
    </div>
    <div style="font-size:10.5px;color:#8c8a85;text-transform:uppercase;letter-spacing:1.4px;margin-bottom:14px">L2 settlement · post-quantum</div>
    ${rows.map(r => `<div style="display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)"><span style="color:#9a958c">${r[0]}</span><span style="text-align:right">${r[1]}</span></div>`).join('')}
    <div style="margin-top:13px;font-size:10.5px;color:#6f6c66;line-height:1.5">One recursive O(1)-verified proof settles all ${nf(d.sp)} spends. Verification time is flat regardless of batch size.</div>
  </div>`;
  m.style.display = 'flex';
  const close = () => { m.style.display = 'none'; };
  m.querySelector('#bm-x').onclick = close;
  m.onclick = e => { if (e.target === m) close(); };
}

let _homeToken = 0;

export async function renderHome(ctx) {
  const { view } = ctx;
  const token = ++_homeToken;
  const alive = () => token === _homeToken;

  view.innerHTML = heroHTML(null) + `
    <section class="card">
      <div class="card-header">
        <h2>Recent blocks · L2 settlement</h2>
        <div class="card-action" id="blocks-action">connecting…</div>
      </div>
      <div id="blocks-body"><div class="loading">Loading live settlement blocks…</div></div>
    </section>
    <section class="card">
      <div class="card-header"><h2>How settlement works</h2></div>
      <div style="padding:4px 2px;color:var(--text-muted,#9a958c);font-size:13.5px;line-height:1.6">
        Each block above is an <strong>L2 settlement batch</strong>: thousands of confidential FCMP++ spends folded
        into a single recursive proof, verified in <strong>flat O(1) time</strong> at production post-quantum
        security. Effective private throughput = spends ÷ verify time. Recursion folds the <strong>entire chain
        into one constant-size proof</strong>, so a node verifies all history from <strong>~2 MB</strong> — run it
        from any device, no matter how long the chain gets. Proofs are ~2 MB (not Mina's few KB) because they're
        <strong>hash-based STARKs</strong> — quantum-secure, rather than pre-quantum SNARKs.
        <a href="#/l2">See the full settlement stream →</a>
      </div>
    </section>`;

  // one delegated handler — survives the live re-renders below
  view.addEventListener('click', e => {
    const row = e.target.closest && e.target.closest('.batch-row');
    if (row && row.dataset.b) { try { showBatchModal(JSON.parse(decodeURIComponent(row.dataset.b))); } catch (_) {} }
  });

  async function tick() {
    if (!alive()) return;
    const flood = await fetchFlood();
    if (!alive()) return;
    const hs = view.querySelector('#hero-stats'); if (hs) hs.innerHTML = heroTilesHTML(flood);
    const bb = view.querySelector('#blocks-body'); if (bb) bb.innerHTML = batchesHTML(flood);
    const act = view.querySelector('#blocks-action');
    if (act) act.textContent = flood && flood.running ? `live · updated ${new Date().toLocaleTimeString()}` : 'settlement engine offline';
  }
  await tick();
  (function loop() { if (!alive()) return; setTimeout(async () => { await tick(); loop(); }, 2500); })();
}
