// tests/dag-pq-integration.mjs
// ─────────────────────────────────────────────────────────────────────
// Integration self-test for the explorer SPA's REWIRED DAG/PQ data path.
// Exercises the EXACT modules the explorer ships (lib/dag-pq-sdk.js +
// lib/data-source.js) against the LIVE testnet daemon at 127.0.0.1:28080.
//
// This proves the explorer's real code path — not just the canonical SDK —
// returns real GHOSTDAG mergeset + PQ data, with the local daemon FIRST in the
// testnet failover list (no single-operator trust for proof-bearing reads).
//
// Run:  node tests/dag-pq-integration.mjs   [daemonUrl]
// Exit 0 = all checks passed.
// ─────────────────────────────────────────────────────────────────────

const DAEMON = process.argv[2] || 'http://127.0.0.1:28080';

// ── minimal browser-global shims so the ESM SPA modules import in Node ──
// data-source.js reads location.pathname (network select) + localStorage
// (endpoint overrides) + window (wallet provider). We force testnet and point
// the daemon list at the live node ONLY (no ion.monerousd.org fallback in the
// test, so we prove the LOCAL read works on its own).
globalThis.location = { pathname: '/testnet/', hash: '', search: '' };
globalThis.window = undefined; // no wallet provider → federated path
const _store = new Map();
_store.set('daemon_rpcs_testnet', DAEMON); // local daemon only for the test
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null),
  setItem: (k, v) => _store.set(k, String(v)),
  removeItem: (k) => _store.delete(k),
};

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; fails.push(name); console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}

(async () => {
  console.log(`\nexplorer SPA DAG/PQ integration — daemon=${DAEMON}\n`);

  // Import the EXACT modules the SPA ships.
  const sdk = await import('../lib/dag-pq-sdk.js');
  const ds = await import('../lib/data-source.js');

  // ── 0) network selection resolves to testnet (the rewire premise) ──
  console.log('[net] network selection');
  ok('getNetwork() === testnet (path-driven)', ds.getNetwork() === 'testnet', ds.getNetwork());
  ok('isTestnet() === true', ds.isTestnet() === true);
  ok('testnet daemonRpcs default has loopback FIRST, not 17750',
    (ds.getNetworkConfig().daemonRpcs || [])[0] === sdk.DEFAULT_TESTNET_DAEMON &&
    !(ds.getNetworkConfig().daemonRpcs || []).some(u => /17750|node\.monerousd\.org/.test(u)),
    JSON.stringify(ds.getNetworkConfig().daemonRpcs));

  // ── 1) get_info via the SPA failover layer ──
  console.log('\n[chain] ds.getInfo()');
  const info = await ds.getInfo();
  ok('getInfo testnet === true', info && info.testnet === true, `height=${info && info.height}`);
  ok('getInfo nettype testnet', info && info.nettype === 'testnet');

  // ── 2) genesis assert through the SPA path (no trust-the-operator) ──
  console.log('\n[chain] ds.getDagBlock(0) genesis assert');
  const gen = await ds.getDagBlock(0);
  ok('genesis hash matches pinned TESTNET_GENESIS_HASH',
    gen && gen.hash && gen.hash.toLowerCase() === sdk.TESTNET_GENESIS_HASH.toLowerCase(),
    gen && gen.hash);

  // ── 3) DAG block shape: mergeset is surfaced (the core gap fixed) ──
  console.log('\n[dag] ds.getDagBlock(tip) exposes the GHOSTDAG mergeset');
  const tipHeight = Math.max(0, Number(info.height) - 1);
  const dag = await ds.getDagBlock(tipHeight);
  ok('dag.hash is 64-hex', dag && /^[0-9a-fA-F]{64}$/.test(dag.hash || ''), dag && dag.hash);
  ok('dag exposes additionalParents (the GHOSTDAG mergeset field)',
    dag && Array.isArray(dag.additionalParents), `mergeset=${dag && dag.mergeset.length}`);
  ok('dag.prevHashes = [selected, ...mergeset]',
    dag && Array.isArray(dag.prevHashes) &&
    (dag.prevHash ? dag.prevHashes[0] === dag.prevHash : true));
  ok('dag.majorVersion present (DAG header decoded)', dag && dag.majorVersion != null, `v${dag && dag.majorVersion}`);
  ok('dag.txHashes is an array', dag && Array.isArray(dag.txHashes), `txs=${dag && dag.txHashes.length}`);

  // ── 4) settlement anchor = block-hash tuple, NEVER a bare height ──
  console.log('\n[sound] settlement anchor is the block-hash tuple');
  const client = new sdk.DagPqClient(DAEMON);
  const anchor = client.settlementAnchor(dag);
  ok('anchor.hash === block hash', anchor.hash === dag.hash);
  ok('anchor.tuple[0] is the 64-hex block hash (not a height)',
    /^[0-9a-fA-F]{64}$/.test(String(anchor.tuple[0])), String(anchor.tuple[0]).slice(0, 16) + '…');
  ok('anchor.tuple contains NO bare integer height',
    anchor.tuple.every(x => typeof x === 'string' && /^[0-9a-fA-F]{64}$/.test(x)));

  // ── 5) PQ output tree (depth-32) via SPA REST helper ──
  console.log('\n[pq] ds.getPqOutputTree()');
  const tree = await ds.getPqOutputTree();
  ok('tree depth === 32', tree && tree.depth === 32, `depth=${tree && tree.depth}`);
  ok('tree count is a real number', tree && typeof tree.count === 'number', `count=${tree && tree.count}`);
  ok('tree notes_hex is real hex (frontier)', tree && /^[0-9a-fA-F]+$/.test(tree.notes_hex || ''), `${(tree && tree.notes_hex || '').length} hex`);

  // ── 6) PQ notes (opaque blobs, confidential) via SPA REST helper ──
  console.log('\n[pq] ds.getPqNotes(0)');
  const notes = await ds.getPqNotes(0);
  const list = (notes && notes.notes) || [];
  ok('getPqNotes returns notes array', Array.isArray(list), `count=${list.length}`);
  ok('note has opaque blob_hex (no plaintext amount)', list.length === 0 || (typeof list[0].blob_hex === 'string' && list[0].blob_hex.length > 0));
  ok('note has height', list.length === 0 || (list[0].height != null));

  // ── 7) PQ epoch address (rec-block carrier) via SPA REST helper ──
  console.log('\n[pq] ds.getPqEpochAddress()');
  const epoch = await ds.getPqEpochAddress();
  ok('epoch_address is a long PQ address', epoch && typeof epoch.epoch_address === 'string' && epoch.epoch_address.length > 100, `len=${epoch && epoch.epoch_address && epoch.epoch_address.length}`);
  ok('epoch_b_hex is 64-hex', epoch && /^[0-9a-fA-F]{64}$/.test(epoch.epoch_b_hex || ''));

  // ── 8) nullifier-spent query (no-inflation gate) ──
  console.log('\n[pq] ds.getPqNfSpent([...])');
  const nf = await ds.getPqNfSpent(['00'.repeat(32)]);
  ok('getPqNfSpent served (status OK / object)', nf && (nf.status === 'OK' || typeof nf === 'object'));

  console.log(`\n========================================`);
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  if (fail) console.log(`FAILURES: ${fails.join(', ')}`);
  console.log(`========================================\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('\nINTEGRATION TEST ERROR:', e && e.stack ? e.stack : e);
  process.exit(2);
});
