import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { Store } from '../store.mjs';
import { createApp } from '../server.mjs';
import { createPublicDemo } from '../public-demo.mjs';
import { ApiError } from '../errors.mjs';

const category = { categoryId: 'category-fixture', selections: { fabric: 'recycled_pet', size: '18x18' } };
const source = { id: 'creator-source', requestId: 'creator-request', input: { prompt: 'Creator art', categoryId: category.categoryId, requestId: 'creator-request' }, mode: 'live', status: 'succeeded', stage: 'product', category,
  product: { id: 'creator-source', name: 'Creator pillow', imageUrl: 'https://example.test/original.png', imageSource: 'arcade', providerProductId: 'original-product', providerPatternId: 'original-pattern', providerJobId: 'original-job' } };
const input = { sourceDesignId: source.id, text: 'Yosemite 2026', requestId: 'customer-request' };
const baseInput = { prompt: 'Another creator art', categoryId: category.categoryId, requestId: 'new-creator-request' };
function provider(overrides = {}) {
  const calls = [];
  return { calls,
    async call(operation, body) {
      calls.push({ operation, body });
      if (operation === 'patterns/get') return { patternId: body.patternId, width: 1024, height: 1024, sourcePatternId: body.patternId === 'original-pattern' ? null : 'original-pattern' };
      return { jobId: 'refine-job' };
    },
    async startPattern(body) { calls.push({ operation: 'patterns/create', body }); return { jobId: 'base-pattern-job' }; },
    async startProduct(body) { calls.push({ operation: 'products/create', body }); return { jobId: 'customer-product-job' }; },
    async getJob(jobId) {
      calls.push({ operation: 'jobs/get', jobId });
      if (jobId === 'base-pattern-job') return { jobId, kind: 'pattern', status: 'running', result: null };
      return { jobId, kind: jobId === 'refine-job' ? 'pattern' : 'product', status: 'succeeded', result: jobId === 'refine-job' ? { patternId: 'customer-pattern' } : { productId: 'customer-product' } };
    },
    async getProduct(productId) { calls.push({ operation: 'products/get', productId }); return { productId, patternId: 'customer-pattern', title: 'Customer pillow', imageUrl: 'https://example.test/customer.png', createdAt: '2026-10-11T22:00:00Z', unitPrice: { amount: '40.56', currency: 'USD' } }; },
    ...overrides,
  };
}
async function fixture(t, options = {}) {
  const store = options.store || new Store(':memory:');
  if (!store.getDesign(source.id)) { store.putDesign(source); store.putProduct(source.product); }
  const adapter = options.adapter || provider();
  const app = createApp({ store, adapter, mode: 'live', category, operatorToken: 'fixture-operator', maxDesigns: 10, pollMs: 5, timeoutMs: 1000, ...options });
  await app.listen(0); t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const call = async (path, value, headers = {}, method = value === undefined ? 'GET' : 'POST') => {
    const response = await fetch(base + path, { method, headers: { Origin: base, ...(value === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
    return { status: response.status, value: await response.json(), response };
  };
  const session = await call('/api/growth/session', {});
  const auth = { Cookie: session.response.headers.get('set-cookie').split(';')[0] };
  return { app, store, adapter, call, auth, base };
}
async function done(call, id, auth) {
  for (let n = 0; n < 100; n++) {
    const result = await call(`/api/growth/personalizations/${id}`, undefined, auth);
    if (result.status !== 200 || !['queued', 'starting', 'running'].includes(result.value.status)) return result;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error('Personalization did not settle');
}
function saved(id, status = 'awaiting_product') {
  return { id, input: { ...input, requestId: id }, sourcePatternId: 'original-pattern', refinedPatternId: 'customer-pattern', category, status, stage: 'product', product: null };
}

test('personalization create/status/resume use the existing session and generation defaults off', async t => {
  const { app, call, auth, adapter } = await fixture(t);
  assert.equal((await call('/api/designs/categories')).value.personalizationGenerationEnabled, false);
  assert.equal((await call('/api/growth/personalizations', input)).status, 401);
  assert.equal((await call('/api/growth/personalizations/missing')).status, 401);
  assert.equal((await call('/api/growth/personalizations/missing/resume', {})).status, 401);
  assert.equal((await call('/api/growth/personalizations', input, auth)).value.error.code, 'personalization_disabled');
  app.personalizations.save(saved('private-customer'));
  const visible = await call('/api/growth/personalizations/private-customer', undefined, auth);
  assert.equal(visible.status, 200); assert.equal(visible.value.text, input.text);
  assert.equal((await call('/api/growth/personalizations/private-customer/resume', {}, auth)).value.error.code, 'personalization_disabled');
  for (const origin of ['https://jackery.cz', 'https://evil.example', 'null']) {
    assert.equal((await call('/api/growth/personalizations/private-customer', undefined, { ...auth, Origin: origin })).status, 403);
    assert.equal((await call('/api/growth/personalizations', input, { ...auth, Origin: origin })).status, 403);
  }
  assert.equal((await call('/api/growth/personalizations', undefined, auth, 'OPTIONS')).status, 403);
  assert.equal(adapter.calls.length, 0);
});

test('protected listing restores safe state and local request keys newest first without provider work', async t => {
  const { app, call, auth, adapter, base } = await fixture(t, { personalizationGenerationEnabled: true });
  assert.equal((await call('/api/growth/personalizations')).status, 401);
  assert.equal((await call('/api/growth/personalizations', undefined, { Cookie: 'growth_operator=invalid' })).status, 401);
  const empty = await call('/api/growth/personalizations', undefined, auth);
  assert.equal(empty.status, 200); assert.deepEqual(empty.value, { items: [] });
  const newest = { ...saved('newest-customer', 'running'), createdAt: '2026-10-11T22:00:00.000Z',
    input: { ...input, requestId: 'restore-request-newest' },
    refineBody: { secret: 'server-only' }, productBody: { secret: 'server-only' }, maskRegion: { secret: 'server-only' } };
  const oldest = { ...saved('oldest-customer', 'succeeded'), createdAt: '2026-10-11T20:00:00.000Z', input: { ...input, requestId: 'restore-request-oldest' } };
  // Insert the latest first: sorting must use time rather than reversing rows.
  app.personalizations.save(newest); app.personalizations.save(oldest);
  const before = app.personalizations.rows();
  app.personalizations.kick = () => { throw new Error('Listing must not kick work'); };
  for (let n = 0; n < 2; n++) {
    const result = await call('/api/growth/personalizations', undefined, auth);
    assert.equal(result.status, 200);
    assert.deepEqual(result.value, { items: [
      { ...app.personalizations.get(newest.id), requestId: newest.input.requestId },
      { ...app.personalizations.get(oldest.id), requestId: oldest.input.requestId },
    ] });
    assert.doesNotMatch(JSON.stringify(result.value), /refineBody|productBody|maskRegion|server-only/);
    assert.equal(result.response.headers.get('access-control-allow-origin'), null);
  }
  app.personalizations.generationEnabled = false;
  assert.equal((await call('/api/growth/personalizations', undefined, auth)).status, 200);
  for (const origin of ['https://jackery.cz', 'https://evil.example', 'null']) assert.equal((await call('/api/growth/personalizations', undefined, { ...auth, Origin: origin })).status, 403);
  assert.equal((await call('/api/growth/personalizations', undefined, auth, 'OPTIONS')).status, 403);
  const crossSite = await fetch(base + '/api/growth/personalizations', { headers: { ...auth, 'Sec-Fetch-Site': 'cross-site' } });
  assert.equal(crossSite.status, 403);
  assert.deepEqual(app.personalizations.rows(), before);
  assert.equal(adapter.calls.length, 0);
});

test('fixture-only enabled generation is idempotent, private, and retains creator provenance', async t => {
  const { call, auth, store, adapter } = await fixture(t, { personalizationGenerationEnabled: true });
  assert.equal((await call('/api/designs/categories')).value.personalizationGenerationEnabled, true);
  const created = await call('/api/growth/personalizations', input, auth);
  assert.equal(created.status, 202);
  const id = created.value.personalizationId;
  const result = await done(call, id, auth);
  assert.equal(result.status, 200); assert.equal(result.value.status, 'succeeded');
  assert.equal(result.value.product.providerPatternId, 'customer-pattern');
  assert.equal(result.value.refineJobId, 'refine-job'); assert.equal(result.value.productJobId, 'customer-product-job');
  assert.equal(result.value.product.sourcePatternId, 'original-pattern');
  assert.equal(result.value.product.personalizationText, 'Yosemite 2026');
  assert.equal(result.value.product.visualReviewRequired, true);
  assert.equal(result.value.refineBody, undefined); assert.equal(result.value.maskRegion, undefined);
  assert.deepEqual(store.getDesign(source.id), source);
  assert.deepEqual(store.products(), [source.product]);
  const publicData = (await call('/api/growth/public?campaign=main')).value;
  assert.equal(publicData.rewards.some(p => p.providerProductId === 'customer-product'), false);
  assert.equal((await call('/api/growth/personalizations', input, auth)).value.personalizationId, id);
  assert.equal((await call('/api/growth/personalizations', { ...input, text: 'Changed' }, auth)).status, 409);
  assert.equal((await call(`/api/growth/personalizations/${id}/resume`, { instruction: 'change everything' }, auth)).status, 400);
  assert.equal(adapter.calls.filter(c => c.operation === 'patterns/refine/editRegion').length, 1);
  assert.equal(adapter.calls.filter(c => c.operation === 'products/create').length, 1);
});

test('active personalization blocks base create and resume in both growth and legacy endpoints', async t => {
  const { app, store, call, auth, adapter } = await fixture(t, { personalizationGenerationEnabled: true });
  app.personalizations.save(saved('reserved-customer', 'unknown'));
  // A completed same-request replay remains a read of the original result.
  assert.equal((await call('/api/growth/designs', source.input, auth)).value.designId, source.id);
  store.putDesign({ ...source, id: 'interrupted-base', requestId: 'interrupted-base-request', status: 'awaiting_resume', stage: 'pattern', product: null });
  for (const [prefix, headers] of [['/api/growth/designs', auth], ['/api/designs', { Authorization: 'Bearer fixture-operator' }]]) {
    const created = await call(prefix, baseInput, headers);
    assert.equal(created.status, 409); assert.equal(created.value.error.code, 'personalization_busy');
    assert.equal((await call(`${prefix}/interrupted-base/resume`, {}, headers)).status, 409);
  }
  assert.equal((await call('/api/growth/personalizations/reserved-customer/resume', {}, auth)).value.error.code, 'unknown_start');
  assert.equal(adapter.calls.length, 0);
});

test('separate app and Store instances mutually reserve generation in the same SQLite database', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'arcade-api-reservation-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const firstKind of ['base', 'personalization']) {
    const filename = join(dir, `${firstKind}.sqlite`);
    const adapter = provider({ async getJob(jobId) { return { jobId, kind: 'pattern', status: 'running', result: null }; } });
    const first = await fixture(t, { store: new Store(filename), adapter, personalizationGenerationEnabled: true });
    const second = await fixture(t, { store: new Store(filename), adapter, personalizationGenerationEnabled: true });
    const firstPath = firstKind === 'base' ? '/api/growth/designs' : '/api/growth/personalizations';
    const nextPath = firstKind === 'base' ? '/api/growth/personalizations' : '/api/growth/designs';
    const accepted = await first.call(firstPath, firstKind === 'base' ? baseInput : input, first.auth);
    assert.equal(accepted.status, 202);
    const rejected = await second.call(nextPath, firstKind === 'base' ? input : baseInput, second.auth);
    assert.equal(rejected.status, 409);
    assert.equal(rejected.value.error.code, 'personalization_busy');
    assert.equal(second.store.designs().some(row => row.id === accepted.value.designId), firstKind === 'base');
    // Replaying the active request from the second app never dispatches again.
    assert.equal((await second.call(firstPath, firstKind === 'base' ? baseInput : input, second.auth)).status, 202);
    await first.app.close(); await second.app.close();
    assert.equal(adapter.calls.filter(c => ['patterns/create', 'patterns/refine/editRegion'].includes(c.operation)).length, 1);
    assert.equal(adapter.calls.filter(c => c.operation === 'products/create').length, 0);
  }
});

test('active base work blocks personalization create and explicit resume', async t => {
  const { app, call, auth, adapter } = await fixture(t, { personalizationGenerationEnabled: true });
  const base = await call('/api/growth/designs', baseInput, auth);
  assert.equal(base.status, 202);
  app.personalizations.save(saved('interrupted-customer'));
  assert.equal((await call('/api/growth/personalizations', input, auth)).status, 409);
  const resumed = await call('/api/growth/personalizations/interrupted-customer/resume', {}, auth);
  assert.equal(resumed.status, 409); assert.equal(resumed.value.error.code, 'personalization_busy');
  assert.equal(adapter.calls.filter(c => c.operation === 'patterns/refine/editRegion' || c.operation === 'products/create').length, 0);
});

test('application restart recovers known jobs by reads only and explicit resume starts the pending product once', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'arcade-api-recovery-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const filename = join(dir, 'demo.sqlite');
  const adapter = provider();
  const initial = await fixture(t, { store: new Store(filename), adapter });
  initial.app.personalizations.save({ ...saved('restart-customer', 'running'), stage: 'refine', refinedPatternId: null, refineJobId: 'refine-job', refineBody: { requestId: 'restart-customer:refine' } });
  await initial.app.close();
  const reopened = await fixture(t, { store: new Store(filename), adapter });
  const recovered = await done(reopened.call, 'restart-customer', reopened.auth);
  assert.equal(recovered.value.status, 'awaiting_product');
  assert.equal(recovered.value.refineJobId, 'refine-job'); assert.equal(recovered.value.refinedPatternId, 'customer-pattern');
  assert.equal(adapter.calls.some(c => c.operation === 'products/create' || c.operation === 'patterns/refine/editRegion'), false);
  assert.equal((await reopened.call('/api/growth/personalizations/restart-customer/resume', {}, reopened.auth)).value.error.code, 'personalization_disabled');
  // Enabling is fixture-only; production bootstrap retains the false default.
  reopened.app.personalizations.generationEnabled = true;
  assert.equal((await reopened.call('/api/growth/personalizations/restart-customer/resume', {}, reopened.auth)).status, 202);
  assert.equal((await done(reopened.call, 'restart-customer', reopened.auth)).value.status, 'succeeded');
  assert.equal((await reopened.call('/api/growth/personalizations/restart-customer/resume', {}, reopened.auth)).status, 202);
  assert.equal(adapter.calls.filter(c => c.operation === 'products/create').length, 1);
  assert.equal(adapter.calls.filter(c => c.operation === 'patterns/refine/editRegion').length, 0);
  assert.deepEqual(reopened.store.products(), [source.product]);
});

test('public gateway never forwards personalization or operator-session requests even with a valid cookie', async t => {
  const { app, auth, adapter } = await fixture(t, { personalizationGenerationEnabled: true });
  app.personalizations.save(saved('private-customer'));
  const proxy = createPublicDemo({ publicOrigin: 'https://demo.example', upstream: `http://127.0.0.1:${app.server.address().port}` });
  await proxy.listen(0); t.after(() => proxy.close());
  for (const [method, path] of [['POST', '/api/growth/session'], ['GET', '/api/growth/personalizations'], ['POST', '/api/growth/personalizations'], ['GET', '/api/growth/personalizations/private-customer'], ['POST', '/api/growth/personalizations/private-customer/resume']]) {
    const status = await new Promise((resolve, reject) => {
      const req = request(`http://127.0.0.1:${proxy.server.address().port}${path}`, { method, headers: { Host: 'demo.example', Origin: 'https://demo.example', ...auth, 'Content-Type': 'application/json' } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
      req.on('error', reject); req.end(method === 'GET' ? undefined : JSON.stringify(path.endsWith('/personalizations') ? input : {}));
    });
    assert.equal(status, 404, path);
  }
  assert.equal(adapter.calls.length, 0);
});

test('restart preserves ambiguous starts and unstarted rows without dispatch from reads', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'arcade-api-unknown-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const filename = join(dir, 'demo.sqlite');
  const adapter = provider();
  const initial = await fixture(t, { store: new Store(filename), adapter });
  initial.app.personalizations.save({ ...saved('ambiguous-customer', 'starting'), stage: 'refine', refinedPatternId: null, refineBody: { requestId: 'ambiguous-customer:refine' } });
  initial.app.personalizations.save({ ...saved('unstarted-customer', 'queued'), stage: 'refine', refinedPatternId: null });
  await initial.app.close();
  const reopened = await fixture(t, { store: new Store(filename), adapter, personalizationGenerationEnabled: true });
  for (let n = 0; n < 3; n++) {
    const unknown = await reopened.call('/api/growth/personalizations/ambiguous-customer', undefined, reopened.auth);
    assert.equal(unknown.value.status, 'unknown'); assert.equal(unknown.value.refineJobId, null);
    assert.equal((await reopened.call('/api/growth/personalizations/unstarted-customer', undefined, reopened.auth)).value.status, 'awaiting_resume');
  }
  assert.equal((await reopened.call('/api/growth/personalizations/ambiguous-customer/resume', {}, reopened.auth)).value.error.code, 'unknown_start');
  assert.equal((await reopened.call('/api/growth/designs', baseInput, reopened.auth)).status, 409);
  assert.equal(adapter.calls.length, 0);
});

test('a delayed recovery poll cannot overwrite a product completed by another app instance', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'arcade-api-stale-poll-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const filename = join(dir, 'demo.sqlite');
  const pending = [];
  const refined = { jobId: 'refine-job', kind: 'pattern', status: 'succeeded', result: { patternId: 'customer-pattern' } };
  t.after(() => { for (const release of pending) release(refined); });
  const adapter = provider({ async getJob(jobId) {
    if (jobId === 'refine-job') return new Promise(resolve => pending.push(resolve));
    return { jobId, kind: 'product', status: 'succeeded', result: { productId: 'customer-product' } };
  } });
  const initial = await fixture(t, { store: new Store(filename), adapter });
  initial.app.personalizations.save({ ...saved('shared-recovery', 'running'), stage: 'refine', refinedPatternId: null, refineJobId: 'refine-job' });
  await initial.app.close();
  const first = await fixture(t, { store: new Store(filename), adapter, personalizationGenerationEnabled: true });
  const second = await fixture(t, { store: new Store(filename), adapter, personalizationGenerationEnabled: true });
  assert.equal(pending.length, 2);
  pending[0](refined);
  assert.equal((await done(first.call, 'shared-recovery', first.auth)).value.status, 'awaiting_product');
  assert.equal((await first.call('/api/growth/personalizations/shared-recovery/resume', {}, first.auth)).status, 202);
  assert.equal((await done(first.call, 'shared-recovery', first.auth)).value.status, 'succeeded');
  pending[1](refined);
  await second.app.personalizations.tasks.get('shared-recovery');
  const latest = await first.call('/api/growth/personalizations/shared-recovery', undefined, first.auth);
  assert.equal(latest.value.status, 'succeeded');
  assert.equal(latest.value.productJobId, 'customer-product-job');
  assert.equal(latest.value.product.providerProductId, 'customer-product');
  assert.equal(adapter.calls.filter(c => c.operation === 'products/create').length, 1);
});

test('a failed stale refine read cannot release the reservation of an active product job', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'arcade-api-stale-error-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const filename = join(dir, 'demo.sqlite');
  const pending = [];
  const refined = { jobId: 'refine-job', kind: 'pattern', status: 'succeeded', result: { patternId: 'customer-pattern' } };
  t.after(() => { for (const wait of pending) wait.resolve(refined); });
  let productPoll;
  const enteredProduct = new Promise(resolve => { productPoll = resolve; });
  const adapter = provider({ async getJob(jobId) {
    if (jobId === 'refine-job') return new Promise((resolve, reject) => pending.push({ resolve, reject }));
    productPoll(); return { jobId, kind: 'product', status: 'running', result: null };
  } });
  const initial = await fixture(t, { store: new Store(filename), adapter });
  initial.app.personalizations.save({ ...saved('shared-error', 'running'), stage: 'refine', refinedPatternId: null, refineJobId: 'refine-job' });
  await initial.app.close();
  const first = await fixture(t, { store: new Store(filename), adapter, personalizationGenerationEnabled: true });
  const second = await fixture(t, { store: new Store(filename), adapter, personalizationGenerationEnabled: true });
  assert.equal(pending.length, 2);
  pending[0].resolve(refined);
  assert.equal((await done(first.call, 'shared-error', first.auth)).value.status, 'awaiting_product');
  await first.call('/api/growth/personalizations/shared-error/resume', {}, first.auth);
  await enteredProduct;
  pending[1].reject(new ApiError(502, 'provider_failed', 'Old refine read failed'));
  await second.app.personalizations.tasks.get('shared-error');
  const latest = await first.call('/api/growth/personalizations/shared-error', undefined, first.auth);
  assert.equal(latest.value.status, 'running');
  assert.equal(latest.value.productJobId, 'customer-product-job');
  assert.equal(first.app.personalizations.hasActive(), true);
  assert.equal((await second.call('/api/growth/designs', baseInput, second.auth)).status, 409);
  assert.equal(adapter.calls.filter(c => c.operation === 'products/create').length, 1);
});
