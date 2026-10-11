import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Store } from '../store.mjs';
import { createGrowth } from '../growth.mjs';

async function fixture(t) {
  const store = new Store(':memory:');
  const growth = createGrowth({ store, products: () => [{ id: 'pillow', imageSource: 'illustration' }], mode: 'mock' });
  const server = createServer(async (req, res) => {
    try { if (!await growth.handle(req, res, { path: new URL(req.url, base).pathname, baseOrigin: base })) { res.writeHead(404); res.end(); } }
    catch (error) { res.writeHead(error.status || 500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ code: error.code, message: error.message })); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); store.close(); });
  const call = async (path, body, options = {}) => {
    const response = await fetch(base + '/api/growth/' + path, { method: body === undefined ? 'GET' : 'POST', ...options,
      headers: { Origin: base, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...options.headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    const value = await response.json(); return { status: response.status, value, response };
  };
  const auth = await call('session', {});
  const cookie = auth.response.headers.get('set-cookie')?.split(';')[0];
  return { call, cookie, store, base };
}
const input = (productId = 'weekend') => ({ campaignId: 'main', items: [{ productId, quantity: 1 }], rewardId: 'pillow' });

test('authoritative quote preserves margin floor, cap and ineligible commission', async t => {
  const { call, cookie } = await fixture(t);
  assert.equal((await call('quote', input())).value.fanCopay, 6000);
  const big = (await call('quote', input('adventure'))).value;
  assert.equal(big.fanCopay, 0); assert.equal(big.merchantContributionAfter, 30000);
  const config = (await call('config')).value;
  config.products[0].cost = 100000;
  assert.equal((await call('config', config, { method: 'PUT', headers: { Cookie: cookie } })).status, 200);
  const loss = (await call('quote', input())).value;
  assert.equal(loss.eligible, false); assert.equal(loss.creatorCommission, 0); assert.equal(loss.merchantSubsidy, 0);
  assert.equal(loss.merchantContributionAfter, -100);
});

test('public projection hides costs, origins and admin writes are isolated', async t => {
  const { call, cookie } = await fixture(t);
  const config = (await call('config')).value;
  assert.equal((await call('config', config, { method: 'PUT' })).status, 401);
  assert.equal((await call('session', {}, { headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await call('config', config, { method: 'PUT', headers: { Cookie: cookie, Origin: 'https://jackery.cz' } })).status, 403);
  const result = await call('public?campaign=main', undefined, { headers: { Origin: 'https://jackery.cz' } });
  assert.equal(result.status, 200); assert.equal(result.value.products[0].cost, undefined); assert.equal(result.value.economics, undefined);
  assert.equal(result.response.headers.get('access-control-allow-origin'), 'https://jackery.cz');
  const publicQuote = (await call('quote', input(), { headers: { Origin: 'https://jackery.cz' } })).value;
  assert.equal(publicQuote.merchantContributionAfter, undefined); assert.equal(publicQuote.creatorCommission, undefined);
  assert.equal((await call('public', undefined, { headers: { Origin: 'https://evil.example' } })).status, 403);
});

test('config and cart validation reject malformed money, private URLs and tampering', async t => {
  const { call, cookie } = await fixture(t);
  const config = (await call('config')).value;
  for (const shopUrl of ['http://shop.example', 'https://127.0.0.1', 'https://user:pass@shop.example', 'https://shop.local']) {
    assert.equal((await call('config', { ...config, shopUrl }, { method: 'PUT', headers: { Cookie: cookie } })).status, 400);
  }
  assert.equal((await call('config', { ...config, economics: { ...config.economics, rewardCost: 0.1 } }, { method: 'PUT', headers: { Cookie: cookie } })).status, 400);
  for (const quantity of [-1, 0, 1.5, 11]) assert.equal((await call('quote', { ...input(), items: [{ productId: 'weekend', quantity }] })).status, 400);
  assert.equal((await call('quote', { ...input(), fanCopay: 0 })).status, 400);
  assert.equal((await call('quote', { ...input(), items: [...input().items, ...input().items] })).status, 400);
});

test('events dedupe exact replays, reject conflicts and persist safe personalization without payment claims', async t => {
  const { call } = await fixture(t);
  const visit = { campaignId: 'main', creatorId: 'alex', sessionId: 'visitor-1', eventId: 'event-1', type: 'visit' };
  assert.equal((await call('events', visit)).status, 201);
  assert.equal((await call('events', visit)).status, 200);
  assert.equal((await call('events', { ...visit, type: 'reward_selected', rewardId: 'pillow' })).status, 409);
  const checkout = { ...visit, ...input(), eventId: 'event-2', type: 'checkout_simulated', personalization: { text: 'Alex & Eva' } };
  const result = (await call('events', checkout)).value;
  assert.equal(result.event.quote.fanCopay, 6000); assert.equal(result.event.paymentOccurred, false);
  assert.deepEqual(result.event.personalization, { text: 'Alex & Eva' });
  assert.equal((await call('events', { ...checkout, eventId: 'event-3', personalization: { text: 'x'.repeat(33) } })).status, 400);
  assert.equal((await call('events', { ...visit, eventId: 'event-4', type: 'paid' })).status, 400);
  assert.equal((await call('events', { ...visit, eventId: 'event-5', creatorId: 'unknown' })).status, 400);
  const dashboard = (await call('dashboard')).value;
  assert.equal(dashboard.stats.visits, 1); assert.equal(dashboard.stats.simulatedCheckouts, 1);
  assert.equal(dashboard.demoConnected, true); assert.equal(dashboard.shopConnected, false);
});

test('campaign cap limits funded reward and a commission budget shortfall grants no commission', async t => {
  const { call, cookie } = await fixture(t);
  const config = (await call('config')).value;
  config.economics.campaignCap = 9000;
  await call('config', config, { method: 'PUT', headers: { Cookie: cookie } });
  assert.equal((await call('quote', input('adventure'))).value.merchantSubsidy, 1000);
  config.economics.campaignCap = 7999;
  await call('config', config, { method: 'PUT', headers: { Cookie: cookie } });
  const quote = (await call('quote', input('adventure'))).value;
  assert.equal(quote.eligible, false); assert.equal(quote.creatorCommission, 0); assert.equal(quote.platformFee, 0);
  assert.equal(quote.merchantContributionAfter, 52000);
});

test('browser observations separate external shop from local demo and bound event history', async t => {
  const { call, store } = await fixture(t);
  for (let n = 0; n < 202; n++) {
    const event = { campaignId: 'main', creatorId: 'alex', sessionId: `visitor-${Math.floor(n / 50)}`, eventId: `visit-${n}`, type: 'visit' };
    assert.equal((await call('events', event, { headers: { Origin: 'https://jackery.cz' } })).status, 201);
  }
  const dashboard = (await call('dashboard')).value;
  assert.equal(dashboard.events.length, 200); assert.equal(dashboard.stats.visits, 202);
  assert.equal(dashboard.shopConnected, true); assert.equal(dashboard.demoConnected, false);
  assert.equal(dashboard.observationSource, 'browser_reported');
  const duplicate = { campaignId: 'main', creatorId: 'alex', sessionId: 'visitor-0', eventId: 'visit-0', type: 'visit' };
  assert.equal((await call('events', duplicate, { headers: { Origin: 'https://jackery.cz' } })).value.duplicate, true);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM growth_events').get().n, 200);
});

test('public preflight has explicit CORS and sessionless generation never starts work', async t => {
  const { call, base } = await fixture(t);
  const preflight = await fetch(base + '/api/growth/events', { method: 'OPTIONS', headers: { Origin: 'https://jackery.cz', 'Access-Control-Request-Method': 'POST' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://jackery.cz');
  assert.equal(preflight.headers.get('access-control-allow-credentials'), null);
  assert.equal((await call('designs', { prompt: 'x', categoryId: 'cat', requestId: 'req' })).status, 401);
  assert.equal((await call('dashboard', undefined, { headers: { Origin: 'https://jackery.cz' } })).status, 403);
  assert.equal((await call('session', {}, { headers: { Origin: 'null' } })).status, 403);
  assert.equal((await call('events', { campaignId: 'main', creatorId: 'alex', sessionId: 'a', eventId: 'b', type: 'visit', extra: 'x'.repeat(17000) })).status, 413);
});

test('repeated page reloads reuse the browser operator session past twenty requests', async t => {
  const { call, cookie } = await fixture(t);
  for (let n = 0; n < 25; n++) {
    const result = await call('session', {}, { headers: { Cookie: cookie } });
    assert.equal(result.status, 200);
    assert.equal(result.response.headers.get('set-cookie')?.split(';')[0], cookie);
  }
  const config = (await call('config')).value;
  assert.equal((await call('config', config, { method: 'PUT', headers: { Cookie: cookie } })).status, 200);
});

test('twenty distinct operator sessions still cap new sessions with a clean error', async t => {
  const { call, cookie } = await fixture(t);
  const issued = new Set([cookie]);
  for (let n = 1; n < 20; n++) {
    const result = await call('session', {}, { headers: { Cookie: 'growth_operator=malformed' } });
    assert.equal(result.status, 200);
    issued.add(result.response.headers.get('set-cookie')?.split(';')[0]);
  }
  assert.equal(issued.size, 20);
  const result = await call('session', {});
  assert.equal(result.status, 429); assert.equal(result.value.code, 'rate_limit');
  assert.equal(result.response.headers.get('set-cookie'), null);
  assert.equal((await call('session', {}, { headers: { Cookie: cookie } })).status, 200);
});
