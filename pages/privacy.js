// pages/privacy.js — privacy-primitives explainer.
//
// Side-by-side reference for what MoneroUSD CONCEALS vs what's
// PUBLIC by design. This is a static informational page — the
// content doesn't depend on chain state. Lives here so users
// (and skeptical reviewers) can verify the protocol's privacy
// posture without leaving the explorer.

export async function renderPrivacy(ctx) {
  const { view } = ctx;
  view.innerHTML = `
    <header class="hero" style="padding:30px 32px">
      <span class="hero-eyebrow">Privacy primer</span>
      <h1 style="font-size:1.7rem">What MoneroUSD conceals — and what it doesn't</h1>
      <p>Every blockchain trades some privacy for some verifiability. MoneroUSD inherits
        Monero's ring signatures, Bulletproof+ range proofs, stealth addresses, and adds
        FCMP++ membership proofs on top. This page lays out the line: green is
        cryptographically <strong>concealed</strong>; blue is <strong>public</strong> by design.</p>
    </header>

    <section class="card">
      <div class="card-header"><h2>By transaction</h2></div>
      <div class="privacy-grid">
        <div class="privacy-col">
          <h3><span class="privacy-pill concealed">concealed</span></h3>
          <ul class="privacy-list">
            <li><strong>Sender</strong> — hidden in a ring of decoys (ring signatures + FCMP++).
              No on-chain address ever appears on the sending side.</li>
            <li><strong>Recipient</strong> — every output goes to a one-time stealth subaddress derived from the recipient's view + spend keys. The receiver's public address is never on chain.</li>
            <li><strong>Amount</strong> — Pedersen-committed; Bulletproof+ proves it's in range without revealing the value.</li>
            <li><strong>Token / asset type</strong> — Confidential Asset Tags (post-fork) hide which asset class an output belongs to.</li>
            <li><strong>Address-level balance</strong> — there is no public mapping from address → balance. A wallet must scan with the view key to know its own outputs.</li>
            <li><strong>Tx graph</strong> — ring signatures + FCMP++ break the in→out linkage.</li>
          </ul>
        </div>
        <div class="privacy-col">
          <h3><span class="privacy-pill public">public</span></h3>
          <ul class="privacy-list">
            <li><strong>Block headers</strong> — height, time, prev hash, difficulty, miner reward.</li>
            <li><strong>Tx hash + size + fee</strong> — present in every block. Hash is opaque w.r.t. sender/receiver/amount.</li>
            <li><strong>Stealth output keys (one-time)</strong> — written to chain but unlinkable to a wallet without the view key.</li>
            <li><strong>Attestation payloads</strong> — TOKEN_CREATE / LP_MINT / SITE_PUBLISH / DC_DEPLOY are op-public by construction; only their economic effect is on chain.</li>
            <li><strong>Pool state</strong> — AMM reserves, pool events, swap volumes are derived state — visible to everyone.</li>
            <li><strong>Reserve totals</strong> — every USDm fee routed to the reserve is public; reserve growth is a public counter.</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-header"><h2>By feature</h2></div>
      <div class="privacy-grid">
        <div class="privacy-col">
          <h3><span class="privacy-pill concealed">concealed</span></h3>
          <ul class="privacy-list">
            <li><strong>Wallet identity per dApp</strong> — every dApp connection gets its own stealth subaddress; cross-site linkage is broken by design.</li>
            <li><strong>Holder counts &amp; balances</strong> — explorers can't compute a "rich list" because outputs are unlinkable.</li>
            <li><strong>LP positions</strong> — Pedersen-blinded openings stored client-side. Mint/burn events anchored on chain but amounts hidden.</li>
            <li><strong>Side-index queries (Path C)</strong> — wallet restores via SimplePIR-encrypted scope-tag lookups; the daemon can't tell which scope_id a wallet is reading.</li>
          </ul>
        </div>
        <div class="privacy-col">
          <h3><span class="privacy-pill public">public</span></h3>
          <ul class="privacy-list">
            <li><strong>Verified token registry</strong> — every token's name, symbol, supply rule, and tokenId is public for clone-name protection.</li>
            <li><strong>Sovereign sites</strong> — domain, version, rootHash, bundle size, publisher stealth address (truncated). Anyone can verify a site against its chain anchor.</li>
            <li><strong>Dark Contract bytecode</strong> — DSOL contracts are on-chain as readable bytecode. Argv may be encrypted (commit-reveal) or plaintext (direct call).</li>
            <li><strong>Validator bonds + slash log</strong> — bond amounts, signal records, and slashing events are public for accountability.</li>
            <li><strong>Bridge home-chain balances</strong> — FROST custody addresses on BTC / ETH / XMR / LTC / etc. are public and verifiable on those chains' explorers.</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-header"><h2>What this explorer deliberately does NOT show</h2></div>
      <ul class="privacy-list">
        <li><strong>Address balance lookup.</strong> Even if a user types a stealth address, no balance is returned — that would require view-key disclosure, which we never request and never accept.</li>
        <li><strong>Holder counts.</strong> Imprecise + privacy-leaking. Pool-level activity and trading volume are surfaced instead.</li>
        <li><strong>Per-address tx history.</strong> Same reason; correlations would be a privacy regression.</li>
        <li><strong>Heat maps of activity.</strong> Aggregate pool/swap volumes are fine; per-stealth-address timelines are not.</li>
      </ul>
    </section>
  `;
}
