import { DatabaseSync } from 'node:sqlite';

// Exercises actual SQLite statements, retaining D1's asynchronous statement interface.
export function sqliteD1(path = ':memory:') {
  const sqlite = new DatabaseSync(path);
  const wrap = (sql, args = []) => ({
    bind(...values) { return wrap(sql, values); },
    async first() { return sqlite.prepare(sql).get(...args) ?? null; },
    async all() { return { results: sqlite.prepare(sql).all(...args) }; },
    async run() { const result = sqlite.prepare(sql).run(...args); return { success: true, meta: { changes: Number(result.changes) } }; },
  });
  return { prepare: sql => wrap(sql), exec: sql => sqlite.exec(sql), close: () => sqlite.close() };
}
export const session = '11111111-1111-4111-8111-111111111111';
export const requestId = '22222222-2222-4222-8222-222222222222';
export const category = { categoryId: 'outdoor-pillow', name: 'Outdoor pillow', world: 'print', available: true, canManufacture: true,
  selections: { size: 'large' }, options: [{ key: 'size', values: [{ value: 'large', available: true }] }] };
export const snapshot = { campaign: { id: 'campaign', creator: { id: 'creator' } }, designs: [{ id: 'source', status: 'succeeded', mode: 'live', category,
  product: { id: 'source', imageSource: 'arcade', providerJobId: 'old-product-job', providerPatternId: 'original', providerProductId: 'old-product' } }],
  masks: {} };
export function provider({ uncertain = false, dimensions = [1024, 1024], wrongLineage = false } = {}) {
  const calls = [];
  let derivativeSource = 'original';
  const transport = async (url, options) => {
    const op = url.split('/v1/')[1], body = JSON.parse(options.body); calls.push({ op, body });
    if (uncertain && /create|editRegion/.test(op)) throw new Error('network interrupted after send');
    let result;
    if (op === 'categories/list') result = { items: [{ categoryId: category.categoryId, name: category.name, world: 'print', available: true }] };
    else if (op === 'categories/get') result = category;
    else if (op === 'patterns/create') result = { jobId: 'pattern-job' };
    else if (op === 'patterns/refine/editRegion') { derivativeSource = body.patternId; result = { jobId: 'refine-job' }; }
    else if (op === 'products/create') result = { jobId: `product-${body.patternId}` };
    else if (op === 'jobs/get') result = { jobId: body.jobId, kind: body.jobId.startsWith('product-') ? 'product' : 'pattern', status: 'succeeded',
      result: body.jobId.startsWith('product-') ? { productId: body.jobId } : { patternId: body.jobId === 'refine-job' ? 'derived' : 'new-pattern' } };
    else if (op === 'patterns/get') result = { patternId: body.patternId, sourcePatternId: wrongLineage ? 'foreign' : derivativeSource, width: dimensions[0], height: dimensions[1] };
    else if (op === 'products/get') result = { productId: body.productId, patternId: body.productId.slice('product-'.length), title: 'Textile', imageUrl: 'https://example.com/preview.png', createdAt: '2026-10-11T10:00:00Z', unitPrice: 42 };
    else throw new Error(`Unexpected operation ${op}`);
    return Response.json(result);
  };
  return { calls, transport };
}
