import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { request as httpRequest } from 'node:http';
import { Store } from '../store.mjs';
import { createApp } from '../server.mjs';
import { createPublicDemo } from '../public-demo.mjs';

const source = { id: 'creator-design', requestId: 'source-request', mode: 'live', status: 'succeeded', stage: 'product',
  category: { categoryId: 'pillow', selections: { size: '18x18' } },
  product: { id: 'creator-design', name: 'Original design', imageSource: 'arcade', imageUrl: 'https://example.test/original.png',
    providerProductId: 'provider-product', providerPatternId: 'provider-pattern', providerJobId: 'provider-job' } };

async function fixture(t, path = ':memory:') {
  const store = new Store(path);
  if (!store.getDesign(source.id)) { store.putDesign(source); store.putProduct(source.product); }
  let providerCalls = 0;
  const rejectProvider = async () => { providerCalls++; throw new Error('Archive must never call provider'); };
  const adapter = { call: rejectProvider, getJob: rejectProvider, getProduct: rejectProvider, startPattern: rejectProvider, startProduct: rejectProvider };
  const app = createApp({ store, mode: 'live', adapter, category: source.category, maxDesigns: 20,
    personalizationGenerationEnabled: true, customerPersonalizationEnabled: true, maxPersonalizations: 20 });
  await app.listen(0); t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const call = async (path, value, headers = {}, method = value === undefined ? 'GET' : 'POST') => {
    const response = await fetch(base + path, { method, headers: { Origin: base, ...(value === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
    return { status: response.status, value: await response.json(), response };
  };
  const session = await call('/api/growth/session', {});
  const auth = { Cookie: session.response.headers.get('set-cookie').split(';')[0] };
  return { store, app, base, call, auth, providerCalls: () => providerCalls };
}

test('collection list and archive actions require existing local operator session', async t => {
  const f = await fixture(t);
  const paths = ['/api/growth/collection', `/api/growth/collection/${source.id}/archive`, `/api/growth/collection/${source.id}/restore`];
  for (const path of paths) {
    const body = path === paths[0] ? undefined : {};
    assert.equal((await f.call(path, body)).status, 401);
    for (const Origin of ['https://jackery.cz', 'https://evil.example', 'null']) assert.equal((await f.call(path, body, { ...f.auth, Origin })).status, 403);
  }
  const list = await f.call(paths[0], undefined, f.auth);
  assert.equal(list.status, 200); assert.deepEqual(list.value.items.map(p => [p.id, p.archived]), [['coastal-pillow', false], [source.id, false]]);
  assert.equal(list.response.headers.get('access-control-allow-origin'), null);
  assert.equal((await f.call('/api/growth/collection/missing/archive', {}, f.auth)).status, 404);
  assert.equal((await f.call('/api/growth/collection/missing/restore', {}, f.auth)).status, 404);
  assert.equal((await f.call(paths[1], { delete: true }, f.auth)).status, 400);
  assert.equal((await f.call(paths[1], {}, f.auth, 'PUT')).status, 404);
  assert.equal(f.providerCalls(), 0);
});

test('archive excludes public rewards and all quotes, is idempotent, and restore republishes intact rows', async t => {
  const f = await fixture(t), originalDesigns = f.store.designs(), originalProducts = f.store.products();
  const input = { campaignId: 'main', rewardId: source.id, items: [{ productId: 'weekend', quantity: 1 }] };
  const legacy = { campaignId: 'creator-rewards-demo', productId: source.id, scenarioId: 'small' };
  assert.equal((await f.call('/api/growth/quote', input)).status, 200);
  for (let n = 0; n < 2; n++) {
    const archived = await f.call(`/api/growth/collection/${source.id}/archive`, {}, f.auth);
    assert.equal(archived.status, 200); assert.deepEqual(archived.value, { productId: source.id, archived: true });
  }
  assert.deepEqual((await f.call('/api/growth/public?campaign=main')).value.rewards.map(p => p.id), ['coastal-pillow']);
  assert.deepEqual((await f.call('/api/demo/campaign')).value.collection.products.map(p => p.id), ['coastal-pillow']);
  assert.equal((await f.call('/api/growth/quote', input)).status, 400);
  assert.equal((await f.call('/api/demo/quote', legacy)).status, 404);
  assert.equal((await f.call('/api/demo/complete', { ...legacy, requestId: 'new-checkout' })).status, 404);
  for (let n = 0; n < 2; n++) assert.deepEqual((await f.call(`/api/growth/collection/${source.id}/restore`, {}, f.auth)).value, { productId: source.id, archived: false });
  assert.equal((await f.call('/api/growth/quote', input)).status, 200);
  assert.equal((await f.call('/api/demo/quote', legacy)).status, 200);
  assert.equal((await f.call('/api/growth/public?campaign=main')).value.rewards.some(p => p.id === source.id), true);
  assert.deepEqual(f.store.designs(), originalDesigns); assert.deepEqual(f.store.products(), originalProducts);
  assert.equal(f.providerCalls(), 0);
});

test('archiving retains history and existing personalizations without admitting new source generations', async t => {
  const f = await fixture(t);
  const sessionId = randomUUID(), personalId = randomUUID(), requestId = randomUUID();
  const existing = { id: personalId, input: { requestId: `customer:${sessionId}:${requestId}`, sourceDesignId: source.id, text: 'Yosemite 2026' },
    customer: { sessionId, campaignId: 'main', creatorId: 'alex' }, status: 'succeeded', stage: 'product', sourcePatternId: 'provider-pattern',
    product: { ...source.product, id: personalId, providerProductId: 'derived-product' } };
  f.app.personalizations.save(existing);
  const activeId = randomUUID(); f.app.personalizations.save({ ...existing, id: activeId, input: { ...existing.input, requestId: 'other-personal' }, status: 'unknown', product: null });
  const events = [
    { campaignId: 'main', creatorId: 'alex', sessionId, eventId: randomUUID(), type: 'reward_selected', rewardId: source.id },
    { campaignId: 'main', creatorId: 'alex', sessionId, eventId: randomUUID(), type: 'checkout_simulated', rewardId: source.id,
      items: [{ productId: 'weekend', quantity: 1 }], personalization: { text: 'Yosemite 2026' }, personalizationId: personalId },
  ];
  for (const event of events) assert.equal((await f.call('/api/growth/events', event)).status, 201);
  const history = (await f.call('/api/growth/dashboard')).value;
  const completion = { campaignId: 'creator-rewards-demo', productId: source.id, scenarioId: 'small', requestId: 'historical-checkout' };
  const completed = await f.call('/api/demo/complete', completion); assert.equal(completed.status, 200);
  const rows = f.app.personalizations.rows();
  await f.call(`/api/growth/collection/${source.id}/archive`, {}, f.auth);
  assert.equal((await f.call('/api/growth/customer-personalizations', { campaignId: 'main', creatorId: 'alex', sessionId,
    sourceDesignId: source.id, text: 'New text', requestId: randomUUID() }, { Origin: 'https://jackery.cz' })).value.error.code, 'invalid_source');
  assert.equal((await f.call(`/api/growth/customer-personalizations/${personalId}?sessionId=${sessionId}`, undefined, { Origin: 'https://jackery.cz' })).value.status, 'succeeded');
  assert.equal((await f.call(`/api/growth/customer-personalizations/${activeId}?sessionId=${sessionId}`, undefined, { Origin: 'https://jackery.cz' })).value.status, 'unknown');
  assert.equal((await f.call('/api/growth/personalizations', undefined, f.auth)).value.items.length, 2);
  assert.deepEqual(f.app.personalizations.rows(), rows);
  for (const event of events) {
    const replay = await f.call('/api/growth/events', event); assert.equal(replay.status, 200); assert.equal(replay.value.duplicate, true);
    assert.equal((await f.call('/api/growth/events', { ...event, eventId: randomUUID() })).status, 400);
  }
  assert.deepEqual((await f.call('/api/growth/dashboard')).value, history);
  assert.deepEqual((await f.call('/api/demo/complete', completion)).value, completed.value);
  assert.equal(f.providerCalls(), 0);
});

test('independent archived IDs survive reopen and an empty published collection is valid', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'creator-archive-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'archive.sqlite');
  const first = await fixture(t, path), second = await fixture(t, path);
  const results = await Promise.all([
    first.call('/api/growth/collection/coastal-pillow/archive', {}, first.auth),
    second.call(`/api/growth/collection/${source.id}/archive`, {}, second.auth),
  ]);
  assert.ok(results.every(result => result.status === 200));
  assert.deepEqual((await first.call('/api/growth/public?campaign=main')).value.rewards, []);
  assert.deepEqual((await first.call('/api/demo/campaign')).value.collection.products, []);
  await first.app.close(); await second.app.close();
  const reopened = await fixture(t, path);
  assert.deepEqual((await reopened.call('/api/growth/collection', undefined, reopened.auth)).value.items.map(p => p.archived), [true, true]);
  assert.equal(reopened.store.designs().length, 1); assert.equal(reopened.store.products().length, 1);
  await reopened.call(`/api/growth/collection/${source.id}/restore`, {}, reopened.auth);
  assert.deepEqual((await reopened.call('/api/growth/public?campaign=main')).value.rewards.map(p => p.id), [source.id]);
  assert.equal(reopened.providerCalls(), 0);
});

test('public gateway never forwards collection reads or mutations even with an operator cookie', async t => {
  const f = await fixture(t);
  const gateway = createPublicDemo({ publicOrigin: 'https://demo.example', shopOrigin: 'https://jackery.cz', upstream: f.base });
  await gateway.listen(0); t.after(() => gateway.close());
  for (const path of ['/api/growth/collection', `/api/growth/collection/${source.id}/archive`, `/api/growth/collection/${source.id}/restore`]) {
    const code = await new Promise((resolve, reject) => {
      const req = httpRequest(`http://127.0.0.1:${gateway.server.address().port}${path}`, { method: path.endsWith('collection') ? 'GET' : 'POST',
        headers: { Host: 'demo.example', Origin: 'https://demo.example', ...f.auth, 'Content-Type': 'application/json' } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
      req.on('error', reject); req.end(path.endsWith('collection') ? undefined : '{}');
    });
    assert.equal(code, 404);
  }
  assert.equal(f.providerCalls(), 0);
});
