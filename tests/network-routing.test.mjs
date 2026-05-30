// network-routing.test.mjs
// ─────────────────────────────────────────────────────────────────────
// Locks the explorer's testnet path-prefix routing:
//   • getNetwork() / isTestnet() derive network from location.pathname
//   • networkSwitchUrl() flips network while preserving the hash route
//   • the 404.html SPA-fallback preserves the /testnet prefix
//
// Run: node --test tests/network-routing.test.mjs
// ─────────────────────────────────────────────────────────────────────
import assert from 'node:assert';
import test from 'node:test';

// getNetwork() reads location.pathname; networkSwitchUrl() reads .hash.
globalThis.location = { pathname: '/', hash: '' };
const ds = await import('../lib/data-source.js');

function setLoc(pathname, hash = '') {
  globalThis.location.pathname = pathname;
  globalThis.location.hash = hash;
}

test('getNetwork: mainnet paths', () => {
  for (const p of ['/', '/index.html', '/tx/abc', '/tokens',
                   '/testnetx', '/testnetx/foo', '/foo/testnet']) {
    setLoc(p);
    assert.strictEqual(ds.getNetwork(), 'mainnet', `path ${p}`);
  }
});

test('getNetwork: testnet paths', () => {
  for (const p of ['/testnet', '/testnet/', '/testnet/tx/abc', '/testnet/index.html']) {
    setLoc(p);
    assert.strictEqual(ds.getNetwork(), 'testnet', `path ${p}`);
  }
});

test('isTestnet / getNetworkLabel track the path', () => {
  setLoc('/testnet/');
  assert.strictEqual(ds.isTestnet(), true);
  assert.strictEqual(ds.getNetworkLabel(), 'Testnet');
  setLoc('/');
  assert.strictEqual(ds.isTestnet(), false);
  assert.strictEqual(ds.getNetworkLabel(), 'Mainnet');
});

test('networkSwitchUrl preserves the current hash route', () => {
  setLoc('/', '#/block/5');
  assert.strictEqual(ds.networkSwitchUrl('testnet'), '/testnet/#/block/5');
  setLoc('/testnet/', '#/tx/deadbeef');
  assert.strictEqual(ds.networkSwitchUrl('mainnet'), '/#/tx/deadbeef');
  setLoc('/testnet/', '');                 // no hash → default home
  assert.strictEqual(ds.networkSwitchUrl('mainnet'), '/#/');
});

// Mirror of the inline 404.html rewrite — keep in lockstep with that file.
function fourOhFourRewrite(pathname, search = '') {
  let route = pathname.replace(/^\/+/, '');
  let base = '/';
  const m = route.match(/^testnet(?:\/(.*))?$/);
  if (m) { base = '/testnet/'; route = m[1] || ''; }
  return base + search + '#/' + route;
}

test('404 rewrite: mainnet deep links', () => {
  assert.strictEqual(fourOhFourRewrite('/tx/abc'), '/#/tx/abc');
  assert.strictEqual(fourOhFourRewrite('/token/ion1xyz'), '/#/token/ion1xyz');
  assert.strictEqual(fourOhFourRewrite('/'), '/#/');
});

test('404 rewrite: testnet deep links preserve the prefix', () => {
  assert.strictEqual(fourOhFourRewrite('/testnet/tx/abc'), '/testnet/#/tx/abc');
  assert.strictEqual(fourOhFourRewrite('/testnet'), '/testnet/#/');
  assert.strictEqual(fourOhFourRewrite('/testnet/'), '/testnet/#/');
  // /testnetx is NOT the testnet prefix — must stay mainnet.
  assert.strictEqual(fourOhFourRewrite('/testnetx/foo'), '/#/testnetx/foo');
});
