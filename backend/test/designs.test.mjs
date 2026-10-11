import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../store.mjs';
import { Designs } from '../designs.mjs';

const category = { categoryId: 'actual-category-fixture', name: 'Outdoor pillow', world: 'print', canManufacture: true, selections: { size: '18x18', material: 'polyester' } };
const input = { prompt: 'Coastal trails', categoryId: category.categoryId, requestId: 'design-request-1' };
const product = { productId: 'provider-product-fixture', patternId: 'provider-pattern-fixture', title: 'Coastal pillow', imageUrl: 'https://example.test/pillow.png', images: [{ url: 'https://example.test/full.png' }], createdAt: '2026-10-11T12:00:00Z', unitPrice: { amount: '48.00', currency: 'USD' } };

function fixture(t, overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'rewards-'));
  const path = join(dir, 'test.sqlite');
  const store = new Store(path);
  const calls = [];
  const adapter = {
    async startPattern(body) { calls.push(['pattern', body]); return { jobId: 'pattern-job-fixture' }; },
    async startProduct(body) { calls.push(['product', body]); return { jobId: 'product-job-fixture' }; },
    async getJob(id) { calls.push(['read', id]); return { jobId: id, kind: id.startsWith('pattern') ? 'pattern' : 'product', status: 'succeeded', result: id.startsWith('pattern') ? { patternId: product.patternId } : { productId: product.productId } }; },
    async getProduct() { return product; },
    ...overrides,
  };
  const manager = new Designs({ store, adapter, mode: 'live', category, pollMs: 5, timeoutMs: 40, maxDesigns: 3 });
  t.after(async () => { await manager.close(); store.close(); rmSync(dir, { recursive: true, force: true }); });
  return { path, store, manager, adapter, calls };
}

async function settled(manager, id) {
  for (let i = 0; i < 150; i++) {
    const value = manager.get(id);
    if (!['queued', 'starting', 'running'].includes(value.status)) return value;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error('Design did not settle');
}

test('one request runs pattern then product and stores real provenance with separate price', async t => {
  const { manager, store, calls } = fixture(t);
  const created = manager.create(input);
  assert.equal(created.status, 'queued');
  const done = await settled(manager, created.designId);
  assert.equal(done.status, 'succeeded');
  assert.equal(done.product.imageSource, 'arcade');
  assert.equal(done.product.providerJobId, 'product-job-fixture');
  assert.equal(done.product.providerPatternId, 'provider-pattern-fixture');
  assert.equal(done.product.providerProductId, 'provider-product-fixture');
  assert.deepEqual(done.product.providerUnitPrice, { amount: '48.00', currency: 'USD' });
  assert.equal(store.products().length, 1);
  const starts = calls.filter(([kind]) => kind !== 'read');
  assert.equal(starts.length, 2);
  assert.deepEqual(starts[1][1].selections, { size: '18x18', material: 'polyester' });
  assert.equal(starts[1][1].patternId, 'provider-pattern-fixture');
  assert.notEqual(starts[0][1].requestId, starts[1][1].requestId);
  assert.equal(manager.create(input).designId, created.designId);
  assert.equal(calls.filter(([kind]) => kind !== 'read').length, 2);
  assert.throws(() => manager.create({ ...input, prompt: 'Different' }), { code: 'request_conflict' });
});

test('failed provider job never becomes an illustration or starts a product', async t => {
  const { manager, calls } = fixture(t, { async getJob(jobId) { return { jobId, kind: 'pattern', status: 'failed', result: null, error: { message: 'Failed' } }; } });
  const done = await settled(manager, manager.create(input).designId);
  assert.equal(done.status, 'failed');
  assert.equal(done.product, null);
  assert.equal(calls.filter(([kind]) => kind === 'product').length, 0);
});

test('timeout preserves job and explicit resume only reads the same job', async t => {
  const { manager, store, adapter, calls } = fixture(t, { async getJob(jobId) { return { jobId, kind: 'pattern', status: 'running', result: null }; } });
  const id = manager.create(input).designId;
  const timedOut = await settled(manager, id);
  assert.equal(timedOut.status, 'timed_out');
  assert.equal(store.getDesign(id).patternJobId, 'pattern-job-fixture');
  assert.throws(() => manager.create({ ...input, requestId: 'other' }), { code: 'design_busy' });
  adapter.getJob = async jobId => ({ jobId, kind: jobId.startsWith('pattern') ? 'pattern' : 'product', status: 'succeeded', result: jobId.startsWith('pattern') ? { patternId: product.patternId } : { productId: product.productId } });
  manager.resume(id);
  assert.equal((await settled(manager, id)).status, 'succeeded');
  assert.equal(calls.filter(([kind]) => kind === 'pattern').length, 1);
});

test('restart resumes a stored product job without create calls and requestId survives', async t => {
  const { store, manager, calls } = fixture(t);
  store.putDesign({ id: 'restart-design', requestId: input.requestId, input, mode: 'live', status: 'running', stage: 'product', productJobId: 'product-job-fixture', patternJobId: 'pattern-job-fixture', patternId: product.patternId, category, product: null });
  await manager.recover();
  const done = await settled(manager, 'restart-design');
  assert.equal(done.status, 'succeeded');
  assert.equal(calls.filter(([kind]) => kind !== 'read').length, 0);
  assert.equal(manager.create(input).designId, 'restart-design');
});

test('ambiguous start is never retried by reads, replay, resume or recovery', async t => {
  const { manager, calls } = fixture(t, { async startPattern(body) { calls.push(['pattern', body]); throw new Error('Connection lost'); } });
  const id = manager.create(input).designId;
  assert.equal((await settled(manager, id)).status, 'unknown');
  manager.get(id); manager.create(input); await manager.recover();
  assert.throws(() => manager.resume(id), { code: 'unknown_start' });
  assert.equal(calls.length, 1);
});

test('crash after marking start but before saving job is unknown and blocks another job', async t => {
  const { store, manager, calls } = fixture(t);
  store.putDesign({ id: 'crashed', requestId: input.requestId, input, mode: 'live', status: 'starting', stage: 'pattern', category, product: null });
  await manager.recover();
  assert.equal(manager.get('crashed').status, 'unknown');
  assert.equal(calls.length, 0);
  assert.throws(() => manager.create({ ...input, requestId: 'other' }), { code: 'design_busy' });
});

test('persistent generation limit and SQLite data survive reopening', async t => {
  const { manager, store, path } = fixture(t);
  for (let i = 0; i < 3; i++) await settled(manager, manager.create({ ...input, requestId: `request-${i}` }).designId);
  assert.throws(() => manager.create({ ...input, requestId: 'over-limit' }), { code: 'design_limit' });
  const reopened = new Store(path);
  t.after(() => reopened.close());
  assert.equal(reopened.designs().length, 3);
  assert.equal(reopened.products().length, 3);
  assert.equal(reopened.getDesignRequest('request-0').status, 'succeeded');
  assert.equal(store.designs().length, 3);
});

test('invalid polling response preserves job reservation and can be resumed', async t => {
  const { manager, adapter } = fixture(t, { async getJob() { return { status: 'nonsense' }; } });
  const id = manager.create(input).designId;
  assert.equal((await settled(manager, id)).status, 'timed_out');
  assert.throws(() => manager.create({ ...input, requestId: 'second' }), { code: 'design_busy' });
  adapter.getJob = async jobId => ({ jobId, kind: jobId.startsWith('pattern') ? 'pattern' : 'product', status: 'succeeded', result: jobId.startsWith('pattern') ? { patternId: product.patternId } : { productId: product.productId } });
  manager.resume(id);
  assert.equal((await settled(manager, id)).status, 'succeeded');
});

test('late pattern success cannot start the product after the deadline', async t => {
  const { manager, calls } = fixture(t, { async getJob(jobId) {
    await new Promise(resolve => setTimeout(resolve, 70));
    return { jobId, kind: 'pattern', status: 'succeeded', result: { patternId: product.patternId } };
  } });
  const done = await settled(manager, manager.create(input).designId);
  assert.equal(done.status, 'timed_out');
  assert.equal(done.stage, 'pattern');
  assert.equal(calls.filter(([kind]) => kind === 'product').length, 0);
});

test('a job response from a different identity or kind cannot advance the design', async t => {
  const { manager, calls } = fixture(t, { async getJob() { return { jobId: 'wrong-job', kind: 'product', status: 'succeeded', result: { patternId: product.patternId } }; } });
  const done = await settled(manager, manager.create(input).designId);
  assert.equal(done.status, 'timed_out'); assert.equal(done.product, null);
  assert.equal(calls.filter(([kind]) => kind === 'product').length, 0);
});

test('simultaneous managers cannot dispatch the same stage twice', async t => {
  // This test exercises admission/idempotency, not the fixture's 40 ms deadline.
  t.mock.timers.enable({ apis: ['Date'], now: 1000 });
  const { manager, store, adapter, calls } = fixture(t);
  const second = new Designs({ store, adapter, mode: 'live', category, pollMs: 5, timeoutMs: 1000, maxDesigns: 3 });
  t.after(() => second.close());
  const created = manager.create(input);
  assert.equal(second.create(input).designId, created.designId);
  assert.equal((await settled(manager, created.designId)).status, 'succeeded');
  assert.equal(calls.filter(([kind]) => kind === 'pattern').length, 1);
  assert.equal(calls.filter(([kind]) => kind === 'product').length, 1);
});

test('catalog selection uses server defaults and rejects arbitrary categories or client selections', async t => {
  const { manager, store, adapter, calls } = fixture(t);
  const scarf = { ...category, categoryId: 'scarf-fixture', name: 'Scarves', selections: { fabric: 'silk', size: 'large' } };
  const studio = new Designs({ store, adapter, mode: 'live', category, categories: [category, scarf], pollMs: 5, timeoutMs: 1000 });
  t.after(() => studio.close());
  const created = studio.create({ ...input, categoryId: scarf.categoryId });
  scarf.selections.fabric = 'client-change';
  assert.equal((await settled(studio, created.designId)).status, 'succeeded');
  assert.equal(calls.find(([kind]) => kind === 'product')[1].categoryId, 'scarf-fixture');
  assert.deepEqual(calls.find(([kind]) => kind === 'product')[1].selections, { fabric: 'silk', size: 'large' });
  assert.deepEqual(store.getDesign(created.designId).category.selections, { fabric: 'silk', size: 'large' });
  assert.throws(() => studio.create({ ...input, requestId: 'wrong-category', categoryId: 'provider-arbitrary' }), { code: 'unsupported_category' });
  assert.throws(() => studio.create({ ...input, requestId: 'client-options', selections: { size: 'invented' } }), { code: 'invalid_input' });
  assert.equal(manager.store.products().length, 1);
});

test('restart retains original category defaults even when the startup catalog changes', async t => {
  const { store, manager, adapter, path, calls } = fixture(t);
  const original = { ...category, categoryId: 'tea-towel-fixture', name: 'Tea Towels', selections: { fabric: 'linen', size: 'standard' } };
  const originalInput = { ...input, categoryId: original.categoryId };
  store.putDesign({ id: 'original-towel-design', requestId: input.requestId, input: originalInput, mode: 'live', status: 'running', stage: 'pattern',
    patternJobId: 'pattern-job-fixture', category: original, product: null });
  await manager.close();
  const reopened = new Store(path);
  const changed = new Designs({ store: reopened, adapter, mode: 'live', categories: [category], category, pollMs: 5, timeoutMs: 1000 });
  t.after(async () => { await changed.close(); reopened.close(); });
  await changed.recover();
  assert.equal((await settled(changed, 'original-towel-design')).status, 'awaiting_product');
  assert.equal(calls.filter(([kind]) => kind === 'product').length, 0);
  assert.equal(changed.create(originalInput).designId, 'original-towel-design');
  changed.resume('original-towel-design');
  assert.equal((await settled(changed, 'original-towel-design')).status, 'succeeded');
  const body = calls.find(([kind]) => kind === 'product')[1];
  assert.equal(body.categoryId, original.categoryId);
  assert.deepEqual(body.selections, original.selections);
  assert.equal(calls.filter(([kind]) => kind === 'pattern').length, 0);
});
