import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../store.mjs';
import { createApp } from '../server.mjs';
import { Designs } from '../designs.mjs';

test('completion replay survives database reopen with identical completionId and timestamp', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'rewards-completion-'));
  const path = join(dir, 'demo.sqlite');
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const body = { campaignId: 'creator-rewards-demo', productId: 'coastal-pillow', scenarioId: 'large', requestId: 'persistent-complete' };
  async function run() {
    const app = createApp({ store: new Store(path), mode: 'mock' });
    await app.listen(0);
    try {
      const res = await fetch(`http://127.0.0.1:${app.server.address().port}/api/demo/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(res.status, 200); return res.json();
    } finally { await app.close(); }
  }
  const first = await run(), replay = await run();
  assert.deepEqual(replay, first);
  assert.equal(first.fanCopay, 0); assert.equal(first.merchantContributionAfter, 30000);
});

test('pattern completion after restart waits for operator before starting the product stage', async t => {
  const store = new Store(':memory:');
  const category = { categoryId: 'category-fixture', selections: { size: '18' } };
  store.putDesign({ id: 'recover-pattern', requestId: 'recover-request', input: { prompt: 'Coast', categoryId: category.categoryId, requestId: 'recover-request' },
    mode: 'live', category, stage: 'pattern', status: 'running', patternJobId: 'saved-pattern-job', product: null });
  let starts = 0;
  const adapter = { async getJob(id) { assert.equal(id, 'saved-pattern-job'); return { jobId: id, kind: 'pattern', status: 'succeeded', result: { patternId: 'saved-pattern' } }; },
    async startProduct() { starts++; throw new Error('Not expected'); } };
  const manager = new Designs({ store, mode: 'live', adapter, category, pollMs: 5, timeoutMs: 1000, maxDesigns: 3 });
  t.after(async () => { await manager.close(); store.close(); });
  await manager.recover();
  for (let i = 0; i < 20 && manager.get('recover-pattern').status !== 'awaiting_product'; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(manager.get('recover-pattern').status, 'awaiting_product');
  assert.equal(store.getDesign('recover-pattern').patternId, 'saved-pattern');
  assert.equal(starts, 0);
});

test('a succeeded job with a deleted result never advances or claims a product', async t => {
  const store = new Store(':memory:');
  const category = { categoryId: 'category-fixture', selections: {} };
  const manager = new Designs({ store, mode: 'live', category, pollMs: 5, timeoutMs: 1000, maxDesigns: 3,
    adapter: { async startPattern() { return { jobId: 'deleted-result-job' }; }, async getJob(jobId) { return { jobId, kind: 'pattern', status: 'succeeded', result: null }; } } });
  t.after(async () => { await manager.close(); store.close(); });
  const id = manager.create({ prompt: 'Coast', categoryId: category.categoryId, requestId: 'deleted-result-request' }).designId;
  for (let i = 0; i < 20 && manager.get(id).status !== 'failed'; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(manager.get(id).status, 'failed'); assert.equal(manager.get(id).product, null); assert.equal(store.products().length, 0);
});
