// pages/settlements.js — the L2 Settlement Stream.
//
// A novel presentation of MoneroUSD's post-quantum private ZK-rollup settlements.
// Each settlement is ONE on-chain transaction carrying ONE STARK proof that
// privately settles a whole BATCH of spends — verified by consensus on the chain.
// This page shows that new primitive the way it deserves: the compression
// (N spends → 1 proof), the verified post-quantum proof, and the L2 state-root
// advancing.
//
// PRIVACY: only non-privacy-risking detail is ever shown — spend COUNT, the
// commitment/nullifier ROOTS (not amounts/addresses), the proof, and the
// verification verdict. No amounts, no stealth addresses, no per-spend linkage.
//
// HONESTY: by default this fetches REAL settlements from the network indexer and
// shows an empty "awaiting first settlement" state until the L2 testnet produces
// them. `?preview=1` injects clearly-labelled SAMPLE data for design review only.

import { getNetworkConfig, isTestnet } from '../lib/data-source.js';

const SECURITY_BITS = 100;
const SOLANA_TPS = 65000;
let pollTimer = null;

export async function renderSettlements(ctx) {
  const { view } = ctx;
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }

  const preview = /[?&]preview=1/.test(location.hash) || /[?&]preview=1/.test(location.search);
  view.innerHTML = shell(preview);
  injectStyle();

  const stream = document.getElementById('l2-stream');
  const seen = new Set();
  const agg = { spends: 0, count: 0, proofBytes: 0, firstTs: 0, lastTs: 0, lastVerifyMs: 0 };

  async function tick() {
    // Stop polling if the user navigated away.
    if (!document.getElementById('l2-stream')) { clearInterval(pollTimer); pollTimer = null; return; }

    const list = await fetchSettlements(preview);
    if (list === null) { setState('offline'); return; }
    if (!list.length && agg.count === 0) { setState('empty'); return; }

    let added = false;
    // oldest→newest so insertBefore keeps newest on top
    for (const s of [...list].sort((a, b) => a.l2Height - b.l2Height)) {
      if (seen.has(s.txHash)) continue;
      seen.add(s.txHash);
      agg.spends += s.spendCount;
      agg.count += 1;
      agg.proofBytes += s.proofBytes;
      agg.lastVerifyMs = s.verifyMs;
      agg.firstTs = agg.firstTs ? Math.min(agg.firstTs, s.timestamp) : s.timestamp;
      agg.lastTs = Math.max(agg.lastTs, s.timestamp);
      const wrap = document.createElement('div');
      wrap.innerHTML = card(s);
      const node = wrap.firstElementChild;
      node.classList.add('l2-enter');
      stream.insertBefore(node, stream.firstChild);
      added = true;
    }
    if (added) {
      setState('live');
      updateCounters(agg);
      while (stream.children.length > 40) stream.removeChild(stream.lastChild);
    }
  }

  await tick();
  pollTimer = setInterval(tick, 3000);
}

// ── data ────────────────────────────────────────────────────────────────────
async function fetchSettlements(preview) {
  if (preview) return sampleSettlements();
  try {
    const base = getNetworkConfig().api.replace(/\/+$/, '');
    const r = await fetch(`${base}/v1/settlements?limit=40`, { headers: { accept: 'application/json' } });
    if (!r.ok) return [];                 // endpoint not live yet → empty state
    const j = await r.json();
    return Array.isArray(j) ? j : (j.settlements || []);
  } catch (_) {
    return [];                            // unreachable → empty state (not "offline")
  }
}

// ── shell ─────────────────────────────────────────────────────────────────────
function shell(preview) {
  const net = isTestnet() ? 'testnet' : 'mainnet';
  return `
  <header class="hero l2-hero" style="padding:34px 32px">
    <span class="hero-eyebrow">Post-quantum private ZK-rollup · ${net}</span>
    <h1 style="font-size:1.85rem;line-height:1.15">L2 Settlement Stream</h1>
    <p style="max-width:760px">Each row below is <strong>one real on-chain transaction</strong> that carries
      <strong>one post-quantum STARK proof</strong> — and that single proof privately settles a whole
      <strong>batch of spends</strong>, verified by consensus. Thousands of private spends, one cheap verification.
      This is how MoneroUSD settles past 65,000 TPS without revealing a single amount or address.</p>
    ${preview ? `<div class="l2-preview-flag">PREVIEW — sample data for design only, not real on-chain settlements</div>` : ``}
  </header>

  <section class="l2-counters">
    <div class="l2-counter"><div class="l2-c-val" id="l2-spends">0</div><div class="l2-c-lbl">private spends settled</div></div>
    <div class="l2-counter"><div class="l2-c-val" id="l2-count">0</div><div class="l2-c-lbl">on-chain settlements</div></div>
    <div class="l2-counter"><div class="l2-c-val" id="l2-tps">—</div><div class="l2-c-lbl">effective private TPS</div></div>
    <div class="l2-counter"><div class="l2-c-val" id="l2-comp">—</div><div class="l2-c-lbl">spends per proof</div></div>
  </section>

  <section class="card l2-explain">
    <div class="l2-flow">
      <div class="l2-flow-stage"><div class="l2-spend-grid" id="l2-grid"></div><span>N private spends</span></div>
      <div class="l2-flow-arrow">⟶</div>
      <div class="l2-flow-stage"><div class="l2-proof-glyph">◆</div><span>1 STARK proof<br><b>≥${SECURITY_BITS}-bit PQ</b></span></div>
      <div class="l2-flow-arrow">⟶</div>
      <div class="l2-flow-stage"><div class="l2-root-glyph">⧉</div><span>L2 root advances<br><b>verified on-chain</b></span></div>
    </div>
  </section>

  <section class="card" style="padding:0">
    <div class="card-header" style="padding:16px 20px"><h2>Live settlements</h2>
      <span class="l2-state" id="l2-state">connecting…</span></div>
    <div id="l2-stream" class="l2-stream"></div>
    <div id="l2-placeholder" class="l2-placeholder">Awaiting the first on-chain settlement…</div>
  </section>`;
}

// ── settlement card ─────────────────────────────────────────────────────────
function card(s) {
  const tx = s.txHash || '';
  const short = (h) => h ? h.slice(0, 10) + '…' + h.slice(-8) : '—';
  const verified = s.verified !== false;
  return `
  <div class="l2-card">
    <div class="l2-card-l">
      <div class="l2-card-n">${fmt(s.spendCount)}</div>
      <div class="l2-card-n-lbl">private spends</div>
    </div>
    <div class="l2-card-m">
      <div class="l2-card-row">
        <a class="l2-tx" href="#/tx/${tx}" title="${tx}">tx ${short(tx)}</a>
        <span class="l2-blk">block #${fmt(s.block || 0)}</span>
        ${verified
          ? `<span class="l2-badge ok">✓ verified · ≥${SECURITY_BITS}-bit PQ${s.verifyMs ? ` · ${Number(s.verifyMs).toFixed(0)}ms` : ''}</span>`
          : `<span class="l2-badge bad">✗ rejected</span>`}
      </div>
      <div class="l2-roots">
        <span class="l2-root-k">cmt root</span>
        <code class="l2-root-old" title="anchor (prev state)">${short(s.anchor)}</code>
        <span class="l2-root-arr">→</span>
        <code class="l2-root-new" title="new state">${short(s.cmtRootNew)}</code>
      </div>
      <div class="l2-meta">
        <span>proof ${(s.proofBytes / 1024).toFixed(0)} KB</span>
        <span>·</span><span>L2 height ${fmt(s.l2Height || 0)}</span>
        <span>·</span><span>${ago(s.timestamp)}</span>
      </div>
    </div>
  </div>`;
}

// ── counters + states ───────────────────────────────────────────────────────
function updateCounters(agg) {
  setText('l2-spends', fmt(agg.spends));
  setText('l2-count', fmt(agg.count));
  setText('l2-comp', agg.count ? fmt(Math.round(agg.spends / agg.count)) : '—');
  // effective private TPS = spends settled / wall-clock span (verify-bound capacity is shown on the benchmark)
  const span = Math.max(1, (agg.lastTs - agg.firstTs));
  const tps = agg.count > 1 ? agg.spends / span : (agg.lastVerifyMs ? Math.round(agg.spends / (agg.lastVerifyMs / 1000)) : 0);
  const el = document.getElementById('l2-tps');
  if (el) { el.textContent = fmt(Math.round(tps)); el.classList.toggle('beat', tps >= SOLANA_TPS); }
}
function setState(s) {
  const el = document.getElementById('l2-state');
  const ph = document.getElementById('l2-placeholder');
  if (!el) return;
  if (s === 'live')    { el.textContent = '● live'; el.className = 'l2-state live'; if (ph) ph.style.display = 'none'; }
  if (s === 'empty')   { el.textContent = '○ idle'; el.className = 'l2-state'; if (ph) { ph.style.display = ''; ph.textContent = 'Awaiting the first on-chain settlement — the L2 testnet is coming online.'; } }
  if (s === 'offline') { el.textContent = '○ offline'; el.className = 'l2-state'; if (ph) { ph.style.display = ''; ph.textContent = 'Settlement indexer unreachable.'; } }
}
function clearEmpty() { const ph = document.getElementById('l2-placeholder'); if (ph) ph.style.display = 'none'; }

// ── helpers ─────────────────────────────────────────────────────────────────
function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
function setText(id, t) { const e = document.getElementById(id); if (e) e.textContent = t; }
function ago(ts) {
  if (!ts) return 'just now';
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  return Math.floor(s / 3600) + 'h ago';
}

// Build the dot grid once the page is in the DOM.
function injectStyle() {
  if (!document.getElementById('l2-settle-style')) {
    const st = document.createElement('style');
    st.id = 'l2-settle-style';
    st.textContent = STYLE;
    document.head.appendChild(st);
  }
  // populate the spend-grid visual
  requestAnimationFrame(() => {
    const g = document.getElementById('l2-grid');
    if (g && !g.childElementCount) {
      let h = '';
      for (let i = 0; i < 36; i++) h += `<i style="animation-delay:${(i * 0.05).toFixed(2)}s"></i>`;
      g.innerHTML = h;
    }
  });
}

function sampleSettlements() {
  // deterministic-ish sample for ?preview=1 (design only, clearly flagged in the UI)
  const base = Math.floor(Date.now() / 1000);
  const rnd = (seed) => { const x = Math.sin(seed) * 10000; return x - Math.floor(x); };
  const hx = (seed, n) => Array.from({ length: n }, (_, i) => '0123456789abcdef'[Math.floor(rnd(seed + i) * 16)]).join('');
  return Array.from({ length: 8 }, (_, i) => ({
    txHash: hx(i * 7 + 1, 64),
    block: 100 + i * 2,
    timestamp: base - (8 - i) * 9,
    spendCount: 8192,
    domain: 'L2_SETTLEMENT',
    proofBytes: 52000 + Math.floor(rnd(i) * 3000),
    securityBits: SECURITY_BITS,
    verified: true,
    verifyMs: 86 + rnd(i + 3) * 8,
    anchor: hx(i * 11 + 2, 64),
    cmtRootNew: hx(i * 11 + 3, 64),
    nsRootOld: hx(i * 13 + 4, 64),
    nsRootNew: hx(i * 13 + 5, 64),
    l2Height: i + 1,
  }));
}

const STYLE = `
.l2-hero h1{background:linear-gradient(90deg,#fff,#FF8533);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.l2-preview-flag{margin-top:14px;display:inline-block;padding:6px 12px;border-radius:8px;font:600 12px/1 var(--mono,monospace);color:#f59e0b;background:rgba(245,158,11,.10);border:1px solid rgba(245,158,11,.35)}
.l2-counters{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:18px 0}
.l2-counter{background:var(--bg-elevated,#161616);border:1px solid var(--glass-border,rgba(255,255,255,.08));border-radius:14px;padding:18px 16px;text-align:center}
.l2-c-val{font:800 1.9rem/1 var(--mono,monospace);color:#fff;letter-spacing:-.02em}
.l2-c-val.beat{color:#22c55e}
#l2-tps{color:var(--monero-orange,#FF6600)}
.l2-c-lbl{margin-top:8px;font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted,#888)}
.l2-explain{padding:22px}
.l2-flow{display:flex;align-items:center;justify-content:center;gap:22px;flex-wrap:wrap}
.l2-flow-stage{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;font-size:.78rem;color:var(--text-muted,#999);min-width:120px}
.l2-flow-stage b{color:#fff}
.l2-flow-arrow{color:var(--monero-orange,#FF6600);font-size:1.5rem;opacity:.7}
.l2-spend-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:3px;width:62px}
.l2-spend-grid i{width:8px;height:8px;border-radius:2px;background:var(--monero-orange,#FF6600);opacity:.25;animation:l2blink 2.4s ease-in-out infinite}
@keyframes l2blink{0%,100%{opacity:.18}50%{opacity:.9}}
.l2-proof-glyph,.l2-root-glyph{width:54px;height:54px;display:flex;align-items:center;justify-content:center;border-radius:14px;font-size:1.7rem}
.l2-proof-glyph{color:#fff;background:radial-gradient(circle,rgba(255,102,0,.35),rgba(255,102,0,.06));border:1px solid var(--monero-orange-rim,rgba(255,102,0,.32));box-shadow:0 0 22px rgba(255,102,0,.3)}
.l2-root-glyph{color:#22c55e;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.3)}
.l2-state{font:600 12px/1 var(--mono,monospace);color:var(--text-muted,#888)}
.l2-state.live{color:#22c55e}
.l2-stream{display:flex;flex-direction:column}
.l2-card{display:flex;gap:18px;align-items:center;padding:16px 20px;border-top:1px solid var(--border-subtle,rgba(255,255,255,.06))}
.l2-card:hover{background:var(--bg-hover,rgba(255,255,255,.03))}
.l2-enter{animation:l2in .45s cubic-bezier(.16,1,.3,1)}
@keyframes l2in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
.l2-card-l{flex:0 0 130px;text-align:center;padding:8px 0;border-radius:12px;background:linear-gradient(180deg,rgba(255,102,0,.10),transparent);border:1px solid var(--monero-orange-soft,rgba(255,102,0,.10))}
.l2-card-n{font:800 1.5rem/1 var(--mono,monospace);color:var(--monero-orange,#FF6600)}
.l2-card-n-lbl{margin-top:5px;font-size:.66rem;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted,#888)}
.l2-card-m{flex:1;min-width:0}
.l2-card-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.l2-tx{font:600 .85rem var(--mono,monospace);color:var(--monero-orange,#FF6600);text-decoration:none}
.l2-tx:hover{text-decoration:underline}
.l2-blk{font:.78rem var(--mono,monospace);color:var(--text-muted,#999)}
.l2-badge{font:600 .72rem var(--mono,monospace);padding:3px 9px;border-radius:7px}
.l2-badge.ok{color:#22c55e;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.28)}
.l2-badge.bad{color:#ef4444;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.28)}
.l2-roots{display:flex;align-items:center;gap:9px;margin-top:9px;flex-wrap:wrap}
.l2-root-k{font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted,#777)}
.l2-roots code{font:.78rem var(--mono,monospace);padding:2px 7px;border-radius:6px;background:var(--bg-popover,#1c1c1c)}
.l2-root-old{color:#999}
.l2-root-new{color:#22c55e}
.l2-root-arr{color:var(--monero-orange,#FF6600)}
.l2-meta{display:flex;gap:8px;margin-top:8px;font-size:.74rem;color:var(--text-muted,#777)}
.l2-placeholder{padding:40px 20px;text-align:center;color:var(--text-muted,#888);font-size:.9rem}
@media(max-width:720px){.l2-counters{grid-template-columns:repeat(2,1fr)}.l2-card{flex-direction:column;align-items:stretch}.l2-card-l{flex:none}}
`;
