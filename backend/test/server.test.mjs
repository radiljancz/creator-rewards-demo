import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { createApp } from '../server.mjs';
import { Store } from '../store.mjs';

async function app(t, store = new Store(':memory:'), options = {}) {
  const instance = createApp({ store, mode: 'mock', operatorToken: 'test-operator-token', maxDesigns: 3, ...options });
  await instance.listen(0);
  const base = `http://127.0.0.1:${instance.server.address().port}`;
  const request = (path, body, extra = {}) => fetch(base + path, body === undefined ? extra : {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...extra.headers }, body: JSON.stringify(body),
  });
  t.after(() => instance.close());
  return { instance, base, request };
}
const selection = { campaignId: 'creator-rewards-demo', productId: 'coastal-pillow', scenarioId: 'small' };

test('seed, quotes, simulated complete and repeat request use USD and no order', async t => {
  const { request } = await app(t);
  const seed = await (await request('/api/demo/campaign')).json();
  assert.equal(seed.demo, true); assert.equal(seed.currency, 'USD');
  assert.equal(seed.collection.products[0].imageSource, 'illustration');
  assert.ok(!JSON.stringify(seed).includes('test-operator-token'));
  const quote = await (await request('/api/demo/quote', selection)).json();
  assert.equal(quote.fanCopay, 6000); assert.equal(quote.merchantContributionAfter, 30000);
  const body = { ...selection, requestId: 'complete-1' };
  const completed = await (await request('/api/demo/complete', body)).json();
  assert.equal(completed.status, 'simulated'); assert.equal(completed.paymentOccurred, false); assert.equal(completed.orderPlaced, false);
  assert.deepEqual(await (await request('/api/demo/complete', body)).json(), completed);
  assert.equal((await request('/api/demo/complete', { ...body, scenarioId: 'large' })).status, 409);
});

test('unknown IDs, client prices, malformed JSON and wrong content type are rejected', async t => {
  const { request, base } = await app(t);
  assert.equal((await request('/api/demo/quote', { ...selection, scenarioId: 'no' })).status, 404);
  assert.equal((await request('/api/demo/quote', { ...selection, productCost: 1 })).status, 400);
  assert.equal((await fetch(base + '/api/demo/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
  assert.equal((await fetch(base + '/api/demo/quote', { method: 'POST', body: JSON.stringify(selection) })).status, 415);
});

test('cross-origin and wrong Host are denied before operator generation', async t => {
  const { request, base } = await app(t);
  const body = { prompt: 'Coastal trails', categoryId: 'mock-textile', requestId: 'generation-1' };
  assert.equal((await request('/api/designs', body)).status, 401);
  assert.equal((await request('/api/designs', body, { headers: { Authorization: 'Bearer test-operator-token', Origin: 'https://evil.test' } })).status, 403);
  const invalidHostStatus = await new Promise((resolve, reject) => {
    const req = httpRequest(base + '/api/demo/campaign', { headers: { Host: 'evil.test' } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject); req.end();
  });
  assert.equal(invalidHostStatus, 403);
  const accepted = await request('/api/designs', body, { headers: { Authorization: 'Bearer test-operator-token' } });
  assert.equal(accepted.status, 202);
  const started = await accepted.json();
  const design = await (await request(`/api/designs/${started.designId}`)).json();
  assert.equal(design.status, 'succeeded'); assert.equal(design.product.providerProductId, null);
  const replay = await (await request('/api/designs', body, { headers: { Authorization: 'Bearer test-operator-token' } })).json();
  assert.equal(replay.designId, started.designId);
  const seed = await (await request('/api/demo/campaign')).json();
  assert.equal(seed.collection.products.length, 2);
  await request('/api/demo/campaign'); await request('/api/demo/campaign');
  assert.equal((await (await request('/api/demo/campaign')).json()).collection.products.length, 2);
});

test('loopback deployment only and shared-host bind is refused', async t => {
  const { instance } = await app(t);
  await assert.rejects(() => instance.listen(0, '0.0.0.0'), { code: 'loopback_only' });
});

const studioCatalog = ['pillow', 'scarf', 'towel'].map(categoryId => ({ categoryId, name: categoryId, world: 'print', canManufacture: true,
  imageUrl: `https://example.test/${categoryId}.png`, selections: { fabric: 'default' },
  options: [{ key: 'fabric', label: 'Fabric', values: [{ value: 'default', available: true, label: 'Default', providerSecret: 'private-field' }] }],
  privateBody: 'private-field' }));

test('studio catalog metadata reflects persisted limits and both generation reservations without provider work', async t => {
  const { request, instance } = await app(t, new Store(':memory:'), { categories: studioCatalog });
  const get = async () => {
    const response = await request('/api/designs/categories');
    assert.equal(response.status, 200); return response.json();
  };
  let value = await get();
  assert.deepEqual(value.items.map(item => item.categoryId), ['pillow', 'scarf', 'towel']);
  assert.equal(value.items[1].imageUrl, studioCatalog[1].imageUrl);
  assert.ok(!JSON.stringify(value).includes('private-field'));
  assert.ok(!JSON.stringify(value).includes('test-operator-token'));
  assert.equal(value.remainingDesigns, 3); assert.equal(value.maxDesigns, 3);
  assert.equal(value.activeGeneration, false); assert.equal(value.generationAvailable, true); assert.equal(value.generationBlocker, null);
  instance.manager.store.putDesign({ id: 'stored-mock', requestId: 'stored', mode: 'mock', status: 'succeeded' });
  instance.manager.store.putDesign({ id: 'stored-live', requestId: 'stored-live', mode: 'live', status: 'succeeded' });
  value = await get(); assert.equal(value.remainingDesigns, 2);
  instance.personalizations.save({ id: 'personal-reservation', status: 'unknown', input: { requestId: 'personal' } });
  value = await get(); assert.equal(value.activeGeneration, true); assert.equal(value.generationAvailable, false); assert.equal(value.generationBlocker, 'personalization_busy');
  instance.personalizations.save({ id: 'personal-reservation', status: 'succeeded', input: { requestId: 'personal' } });
  instance.manager.store.putDesign({ id: 'stored-live', requestId: 'stored-live', mode: 'live', status: 'unknown' });
  value = await get(); assert.equal(value.activeGeneration, true); assert.equal(value.generationBlocker, 'design_busy');
  instance.manager.store.putDesign({ id: 'stored-live', requestId: 'stored-live', mode: 'live', status: 'succeeded' });
  for (let i = 0; i < 2; i++) instance.manager.store.putDesign({ id: `limit-${i}`, requestId: `limit-${i}`, mode: 'mock', status: 'failed' });
  value = await get(); assert.equal(value.remainingDesigns, 0); assert.equal(value.activeGeneration, false);
  assert.equal(value.generationAvailable, false); assert.equal(value.generationBlocker, 'design_limit');
});

test('studio catalog remains private to local origin and existing session chooses only server catalog products', async t => {
  const { request, base } = await app(t, new Store(':memory:'), { categories: studioCatalog });
  assert.equal((await request('/api/designs/categories', undefined, { headers: { Origin: 'https://shop.test' } })).status, 403);
  const body = { prompt: 'Forest sketches', categoryId: 'towel', requestId: 'studio-towel' };
  assert.equal((await request('/api/growth/designs', body, { headers: { Origin: base } })).status, 401);
  const session = await request('/api/growth/session', {}, { headers: { Origin: base } });
  const cookie = session.headers.get('set-cookie').split(';')[0];
  const created = await request('/api/growth/designs', body, { headers: { Cookie: cookie, Origin: base } });
  assert.equal(created.status, 202);
  const state = await created.json();
  assert.equal((await (await request(`/api/designs/${state.designId}`)).json()).status, 'succeeded');
  assert.equal((await request('/api/growth/designs', { ...body, requestId: 'unknown', categoryId: 'external-provider-id' }, { headers: { Cookie: cookie, Origin: base } })).status, 400);
  assert.equal((await request('/api/growth/designs', { ...body, requestId: 'custom-options', selections: { fabric: 'unsafe' } }, { headers: { Cookie: cookie, Origin: base } })).status, 400);
});

test('generation capability stays disabled with missing live adapter or empty catalog', async t => {
  for (const [options, blocker] of [
    [{ mode: 'live', categories: studioCatalog }, 'provider_unavailable'],
    [{ categories: [] }, 'category_unavailable'],
  ]) {
    const { request } = await app(t, new Store(':memory:'), options);
    const value = await (await request('/api/designs/categories')).json();
    assert.equal(value.generationAvailable, false); assert.equal(value.generationBlocker, blocker);
  }
});

test('session-only studio has generation capability without enabling legacy bearer actions', async t => {
  const { request, base } = await app(t, new Store(':memory:'), { operatorToken: undefined, categories: studioCatalog });
  const metadata = await (await request('/api/designs/categories')).json();
  assert.equal(metadata.generationAvailable, true);
  assert.equal(metadata.generationBlocker, null);
  assert.equal(metadata.remainingDesigns, 3);
  const body = { prompt: 'Coastal birds', categoryId: 'scarf', requestId: 'session-only-design' };
  const headers = { Origin: base };
  assert.equal((await request('/api/growth/designs', body, { headers })).status, 401);
  const session = await request('/api/growth/session', {}, { headers });
  assert.equal(session.status, 200);
  headers.Cookie = session.headers.get('set-cookie').split(';')[0];
  const created = await request('/api/growth/designs', body, { headers });
  assert.equal(created.status, 202);
  const state = await created.json();
  assert.equal((await (await request(`/api/designs/${state.designId}`)).json()).status, 'succeeded');
  const legacy = await request('/api/designs', { ...body, requestId: 'legacy-disabled' }, { headers });
  assert.equal(legacy.status, 503);
  assert.equal((await legacy.json()).error.code, 'operator_disabled');
});
