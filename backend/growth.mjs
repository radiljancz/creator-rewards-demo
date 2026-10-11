import { randomBytes, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { isDeepStrictEqual } from 'node:util';
import { ApiError, exactObject, textField } from './errors.mjs';
import { createCustomerPersonalizations, customerRoute } from './customer-personalizations.mjs';
import { CreatorCollection } from './collection.mjs';

const defaults = {
  id: 'main', shopName: 'Jackery demo', shopUrl: 'https://jackery.cz', currency: 'USD',
  creator: { id: 'alex', name: 'Alex Morgan' },
  products: [{ id: 'weekend', name: 'Weekend power set', price: 99900, cost: 53900 }, { id: 'adventure', name: 'Adventure power set', price: 129900, cost: 77900 }],
  economics: { minRetained: 30000, campaignCap: 22000, creatorCommission: 6000, platformFee: 2000, rewardCost: 14000 },
};
const fail = (message, status = 400, code = 'invalid_input') => { throw new ApiError(status, code, message); };
function id(value, label = 'ID') {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) fail(`Invalid ${label}`);
  return value;
}
function money(value) { if (!Number.isSafeInteger(value) || value < 0 || value > 1e9) fail('Money must be integer cents between 0 and 1000000000'); return value; }
function configInput(value) {
  exactObject(value, ['id', 'shopName', 'shopUrl', 'currency', 'creator', 'products', 'economics'], ['revision']);
  if (value.id !== 'main' || value.currency !== 'USD') fail('Only campaign main and currency USD are supported');
  let url; try { url = new URL(value.shopUrl); } catch { fail('Invalid shop URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || isIP(url.hostname) || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(url.hostname) || /\.(local|localhost|internal|test|invalid)$/i.test(url.hostname)) fail('Use an HTTPS public shop hostname without credentials or a custom port');
  exactObject(value.creator, ['id', 'name']);
  if (!Array.isArray(value.products) || !value.products.length || value.products.length > 20) fail('Use 1–20 products');
  const seen = new Set();
  const products = value.products.map(product => {
    exactObject(product, ['id', 'name', 'price', 'cost']); id(product.id);
    if (seen.has(product.id)) fail('Duplicate product ID'); seen.add(product.id);
    return { id: product.id, name: textField(product.name, 'product name', 100), price: money(product.price), cost: money(product.cost) };
  });
  exactObject(value.economics, Object.keys(defaults.economics));
  return { id: 'main', shopName: textField(value.shopName, 'shop name', 100), shopUrl: url.href, currency: 'USD',
    creator: { id: id(value.creator.id), name: textField(value.creator.name, 'creator name', 100) }, products,
    economics: Object.fromEntries(Object.entries(value.economics).map(([key, amount]) => [key, money(amount)])) };
}
function cart(value, config) {
  if (!Array.isArray(value) || value.length > 10) fail('Use at most ten cart entries');
  const seen = new Set();
  return value.map(item => {
    exactObject(item, ['productId', 'quantity']);
    if (!config.products.some(product => product.id === item.productId) || seen.has(item.productId)) fail('Unknown or duplicate product');
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) fail('Quantity must be 1–10');
    seen.add(item.productId); return { productId: item.productId, quantity: item.quantity };
  });
}
function calculate(items, config) {
  let basketTotal = 0, margin = 0;
  for (const item of items) { const p = config.products.find(p => p.id === item.productId); basketTotal += p.price * item.quantity; margin += (p.price - p.cost) * item.quantity; }
  const e = config.economics, available = Math.max(0, Math.min(e.campaignCap, margin - e.minRetained));
  const eligible = items.length > 0 && margin >= e.minRetained && e.creatorCommission + e.platformFee <= available;
  const creatorCommission = eligible ? e.creatorCommission : 0, platformFee = eligible ? e.platformFee : 0;
  const merchantSubsidy = eligible ? Math.min(e.rewardCost, available - creatorCommission - platformFee) : 0;
  return { eligible, ...(eligible ? {} : { reason: 'insufficient_margin' }), basketTotal, orderContributionBefore: margin,
    campaignBudget: available, creatorCommission, platformFee, productCost: e.rewardCost, merchantSubsidy, fanCopay: e.rewardCost - merchantSubsidy,
    merchantContributionAfter: margin - creatorCommission - platformFee - merchantSubsidy, currency: 'USD', pricingSource: 'merchant_model' };
}
function publicQuote(value) {
  const { orderContributionBefore, merchantContributionAfter, campaignBudget, creatorCommission, platformFee, ...visible } = value;
  return visible;
}
async function body(req) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') fail('Use application/json', 415, 'json_required');
  let length = 0; const chunks = [];
  for await (const chunk of req) { length += chunk.length; if (length > 16384) fail('Request exceeds 16 KiB', 413, 'body_too_large'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('Invalid JSON'); }
}

export function createGrowth({ store, products, collection: providedCollection, designs, personalizations, mode = 'mock', customerPersonalizationEnabled = false }) {
  const db = store.db;
  const collection = providedCollection ?? new CreatorCollection({ store, products });
  const publishedProducts = () => collection.published();
  const customers = createCustomerPersonalizations({ personalizations, products: publishedProducts, enabled: customerPersonalizationEnabled });
  db.exec(`CREATE TABLE IF NOT EXISTS growth_config (id TEXT PRIMARY KEY, value TEXT NOT NULL, revision INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS growth_events (seq INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT UNIQUE NOT NULL, input TEXT NOT NULL, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS growth_seen (event_id TEXT PRIMARY KEY, input TEXT NOT NULL, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS growth_stats (type TEXT PRIMARY KEY, count INTEGER NOT NULL);`);
  db.prepare('INSERT OR IGNORE INTO growth_config VALUES (?,?,1)').run('main', JSON.stringify(defaults));
  const sessions = new Map(), rates = new Map();
  function configuration() { const row = db.prepare('SELECT value,revision FROM growth_config WHERE id=?').get('main'); return { ...JSON.parse(row.value), revision: row.revision }; }
  function rate(key, limit = 120) {
    const now = Date.now();
    for (const [key, bucket] of rates) if (bucket.until < now) rates.delete(key);
    if (!rates.has(key)) { if (rates.size >= 500) fail('Demo session limit reached', 429, 'rate_limit'); rates.set(key, { count: 0, until: now + 60000 }); }
    if (++rates.get(key).count > limit) fail('Slow down demo requests', 429, 'rate_limit');
  }
  function sessionToken(req) {
    const token = /(?:^|;\s*)growth_operator=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    return token && (sessions.get(token) || 0) > Date.now() ? token : null;
  }
  function authenticate(req) {
    if (!sessionToken(req)) fail('Start a browser operator session', 401, 'operator_required');
  }
  function reward(rewardId) { if (!publishedProducts().some(product => product.id === rewardId)) fail('Unknown reward'); return rewardId; }
  function quoteInput(value, config) { exactObject(value, ['campaignId', 'items', 'rewardId']); if (value.campaignId !== 'main') fail('Unknown campaign'); reward(value.rewardId); return calculate(cart(value.items, config), config); }
  return {
    async handle(req, res, { path, baseOrigin }) {
      if (!path.startsWith('/api/growth/')) return false;
      const config = configuration(), shopOrigin = new URL(config.shopUrl).origin;
      const customer = customerRoute(path);
      const publicRoute = ['/api/growth/public', '/api/growth/quote', '/api/growth/events'].includes(path) || Boolean(customer);
      const origin = req.headers.origin;
      const external = Boolean(origin && origin !== baseOrigin);
      if (origin ? origin !== baseOrigin && (!publicRoute || origin !== shopOrigin) : req.method !== 'GET' || req.headers['sec-fetch-site'] === 'cross-site') fail('Origin is not allowed', 403, 'invalid_origin');
      if (external && publicRoute) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
      const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); return true; };
      if (req.method === 'OPTIONS') {
        if (!publicRoute) fail('Preflight is not allowed', 403, 'invalid_origin');
        res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '300' }); res.end(); return true;
      }
      if (req.method === 'GET') {
        if (path === '/api/growth/collection') { authenticate(req); return send(200, { items: collection.items() }); }
        if (customer?.action === 'create') return send(200, customers.list(new URL(req.url, baseOrigin), config));
        if (customer?.action === 'read') return send(200, customers.get(customer.id, new URL(req.url, baseOrigin)));
        if (path === '/api/growth/personalizations') {
          authenticate(req); if (!personalizations) fail('Personalization is unavailable', 503, 'personalizations_unavailable');
          const items = personalizations.rows()
            .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
            .map(row => ({ ...personalizations.get(row.id), requestId: row.input.requestId }));
          return send(200, { items });
        }
        const personalization = /^\/api\/growth\/personalizations\/([a-zA-Z0-9-]+)$/.exec(path);
        if (personalization) {
          authenticate(req); if (!personalizations) fail('Personalization is unavailable', 503, 'personalizations_unavailable');
          return send(200, personalizations.get(personalization[1]));
        }
        if (path === '/api/growth/config') return send(200, config);
        if (path === '/api/growth/public') {
          if (new URL(req.url, baseOrigin).searchParams.get('campaign') !== 'main') fail('Unknown campaign');
          return send(200, { id: config.id, shopName: config.shopName, shopUrl: config.shopUrl, currency: config.currency, creator: config.creator,
            products: config.products.map(({ cost, ...product }) => product), rewards: publishedProducts(), rewardCost: config.economics.rewardCost, revision: config.revision,
            customerPersonalizationEnabled: customers.available() });
        }
        if (path === '/api/growth/dashboard') {
          const events = db.prepare('SELECT value FROM growth_events ORDER BY seq DESC LIMIT 200').all().map(row => JSON.parse(row.value));
          const stats = Object.fromEntries(db.prepare('SELECT type,count FROM growth_stats').all().map(row => [row.type, row.count]));
          return send(200, { config, events, stats: { visits: stats.visit || 0, selections: stats.reward_selected || 0, simulatedCheckouts: stats.checkout_simulated || 0 },
            demoConnected: events.some(event => event.origin === baseOrigin), shopConnected: events.some(event => event.origin === shopOrigin), observationSource: 'browser_reported', mode });
        }
      }
      if (!['POST', 'PUT'].includes(req.method)) fail('Unknown endpoint', 404, 'not_found');
      rate('requests', 600);
      const value = await body(req);
      const collectionAction = /^\/api\/growth\/collection\/([a-zA-Z0-9_-]{1,128})\/(archive|restore)$/.exec(path);
      if (req.method === 'POST' && collectionAction) {
        authenticate(req); exactObject(value, []);
        return send(200, collection.setArchived(collectionAction[1], collectionAction[2] === 'archive'));
      }
      if (req.method === 'POST' && customer && customer.action !== 'read') {
        if (new URL(req.url, baseOrigin).search) fail('Unexpected query parameters');
        rate('customer-generation', 30);
        return send(202, customer.action === 'create' ? customers.create(value, config) : customers.resume(customer.id, value));
      }
      if (req.method === 'POST' && (path === '/api/growth/personalizations' || /^\/api\/growth\/personalizations\/[^/]+\/resume$/.test(path))) {
        authenticate(req); if (!personalizations) fail('Personalization is unavailable', 503, 'personalizations_unavailable');
        if (path === '/api/growth/personalizations') return send(202, personalizations.create(value, { authorized: true }));
        const match = /^\/api\/growth\/personalizations\/([a-zA-Z0-9-]+)\/resume$/.exec(path);
        if (match) { exactObject(value, []); return send(202, personalizations.resume(match[1], { authorized: true })); }
      }
      if (req.method === 'POST' && path === '/api/growth/session') {
        exactObject(value, []);
        let token = sessionToken(req);
        if (!token) {
          rate('operator', 20);
          for (const [token, expires] of sessions) if (expires <= Date.now()) sessions.delete(token);
          if (sessions.size >= 20) fail('Operator session limit reached', 429, 'rate_limit');
          token = randomBytes(32).toString('hex');
        }
        sessions.set(token, Date.now() + 4 * 3600000);
        res.setHeader('Set-Cookie', `growth_operator=${token}; HttpOnly; SameSite=Strict; Path=/api/growth; Max-Age=14400${baseOrigin.startsWith('https:') ? '; Secure' : ''}`);
        return send(200, { operatorSession: true, mode });
      }
      if (req.method === 'PUT' && path === '/api/growth/config') {
        authenticate(req); const next = configInput(value);
        db.prepare('UPDATE growth_config SET value=?,revision=revision+1 WHERE id=?').run(JSON.stringify(next), 'main'); return send(200, configuration());
      }
      if (req.method === 'POST' && path === '/api/growth/quote') { const result = quoteInput(value, config); return send(200, external ? publicQuote(result) : result); }
      if (req.method === 'POST' && path === '/api/growth/events') {
        exactObject(value, ['campaignId', 'creatorId', 'sessionId', 'eventId', 'type'], ['rewardId', 'items', 'personalization', 'personalizationId']);
        if (value.campaignId !== 'main' || value.creatorId !== config.creator.id) fail('Unknown campaign or creator');
        id(value.sessionId); id(value.eventId);
        if (!['visit', 'reward_selected', 'basket_updated', 'checkout_simulated'].includes(value.type)) fail('Unknown event type');
        const canonical = { ...value, origin: origin || baseOrigin };
        const existing = db.prepare('SELECT input,value FROM growth_seen WHERE event_id=?').get(value.eventId);
        if (existing) {
          if (!isDeepStrictEqual(JSON.parse(existing.input), canonical)) fail('Event ID already has different input', 409, 'event_conflict');
          const event = JSON.parse(existing.value); if (external && event.quote) event.quote = publicQuote(event.quote);
          return send(200, { duplicate: true, event });
        }
        if (value.rewardId !== undefined) reward(value.rewardId);
        if (['reward_selected', 'checkout_simulated'].includes(value.type) && !value.rewardId) fail('Reward is required');
        if (value.items !== undefined) cart(value.items, config);
        if (['basket_updated', 'checkout_simulated'].includes(value.type) && !value.items) fail('Basket is required');
        if (value.personalization !== undefined) {
          if (!['reward_selected', 'checkout_simulated'].includes(value.type)) fail('Personalization belongs to a selection or simulated checkout');
          exactObject(value.personalization, ['text']);
          if (typeof value.personalization.text !== 'string' || [...value.personalization.text].length > 32 || /[\u0000-\u001f\u007f]/.test(value.personalization.text)) fail('Personalization must contain at most 32 visible characters');
        }
        const personalizedProduct = value.personalizationId === undefined ? null : customers.validateEvent(value);
        rate('visitor:' + value.sessionId, 60);
        if (db.prepare('SELECT COUNT(*) AS n FROM growth_seen').get().n >= 10000) fail('Demo event capacity reached', 429, 'event_limit');
        const event = { ...canonical, id: randomUUID(), createdAt: new Date().toISOString(), observationSource: 'browser_reported', paymentOccurred: false, orderPlaced: false, payoutsOccurred: false,
          ...(value.personalization ? { personalizationStatus: personalizedProduct ? 'arcade_generated' : 'visual_preview_only' } : {}),
          ...(personalizedProduct ? { personalizedProviderProductId: personalizedProduct.providerProductId } : {}),
          ...(value.items ? { quote: calculate(cart(value.items, config), config) } : {}) };
        store.transaction(() => {
          db.prepare('INSERT INTO growth_seen VALUES (?,?,?)').run(value.eventId, JSON.stringify(canonical), JSON.stringify(event));
          db.prepare('INSERT INTO growth_events (event_id,input,value) VALUES (?,?,?)').run(value.eventId, JSON.stringify(canonical), JSON.stringify(event));
          db.prepare('INSERT INTO growth_stats VALUES (?,1) ON CONFLICT(type) DO UPDATE SET count=count+1').run(value.type);
          db.exec('DELETE FROM growth_events WHERE seq NOT IN (SELECT seq FROM growth_events ORDER BY seq DESC LIMIT 200)');
        });
        if (external && event.quote) event.quote = publicQuote(event.quote);
        return send(201, { duplicate: false, event });
      }
      if (req.method === 'POST' && (path === '/api/growth/designs' || /^\/api\/growth\/designs\/[^/]+\/(resume|refresh)$/.test(path))) {
        authenticate(req); if (!designs) fail('Generation is unavailable', 503, 'designs_unavailable');
        if (path === '/api/growth/designs') return send(202, await designs.create(value));
        const match = /^\/api\/growth\/designs\/([a-zA-Z0-9-]+)\/(resume|refresh)$/.exec(path);
        if (match) { exactObject(value, []); return send(match[2] === 'resume' ? 202 : 200, await designs[match[2]](match[1])); }
      }
      fail('Unknown endpoint', 404, 'not_found');
    },
  };
}
