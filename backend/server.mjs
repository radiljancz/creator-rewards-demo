import { createServer } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { campaign, quote } from './campaign.mjs';
import { ApiError, exactObject, textField } from './errors.mjs';
import { Designs } from './designs.mjs';
import { createGrowth } from './growth.mjs';
import { Personalizations } from './personalizations.mjs';
import { CreatorCollection } from './collection.mjs';

export const mockCategory = { categoryId: 'mock-textile', name: 'Illustrative pillow (mock)', world: 'print', canManufacture: true, selections: {}, options: [] };

function categoryPreview(category) {
  let imageUrl = null;
  try { if (new URL(category.imageUrl).protocol === 'https:') imageUrl = category.imageUrl; } catch {}
  return { categoryId: category.categoryId, name: category.name, world: category.world, canManufacture: category.canManufacture,
    imageUrl, selections: category.selections, options: (category.options ?? []).map(option => ({ key: option.key, label: option.label,
      values: (option.values ?? []).map(value => ({ value: value.value, label: value.label, available: value.available, isDefault: value.isDefault })) })) };
}

async function jsonBody(req) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new ApiError(415, 'json_required', 'Use application/json');
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16384) throw new ApiError(413, 'body_too_large', 'Request exceeds 16 KiB');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ApiError(400, 'invalid_json', 'Invalid JSON'); }
}

export function createApp({ store, mode = 'mock', operatorToken, adapter, category = mode === 'mock' ? mockCategory : null, categories, maxDesigns = 3, pollMs = 2500, timeoutMs = 180000,
  personalizationGenerationEnabled = false, customerPersonalizationEnabled = false, maxPersonalizations = 1 }) {
  const personalizations = new Personalizations({ store, adapter, generationEnabled: personalizationGenerationEnabled === true && mode === 'live' && Boolean(adapter), maxPersonalizations, pollMs, timeoutMs });
  const manager = new Designs({ store, mode, adapter, category, categories, maxDesigns, pollMs, timeoutMs, admit: () => {
    if (personalizations.hasActive()) throw new ApiError(409, 'personalization_busy', 'Resolve the existing personalization first');
  } });
  const collection = new CreatorCollection({ store, products: () => [...campaign.collection.products, ...store.products()] });
  const products = () => collection.published();
  const growth = createGrowth({ store, products, collection, designs: manager, personalizations, mode, customerPersonalizationEnabled });
  let closed = false;
  function operator(req) {
    if (!operatorToken) throw new ApiError(503, 'operator_disabled', 'Set DEMO_OPERATOR_TOKEN on the server to enable operator actions');
    const provided = req.headers.authorization ?? '';
    const expected = `Bearer ${operatorToken}`;
    if (Buffer.byteLength(provided) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) throw new ApiError(401, 'operator_required', 'Operator authorization is required');
  }
  function complete(value) {
    exactObject(value, ['campaignId', 'productId', 'scenarioId', 'requestId']);
    const requestId = textField(value.requestId, 'requestId');
    const input = { campaignId: value.campaignId, productId: value.productId, scenarioId: value.scenarioId };
    return store.transaction(() => {
      const existing = store.getCompletion(requestId);
      if (existing) {
        if (!isDeepStrictEqual(existing.input, input)) throw new ApiError(409, 'request_conflict', 'requestId was used with a different scenario');
        return existing.value;
      }
      const result = { ...quote(input, products()), completionId: randomUUID(), requestId, status: 'simulated',
        completedAt: new Date().toISOString(), paymentOccurred: false, orderPlaced: false, payoutsOccurred: false,
        message: 'Simulation complete — no payment or order occurred' };
      store.putCompletion(requestId, input, result); return result;
    });
  }
  const server = createServer(async (req, res) => {
    const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
    try {
      const port = server.address()?.port;
      const hosts = [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`];
      if (!hosts.includes(req.headers.host)) throw new ApiError(403, 'invalid_host', 'Only the local demo origin is allowed');
      const path = new URL(req.url, `http://${req.headers.host}`).pathname;
      if (await growth.handle(req, res, { path, baseOrigin: `http://${req.headers.host}` })) return;
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) throw new ApiError(403, 'invalid_origin', 'Cross-origin requests are not allowed');
      if (req.method === 'GET') {
        const pages = { '/': ['index.html', 'text/html'], '/shop': ['shop.html', 'text/html'], '/present': ['presentation.html', 'text/html'], '/rewards.js': ['rewards.js', 'application/javascript'] };
        if (pages[path]) {
          const [file, mime] = pages[path];
          const content = await readFile(new URL(`../prototype/${file}`, import.meta.url));
          res.writeHead(200, { 'Content-Type': `${mime}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
          return res.end(content);
        }
        if (path === '/api/demo/campaign') return send(200, { ...campaign, collection: { ...campaign.collection, products: products() } });
        if (path === '/api/designs/categories') {
          const remainingDesigns = Math.max(0, maxDesigns - store.designs().filter(row => row.mode === mode).length);
          const activeDesign = manager.hasActive(), activePersonalization = personalizations.hasActive();
          const generationBlocker = !manager.categories.length ? 'category_unavailable'
            : mode === 'live' && !adapter ? 'provider_unavailable' : activePersonalization ? 'personalization_busy'
            : activeDesign ? 'design_busy' : remainingDesigns === 0 ? 'design_limit' : null;
          return send(200, { mode, items: manager.categories.map(categoryPreview), generationAvailable: generationBlocker === null,
            generationBlocker, remainingDesigns, maxDesigns, activeGeneration: activeDesign || activePersonalization,
            personalizationGenerationEnabled: personalizations.generationEnabled });
        }
        const match = /^\/api\/designs\/([a-zA-Z0-9-]+)$/.exec(path);
        if (match) return send(200, manager.get(match[1]));
        if (path === '/assets/coastal-pillow.svg') {
          const svg = await readFile(new URL('./assets/coastal-pillow.svg', import.meta.url));
          res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'X-Content-Type-Options': 'nosniff' }); return res.end(svg);
        }
        if (path === '/' || path === '/creator-rewards.html') {
          try {
            const html = await readFile(new URL('../prototype/creator-rewards.html', import.meta.url));
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(html);
          } catch { return send(200, { name: 'Creator Rewards demo backend', campaign: '/api/demo/campaign', docs: 'docs/backend-api.md', demo: true }); }
        }
      }
      if (req.method === 'POST') {
        if (path === '/api/designs' || /^\/api\/designs\/[^/]+\/(resume|refresh)$/.test(path)) operator(req);
        const value = await jsonBody(req);
        if (path === '/api/demo/quote') return send(200, quote(value, products()));
        if (path === '/api/demo/complete') return send(200, complete(value));
        if (path === '/api/designs') return send(202, manager.create(value));
        const match = /^\/api\/designs\/([a-zA-Z0-9-]+)\/(resume|refresh)$/.exec(path);
        if (match) {
          exactObject(value, []);
          return send(match[2] === 'resume' ? 202 : 200, match[2] === 'resume' ? manager.resume(match[1]) : await manager.refresh(match[1]));
        }
      }
      throw new ApiError(404, 'not_found', 'Unknown endpoint');
    } catch (error) {
      send(error instanceof ApiError ? error.status : 500, { error: { code: error instanceof ApiError ? error.code : 'internal_error', message: error instanceof ApiError ? error.message : 'Demo request failed' } });
    }
  });
  server.requestTimeout = 20000;
  return { server, manager, personalizations,
    async listen(port = 3000, host = '127.0.0.1') {
      if (!['127.0.0.1', '::1'].includes(host)) throw new ApiError(400, 'loopback_only', 'Shared hosting requires a separate protected server-session implementation');
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => { server.removeListener('error', reject); resolve(); }); });
      await manager.recover();
      // Recovery reads known jobs only; it cannot dispatch a refine/product.
      // In mock mode there is no provider adapter, so leave live jobs untouched.
      if (mode === 'live' && adapter) personalizations.recover();
    },
    async close() {
      if (closed) return; closed = true;
      const stopped = Promise.all([manager.close(), personalizations.close()]);
      if (server.listening) await new Promise(resolve => server.close(resolve));
      await stopped; store.close();
    },
  };
}
