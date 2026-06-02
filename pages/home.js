// pages/home.js — Sovereign explorer home.
//
// Driven by the LIVE L2 settlement driver (the flood engine at
// benchmark.monerousd.org). The hero ("sovereign block explorer" modal)
// and the block view both reflect real, measured settlement throughput —
// not stale daemon height. Block height + daemon version come from
// get_info (best-effort); everything else is the live driver.
//
// CSP allows connect-src https://*.monerousd.org, so the cross-origin
// fetch to the benchmark driver is permitted. Polls every 2.5 s; the
// _homeToken guard stops the loop the moment the user navigates away.

import { fmtUsd8, timeAgo } from '../lib/data-source.js';

const FLOOD_URL = 'https://benchmark.monerousd.org/api/benchmark/status';

async function fetchFlood() {
  try {
    const r = await fetch(FLOOD_URL, { cache: 'no-store', signal: AbortSignal.timeout(3500) });
    if (r.ok) return await r.json();
  } catch (_) {}
  return null;
}

function nf(n)  { return (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('en-US'); }
function fmtK(n){ n = Number(n || 0); if (n >= 1e9) return (n/1e9).toFixed(2)+'B'; if (n >= 1e6) return (n/1e6).toFixed(2)+'M'; if (n >= 1e3) return (n/1e3).toFixed(1)+'K'; return '' + Math.round(n); }

function heroTilesHTML(info, flood) {
  const height = Number(info?.height || 0);
  const net = info?.testnet ? 'Testnet' : (info?.stagenet ? 'Stagenet' : 'Mainnet');
  const ver = info?.version ? ('v' + info.version) : '—';
  return `
    <div class="hero-stat"><div class="hero-stat-label">Live private TPS</div><div class="hero-stat-value">${nf(flood?.tps)}</div><div class="hero-stat-sub">peak ${nf(flood?.peakTps)}</div></div>
    <div class="hero-stat"><div class="hero-stat-label">Spends settled</div><div class="hero-stat-value">${flood?.spendsSettled != null ? fmtK(flood.spendsSettled) : '—'}</div><div class="hero-stat-sub">cumulative · private</div></div>
    <div class="hero-stat"><div class="hero-stat-label">Settlement batches</div><div class="hero-stat-value">${nf(flood?.bundles)}</div><div class="hero-stat-sub">${flood?.batchSize ? nf(flood.batchSize) + ' spends each' : 'L2 rollup'}</div></div>
    <div class="hero-stat"><div class="hero-stat-label">Verify / batch</div><div class="hero-stat-value">${flood?.verifyMs != null ? Number(flood.verifyMs).toFixed(0) + ' ms' : '—'}</div><div class="hero-stat-sub">flat O(1)</div></div>
    <div class="hero-stat"><div class="hero-stat-label">PQ security</div><div class="hero-stat-value">${flood?.securityBits || 100}-bit</div><div class="hero-stat-sub">post-quantum</div></div>
    <div class="hero-stat"><div class="hero-stat-label">Block height</div><div class="hero-stat-value">${height.toLocaleString('en-US')}</div><div class="hero-stat-sub">${net} · ${ver}</div></div>`;
}

function heroHTML(info, flood) {
  return `
    <header class="hero" aria-labelledby="hero-heading">
      <span class="hero-eyebrow">MoneroUSD chain · privacy-first · live L2 settlement</span>
      <h1 id="hero-heading">Sovereign block explorer</h1>
      <p>Private ZK-rollup settlement at production post-quantum security — every block folds thousands of
         FCMP++ spends into one O(1)-verified proof, with amounts and addresses
         <a href="#/privacy">concealed by design</a>.</p>
      <div class="hero-stats" id="hero-stats">${heroTilesHTML(info, flood)}</div>
    </header>`;
}

// Block view, redone for the L2 batch format. Each "block" is a settlement
// batch: N FCMP++ spends folded into one flat-verified proof.
function batchesHTML(flood) {
  const s = (flood && flood.settlements) || [];
  if (!s.length) return '<div class="loading">Connecting to the live settlement driver…</div>';
  const bs = Number(flood?.batchSize || 8192);
  const proof = flood?.proofKB ? (Number(flood.proofKB) / 1024).toFixed(2) + ' MB' : '—';
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Block</th><th class="num">Spends settled</th><th class="num">Verify</th>
          <th class="num">Eff. TPS</th><th class="num">Proof</th><th>Status</th>
        </tr></thead>
        <tbody>
          ${s.slice(0, 12).map(b => {
            const sp = Number(b.spends || bs);
            const vm = Number(b.verifyMs || 0);
            const tps = vm > 0 ? Math.round(sp / (vm / 1000)) : 0;
            return `<tr>
              <td><a href="#/l2">#${nf(b.block)}</a></td>
              <td class="num">${nf(sp)}</td>
              <td class="num">${vm.toFixed(1)} ms</td>
              <td class="num" style="color:var(--accent,#FF6600);font-weight:600">${nf(tps)}</td>
              <td class="num">${proof}</td>
              <td><span class="badge badge-verified">✓ settled</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

let _homeToken = 0;

export async function renderHome(ctx) {
  const { ds, view } = ctx;
  const token = ++_homeToken;
  const alive = () => token === _homeToken;

  view.innerHTML = heroHTML({}, null) + `
    <section class="card">
      <div class="card-header">
        <h2>Recent blocks · L2 settlement</h2>
        <div class="card-action" id="blocks-action">connecting…</div>
      </div>
      <div id="blocks-body"><div class="loading">Loading live settlement batches…</div></div>
    </section>
    <section class="card">
      <div class="card-header"><h2>How settlement works</h2></div>
      <div style="padding:4px 2px;color:var(--text-muted,#9a958c);font-size:13.5px;line-height:1.6">
        Each block above is an <strong>L2 settlement batch</strong>: thousands of confidential FCMP++ spends are
        folded into a single recursive proof and verified in <strong>flat O(1) time</strong> at production
        post-quantum security. Effective private throughput = batch size ÷ verify time. Amounts, senders and
        recipients never appear on chain — only the proof and its commitments.
        <a href="#/l2">See the full settlement stream →</a>
      </div>
    </section>`;

  async function tick() {
    if (!alive()) return;
    const [flood, info] = await Promise.all([
      fetchFlood(),
      ds.callDaemon('get_info').catch(() => ({})),
    ]);
    if (!alive()) return;
    const hs = view.querySelector('#hero-stats');
    if (hs) hs.innerHTML = heroTilesHTML(info || {}, flood);
    const bb = view.querySelector('#blocks-body');
    if (bb) bb.innerHTML = batchesHTML(flood);
    const act = view.querySelector('#blocks-action');
    if (act) act.textContent = flood && flood.running ? `live · updated ${new Date().toLocaleTimeString()}` : 'settlement driver offline';
  }

  await tick();
  (function loop() {
    if (!alive()) return;
    setTimeout(async () => { await tick(); loop(); }, 2500);
  })();
}
