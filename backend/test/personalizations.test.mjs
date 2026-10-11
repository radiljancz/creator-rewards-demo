import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../store.mjs';
import { Personalizations, labelMask } from '../personalizations.mjs';

const source = { id: 'source-design-fixture', requestId: 'source-request-fixture', mode: 'live', status: 'succeeded', stage: 'product',
  category: { categoryId: 'category-fixture', selections: { fabric: 'recycled_pet', size: '18x18' } },
  product: { id: 'source-design-fixture', imageSource: 'arcade', providerProductId: 'original-product-fixture', providerPatternId: 'original-pattern-fixture', providerJobId: 'original-product-job-fixture' } };
const input = { sourceDesignId: source.id, text: 'Yosemite 2026', requestId: 'personalization-request-fixture' };

function fixture(t, overrides = {}) {
  const store = new Store(':memory:'); store.putDesign(source);
  const calls = [];
  const adapter = {
    async call(operation, body) {
      calls.push({ operation, body });
      if (operation === 'patterns/get') return { patternId: body.patternId, width: 1024, height: 1024, sourcePatternId: body.patternId === 'original-pattern-fixture' ? null : 'original-pattern-fixture' };
      if (operation === 'patterns/refine/editRegion') return { jobId: 'refine-job-fixture' };
      throw new Error('Unexpected operation');
    },
    async getJob(jobId) { return { jobId, kind: jobId === 'refine-job-fixture' ? 'pattern' : 'product', status: 'succeeded', result: jobId === 'refine-job-fixture' ? { patternId: 'derived-pattern-fixture' } : { productId: 'derived-product-fixture' } }; },
    async startProduct(body) { calls.push({ operation: 'products/create', body }); return { jobId: 'derived-product-job-fixture' }; },
    async getProduct() { return { productId: 'derived-product-fixture', patternId: 'derived-pattern-fixture', title: 'Personalized pillow', imageUrl: 'https://example.test/personalized.png', createdAt: '2026-10-11T20:30:00Z', unitPrice: { amount: '40.56', currency: 'USD' } }; },
    ...overrides,
  };
  const manager = new Personalizations({ store, adapter, generationEnabled: true, pollMs: 5, timeoutMs: 1000 });
  t.after(async () => { await manager.close(); store.close(); });
  return { store, adapter, calls, manager };
}
async function settled(manager, id) {
  for (let i = 0; i < 100; i++) {
    const state = manager.get(id);
    if (!['queued', 'starting', 'running'].includes(state.status)) return state;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error('Personalization did not settle');
}

test('server label mask preserves aspect ratio and leaves outside pixels transparent', () => {
  const mask = labelMask(3000, 1500);
  assert.equal(mask.width, 1536); assert.equal(mask.height, 768);
  const png = Buffer.from(mask.dataUrl.split(',')[1], 'base64');
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  let offset = 8; const data = [];
  while (offset < png.length) { const length = png.readUInt32BE(offset); const kind = png.toString('ascii', offset + 4, offset + 8); if (kind === 'IDAT') data.push(png.subarray(offset + 8, offset + 8 + length)); offset += length + 12; }
  const pixels = inflateSync(Buffer.concat(data)), stride = mask.width * 4 + 1;
  const alpha = (x, y) => pixels[y * stride + 1 + x * 4 + 3];
  assert.equal(alpha(0, 0), 0); assert.equal(alpha(768, 300), 0);
  assert.equal(alpha(768, 537), 255); // The visible lower-middle print area can change.
  assert.equal(alpha(768, 675), 0); // Preserve the bottom seam/crop area.
  assert.ok(mask.region.width >= 16 && mask.region.height >= 16);
});

test('module defaults to disabled and rejects unauthorized starts without provider calls', async t => {
  const { store, adapter, calls } = fixture(t);
  const disabled = new Personalizations({ store, adapter }); t.after(() => disabled.close());
  assert.throws(() => disabled.create(input, { authorized: true }), { code: 'personalization_disabled' });
  assert.throws(() => disabled.create(input), { code: 'operator_required' });
  assert.equal(calls.length, 0);
});

test('refine and product retain source provenance without changing the public creator collection', async t => {
  const { manager, store, calls } = fixture(t);
  const id = manager.create(input, { authorized: true }).personalizationId;
  const done = await settled(manager, id);
  assert.equal(done.status, 'succeeded');
  assert.equal(done.sourcePatternId, 'original-pattern-fixture');
  assert.equal(done.refinedPatternId, 'derived-pattern-fixture');
  assert.equal(done.product.providerPatternId, 'derived-pattern-fixture');
  assert.equal(done.product.providerJobId, 'derived-product-job-fixture');
  assert.deepEqual(store.getDesign(source.id), source);
  assert.equal(store.products().length, 0);
  const refine = calls.find(c => c.operation === 'patterns/refine/editRegion');
  assert.equal(refine.body.patternId, 'original-pattern-fixture');
  assert.ok(refine.body.instruction.includes('Yosemite 2026'));
  assert.ok(refine.body.mask.startsWith('data:image/png;base64,'));
  assert.deepEqual(calls.find(c => c.operation === 'products/create').body.selections, { fabric: 'recycled_pet', size: '18x18' });
  assert.equal(manager.create(input, { authorized: true }).personalizationId, id);
  assert.throws(() => manager.create({ ...input, text: 'Different' }, { authorized: true }), { code: 'request_conflict' });
  assert.equal(calls.filter(c => c.operation === 'patterns/refine/editRegion').length, 1);
});

test('rejects user instructions, masks, invalid text and mock sources', async t => {
  const { manager, store, calls } = fixture(t);
  for (const text of ['', 'a'.repeat(33), 'Yosemite\n2026', '<script>']) assert.throws(() => manager.create({ ...input, text }, { authorized: true }));
  assert.throws(() => manager.create({ ...input, instruction: 'replace whole image' }, { authorized: true }));
  store.putDesign({ ...source, id: 'mock-source', requestId: 'mock-source-request', mode: 'mock', product: { ...source.product, imageSource: 'illustration' } });
  assert.throws(() => manager.create({ ...input, sourceDesignId: 'mock-source' }, { authorized: true }), { code: 'invalid_source' });
  assert.equal(calls.length, 0);
});

test('ambiguous refine start remains reserved and cannot be retried by reads or resume', async t => {
  const { manager } = fixture(t, { async call(operation, body) { if (operation === 'patterns/get') return { patternId: body.patternId, width: 1024, height: 1024 }; throw new Error('Connection lost'); } });
  const id = manager.create(input, { authorized: true }).personalizationId;
  assert.equal((await settled(manager, id)).status, 'unknown');
  assert.throws(() => manager.resume(id, { authorized: true }), { code: 'unknown_start' });
  assert.throws(() => manager.create({ ...input, requestId: 'another' }, { authorized: true }), { code: 'personalization_busy' });
});

test('wrong source lineage never starts a personalized product', async t => {
  const { manager, calls } = fixture(t, { async call(operation, body) { if (operation === 'patterns/refine/editRegion') return { jobId: 'refine-job-fixture' }; return { patternId: body.patternId, width: 1024, height: 1024, sourcePatternId: 'another-source' }; } });
  const done = await settled(manager, manager.create(input, { authorized: true }).personalizationId);
  assert.equal(done.status, 'timed_out');
  assert.equal(calls.filter(c => c.operation === 'products/create').length, 0);
});

test('shutdown during the source lookup prevents a generation start', async t => {
  let release, entered, starts = 0;
  const reading = new Promise(resolve => { entered = resolve; });
  const pending = new Promise(resolve => { release = resolve; });
  const { manager, store } = fixture(t, { async call(operation) {
    if (operation === 'patterns/get') { entered(); return pending; }
    starts++; return { jobId: 'unexpected-job' };
  } });
  manager.create(input, { authorized: true });
  await reading;
  const closing = manager.close();
  release({ patternId: 'original-pattern-fixture', width: 1024, height: 1024 });
  await closing;
  assert.equal(starts, 0);
  assert.deepEqual(store.getDesign(source.id), source);
});

test('reopened-store recovery only polls the known refine job and reserves the product stage', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'arcade-personalization-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const filename = join(directory, 'demo.sqlite');
  const initialStore = new Store(filename); initialStore.putDesign(source);
  const initial = new Personalizations({ store: initialStore, adapter: {} });
  initial.save({ id: 'persisted-personalization', input, sourcePatternId: source.product.providerPatternId, category: source.category,
    status: 'running', stage: 'refine', refineJobId: 'persisted-refine-job' });
  await initial.close(); initialStore.close();
  const store = new Store(filename); const polls = [];
  const manager = new Personalizations({ store, adapter: { async getJob(jobId) {
    polls.push(jobId); return { jobId, kind: 'pattern', status: 'succeeded', result: { patternId: 'recovered-derivative' } };
  } } });
  t.after(async () => { await manager.close(); store.close(); });
  manager.recover();
  const done = await settled(manager, 'persisted-personalization');
  assert.equal(done.status, 'awaiting_product');
  assert.equal(done.refinedPatternId, 'recovered-derivative');
  assert.deepEqual(polls, ['persisted-refine-job']);
  assert.equal(manager.hasActive(), true);
  assert.deepEqual(store.getDesign(source.id), source);
});

test('timeout and authorized resume retain the existing refine job without another refine start', async t => {
  // Advance only after the persisted refine job is polled. Real CPU time spent
  // preparing the PNG must not decide which lifecycle stage this test exercises.
  t.mock.timers.enable({ apis: ['Date'], now: 1000 });
  let ready = false;
  const polls = [];
  const { manager, calls } = fixture(t, { async getJob(jobId) {
    polls.push(jobId);
    if (jobId === 'refine-job-fixture') {
      if (!ready) t.mock.timers.tick(31);
      return { jobId, kind: 'pattern', status: ready ? 'succeeded' : 'running', result: ready ? { patternId: 'derived-pattern-fixture' } : null };
    }
    return { jobId, kind: 'product', status: 'succeeded', result: { productId: 'derived-product-fixture' } };
  } });
  manager.timeoutMs = 30;
  const id = manager.create(input, { authorized: true }).personalizationId;
  const paused = await settled(manager, id);
  assert.equal(paused.status, 'timed_out');
  assert.equal(paused.refineJobId, 'refine-job-fixture');
  assert.deepEqual(polls, ['refine-job-fixture']);
  assert.equal(manager.hasActive(), true);
  ready = true; manager.timeoutMs = 1000;
  manager.resume(id, { authorized: true });
  assert.equal((await settled(manager, id)).status, 'succeeded');
  assert.equal(calls.filter(c => c.operation === 'patterns/refine/editRegion').length, 1);
  assert.equal(calls.filter(c => c.operation === 'products/create').length, 1);
  assert.deepEqual(polls, ['refine-job-fixture', 'refine-job-fixture', 'derived-product-job-fixture']);
  assert.equal(manager.hasActive(), false);
});

test('deadline expiry during source preparation does not start a refine job', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1000 });
  let starts = 0;
  const { manager } = fixture(t, { async call(operation, body) {
    if (operation === 'patterns/get') {
      t.mock.timers.tick(31);
      return { patternId: body.patternId, width: 1024, height: 1024 };
    }
    starts++; return { jobId: 'unexpected-job' };
  } });
  manager.timeoutMs = 30;
  const id = manager.create(input, { authorized: true }).personalizationId;
  const paused = await settled(manager, id);
  assert.equal(paused.status, 'timed_out');
  assert.equal(paused.refineJobId, null);
  assert.equal(starts, 0);
});

test('concurrent managers replaying one request cannot start a second refine or product', async t => {
  const { manager, store, adapter, calls } = fixture(t);
  const second = new Personalizations({ store, adapter, generationEnabled: true, pollMs: 5, timeoutMs: 1000 });
  t.after(() => second.close());
  const id = manager.create(input, { authorized: true }).personalizationId;
  assert.equal(second.create(input, { authorized: true }).personalizationId, id);
  assert.equal((await settled(manager, id)).status, 'succeeded');
  await second.close();
  assert.equal(calls.filter(c => c.operation === 'patterns/refine/editRegion').length, 1);
  assert.equal(calls.filter(c => c.operation === 'products/create').length, 1);
});
