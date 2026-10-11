import test from 'node:test';
import assert from 'node:assert/strict';
import { Arcade } from '../arcade.mjs';

test('Arcade uses documented POST JSON operations and separate idempotency keys', async () => {
  const calls = [];
  const adapter = new Arcade({ key: 'test-secret', userAgent: 'CreatorRewardsDemo-test (local tests)', transport: async (url, init) => {
    calls.push({ url, ...init, body: JSON.parse(init.body) });
    return Response.json({ jobId: 'documented-job-fixture' });
  } });
  await adapter.startPattern({ requestId: 'pattern-request', prompt: 'Coast' });
  await adapter.startProduct({ requestId: 'product-request', patternId: 'pattern-fixture', categoryId: 'category-fixture', selections: { size: '18' }, fit: { mode: 'fill' } });
  await adapter.getJob('documented-job-fixture');
  assert.deepEqual(calls.map(value => value.url), ['https://platform.arcade.ai/v1/patterns/create', 'https://platform.arcade.ai/v1/products/create', 'https://platform.arcade.ai/v1/jobs/get']);
  assert.ok(calls.every(value => value.method === 'POST' && value.headers.Authorization === 'Bearer test-secret'));
  assert.deepEqual(calls[0].body, { requestId: 'pattern-request', prompt: 'Coast' });
  assert.deepEqual(calls[2].body, { jobId: 'documented-job-fixture' });
});

test('category comes from inventory and complete manufacturable selections', async () => {
  const adapter = new Arcade({ key: 'test', transport: async url => Response.json(url.endsWith('/list')
    ? { items: [{ categoryId: 'outdoor-pillow-fixture', name: 'Outdoor Pillow', world: 'print', imageUrl: null }, { categoryId: 'jewelry-fixture', name: 'Ring', world: 'jewelry', imageUrl: null }] }
    : { categoryId: 'outdoor-pillow-fixture', name: 'Outdoor Pillow', world: 'print', canManufacture: true, selections: { size: '18' }, options: [{ key: 'size', values: [{ value: '18', available: true, isDefault: true, label: '18 inches' }], label: 'Size' }] }) });
  const category = await adapter.demoCategory();
  assert.equal(category.categoryId, 'outdoor-pillow-fixture');
  assert.deepEqual(category.selections, { size: '18' });
  await assert.rejects(() => adapter.demoCategory('invented'), { code: 'unsupported_category' });
});

test('provider error cannot echo key and failed start is never automatically retried', async () => {
  let calls = 0;
  const adapter = new Arcade({ key: 'do-not-expose', transport: async () => { calls++; return Response.json({ message: 'do-not-expose' }, { status: 409 }); } });
  await assert.rejects(() => adapter.startPattern({ requestId: 'same', prompt: 'Coast' }), error => {
    assert.equal(error.status, 502); assert.equal(error.providerStatus, 409); assert.ok(!error.message.includes('do-not-expose')); return true;
  });
  assert.equal(calls, 1);
});

test('studio catalog resolves inventory IDs and keeps outdoor pillows before scarves and tea towels', async () => {
  const inventory = [
    { categoryId: 'tea-runtime-id', name: 'Tea Towels', world: 'print', imageUrl: 'https://example.test/towel.png' },
    { categoryId: 'ring-runtime-id', name: 'Scarves', world: 'jewelry' },
    { categoryId: 'scarf-runtime-id', name: 'Scarves', world: 'print' },
    { categoryId: 'indoor-runtime-id', name: 'Decorative Pillows', world: 'print' },
    { categoryId: 'outdoor-runtime-id', name: 'Outdoor Decorative Pillows', world: 'print' },
    { categoryId: 'shirt-runtime-id', name: 'T-shirts', world: 'print' },
  ];
  const calls = [];
  const adapter = new Arcade({ key: 'test', transport: async (url, init) => {
    const body = JSON.parse(init.body); calls.push({ url, body });
    return Response.json(url.endsWith('/list') ? { items: inventory } : {
      categoryId: body.categoryId, name: inventory.find(item => item.categoryId === body.categoryId).name,
      world: 'print', canManufacture: true, selections: { size: 'default' },
      options: [{ key: 'size', values: [{ value: 'default', available: true }] }],
    });
  } });
  const categories = await adapter.demoCategories();
  assert.deepEqual(categories.map(item => item.categoryId), ['outdoor-runtime-id', 'scarf-runtime-id', 'tea-runtime-id']);
  assert.equal(categories[2].imageUrl, 'https://example.test/towel.png');
  assert.deepEqual(calls.slice(1).map(item => item.body), categories.map(item => ({ categoryId: item.categoryId, selections: {} })));
  assert.deepEqual((await adapter.demoCategories('indoor-runtime-id')).map(item => item.categoryId), ['indoor-runtime-id', 'scarf-runtime-id', 'tea-runtime-id']);
  const before = calls.length;
  await assert.rejects(() => adapter.demoCategories('ring-runtime-id'), { code: 'unsupported_category' });
  assert.equal(calls.length, before + 1);
});

test('studio catalog omits unavailable or incomplete categories without inventing selections', async () => {
  const inventory = [
    { categoryId: 'outdoor', name: 'Outdoor Decorative Pillows', world: 'print' },
    { categoryId: 'scarf', name: 'Scarves', world: 'print' },
    { categoryId: 'towel', name: 'Tea Towels', world: 'print' },
    { categoryId: 'unavailable', name: 'Tea Towels', world: 'print', available: false },
  ];
  const lookedUp = [];
  const adapter = new Arcade({ key: 'test', transport: async (url, init) => {
    if (url.endsWith('/list')) return Response.json({ items: inventory });
    const { categoryId } = JSON.parse(init.body); lookedUp.push(categoryId);
    return Response.json({ categoryId, world: 'print', canManufacture: categoryId !== 'scarf',
      selections: categoryId === 'towel' ? {} : { size: '18' },
      options: [{ key: 'size', values: [{ value: '18', available: true }] }] });
  } });
  assert.deepEqual((await adapter.demoCategories()).map(item => item.categoryId), ['outdoor']);
  assert.deepEqual(lookedUp, ['outdoor', 'scarf', 'towel']);
});

test('unavailable preferred inventory pillow does not hide valid scarf and towel families', async () => {
  const items = [
    { categoryId: 'preferred-pillow', name: 'Outdoor Decorative Pillows', world: 'print', available: false },
    { categoryId: 'scarf', name: 'Scarves', world: 'print' },
    { categoryId: 'towel', name: 'Tea Towels', world: 'print' },
  ];
  const lookedUp = [];
  const adapter = new Arcade({ key: 'test', transport: async (url, init) => {
    if (url.endsWith('/list')) return Response.json({ items });
    const { categoryId } = JSON.parse(init.body); lookedUp.push(categoryId);
    return Response.json({ categoryId, world: 'print', canManufacture: true, selections: {}, options: [] });
  } });
  assert.deepEqual((await adapter.demoCategories('preferred-pillow')).map(item => item.categoryId), ['scarf', 'towel']);
  assert.deepEqual(lookedUp, ['scarf', 'towel']);
});

test('malformed option entries omit only their category and retain the rest of the catalog', async () => {
  const items = [
    { categoryId: 'pillow', name: 'Outdoor Decorative Pillows', world: 'print' },
    { categoryId: 'scarf', name: 'Scarves', world: 'print' },
    { categoryId: 'towel', name: 'Tea Towels', world: 'print' },
  ];
  const adapter = new Arcade({ key: 'test', transport: async (url, init) => {
    if (url.endsWith('/list')) return Response.json({ items });
    const { categoryId } = JSON.parse(init.body);
    return Response.json({ categoryId, world: 'print', canManufacture: true, selections: { size: 'default' },
      options: categoryId === 'pillow' ? [null] : [{ key: 'size', values: categoryId === 'scarf' ? [null] : [{ value: 'default', available: true }] }] });
  } });
  assert.deepEqual((await adapter.demoCategories()).map(item => item.categoryId), ['towel']);
});
