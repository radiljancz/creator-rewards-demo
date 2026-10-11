import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { createPublicDemo } from '../public-demo.mjs';
import { createApp } from '../server.mjs';
import { Store } from '../store.mjs';

const publicOrigin = 'https://demo.example';
function httpFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = request(url, options, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(new Response(res.statusCode === 204 ? null : Buffer.concat(chunks), { status: res.statusCode, headers: res.headers })));
      res.on('error', reject);
    });
    req.on('error', reject); req.end(options.body);
  });
}
async function gateway(t, options = {}) {
  const app = options.app || createApp({ store: new Store(':memory:') });
  if (!options.app) { await app.listen(0); t.after(() => app.close()); }
  const upstream = `http://127.0.0.1:${app.server.address().port}`;
  const proxy = createPublicDemo({ publicOrigin, shopOrigin: 'https://jackery.cz', upstream, ...options });
  await proxy.listen(0); t.after(() => proxy.close());
  const base = `http://127.0.0.1:${proxy.server.address().port}`;
  const call = (path, value, headers = {}) => httpFetch(base + path, {
    method: value === undefined ? 'GET' : 'POST', headers: { Host: 'demo.example', ...(value === undefined ? {} : { Origin: publicOrigin, 'Content-Type': 'application/json' }), ...headers },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
  });
  return { app, base, call, upstream };
}

test('public demo allows storefront and real quote/events but hides private economics', async t => {
  const { call, upstream } = await gateway(t);
  assert.equal((await call('/shop?creator=alex')).status, 200);
  assert.equal((await call('/rewards.js')).status, 200);
  const pub = await (await call('/api/growth/public?campaign=main')).json();
  assert.equal(pub.products[0].cost, undefined);
  const input = { campaignId: 'main', rewardId: pub.rewards[0].id, items: [{ productId: 'weekend', quantity: 1 }] };
  const quote = await (await call('/api/growth/quote', input)).json();
  assert.equal(quote.fanCopay, 6000); assert.equal(quote.creatorCommission, undefined); assert.equal(quote.orderContributionBefore, undefined);
  const response = await call('/api/growth/events', { ...input, creatorId: 'alex', sessionId: 'demo-session', eventId: 'demo-event', type: 'checkout_simulated' });
  assert.equal(response.status, 201);
  const event = (await response.json()).event;
  assert.equal(event.quote.campaignBudget, undefined); assert.equal(event.quote.merchantContributionAfter, undefined);
  assert.equal(event.paymentOccurred, false);
  const dashboard = await (await fetch(upstream + '/api/growth/dashboard')).json();
  assert.equal(dashboard.demoConnected, true); assert.equal(dashboard.shopConnected, false);
});

test('gateway rejects private paths, wrong Hosts/origins and unsupported methods', async t => {
  const { call, base } = await gateway(t);
  for (const path of ['/', '/api/growth/config', '/api/growth/dashboard', '/api/growth/session', '/api/growth/designs', '/api/designs/categories', '/api/demo/campaign', '/.env.local', '/shop/../api/growth/config', '/api/growth/public?campaign=other']) {
    assert.equal((await call(path)).status, 404, path);
  }
  assert.equal((await call('/rewards.js', undefined, { Host: 'attacker.example' })).status, 403);
  assert.equal((await call('/api/growth/public?campaign=main', undefined, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await call('/api/growth/quote', {}, { Origin: 'null' })).status, 403);
  const noOrigin = await httpFetch(base + '/api/growth/quote', { method: 'POST', headers: { Host: 'demo.example', 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(noOrigin.status, 403);
  assert.equal((await httpFetch(base + '/shop', { method: 'DELETE', headers: { Host: 'demo.example' } })).status, 404);
});

test('Shopify origin is retained and CORS is exact without credentials', async t => {
  const { call, base, upstream } = await gateway(t);
  const response = await call('/api/growth/events', { campaignId: 'main', creatorId: 'alex', sessionId: 'shop-session', eventId: 'shop-event', type: 'visit' }, { Origin: 'https://jackery.cz' });
  assert.equal(response.status, 201); assert.equal(response.headers.get('access-control-allow-origin'), 'https://jackery.cz');
  assert.equal(response.headers.get('access-control-allow-credentials'), null);
  const dashboard = await (await fetch(upstream + '/api/growth/dashboard')).json();
  assert.equal(dashboard.shopConnected, true); assert.equal(dashboard.demoConnected, false);
  const preflight = await httpFetch(base + '/api/growth/events', { method: 'OPTIONS', headers: { Host: 'demo.example', Origin: 'https://jackery.cz', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type, ngrok-skip-browser-warning' } });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-headers'), /ngrok-skip-browser-warning/i);
});

test('proxy never forwards browser credentials or trusts forwarded origins', async t => {
  let seen;
  const server = createServer((req, res) => { seen = req.headers; res.writeHead(200, { 'Content-Type': 'application/javascript', 'Set-Cookie': 'private=secret', 'X-Private': 'secret' }); res.end('console.log("safe")'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const { call } = await gateway(t, { app: { server } });
  const response = await call('/rewards.js', undefined, { Cookie: 'secret-cookie', Authorization: 'Bearer secret-token', 'X-Forwarded-Host': 'evil.example', 'X-Forwarded-For': '1.2.3.4' });
  assert.equal(response.status, 200);
  for (const header of ['cookie', 'authorization', 'x-forwarded-host', 'x-forwarded-for']) assert.equal(seen[header], undefined);
  assert.equal(response.headers.get('set-cookie'), null); assert.equal(response.headers.get('x-private'), null);
});

test('upstream is loopback only and malformed public configuration cannot create a proxy', () => {
  for (const upstream of ['https://example.com', 'http://evil.example:3100', 'http://127.0.0.1:3100/secret', 'http://user:pass@127.0.0.1:3100', 'http://127.0.0.1:3100?x=y']) {
    assert.throws(() => createPublicDemo({ publicOrigin, upstream }), /upstream/i);
  }
  for (const origin of ['http://demo.example', 'https://demo.example/path', 'https://user:pass@demo.example', 'https://demo.example?x=y']) assert.throws(() => createPublicDemo({ publicOrigin: origin }), /origin/i);
});

test('oversize bodies and upstream failures are bounded and generic', async t => {
  const { call } = await gateway(t);
  assert.equal((await call('/api/growth/quote', { value: 'x'.repeat(17000) })).status, 413);
  const response = await call('/api/growth/quote', { secret: 'not-reflected' });
  assert.equal(response.status, 400);
  assert.doesNotMatch(await response.text(), /not-reflected|stack|ApiError/);
});

test('gateway bounds per-socket IP traffic without trusting forwarded IPs', async t => {
  const { call } = await gateway(t, { requestsPerMinute: 2 });
  assert.equal((await call('/rewards.js')).status, 200);
  assert.equal((await call('/rewards.js', undefined, { 'X-Forwarded-For': '1.1.1.1' })).status, 200);
  assert.equal((await call('/rewards.js', undefined, { 'X-Forwarded-For': '2.2.2.2' })).status, 429);
});

test('unresponsive upstream times out without exposing error details', async t => {
  const server = createServer(() => {});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const { call } = await gateway(t, { app: { server }, timeoutMs: 20 });
  const response = await call('/rewards.js');
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: { code: 'public_demo_request_failed', message: 'Public demo request could not be completed' } });
});

test('customer personalization routes forward only exact methods, UUIDs, queries and origins', async t => {
  const seen = [];
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    seen.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() });
    res.writeHead(req.method === 'POST' ? 202 : 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ personalizationId: '2fe8f378-0dea-47d4-9bdf-82fa6d77b902', status: 'running', mode: 'live' }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const { call, base, upstream } = await gateway(t, { app: { server } });
  const root = '/api/growth/customer-personalizations';
  const job = '2fe8f378-0dea-47d4-9bdf-82fa6d77b902', sessionId = '5d7fab7a-27fa-4c6d-a62a-a27408013939';
  const started = await call(root, { sessionId, text: 'Eva' }, { Cookie: 'secret=private', Authorization: 'Bearer private' });
  assert.equal(started.status, 202); assert.equal((await started.json()).status, 'running');
  assert.equal(seen[0].headers.origin, upstream); assert.equal(seen[0].headers.cookie, undefined); assert.equal(seen[0].headers.authorization, undefined);
  assert.equal((await call(`${root}/${job}?sessionId=${sessionId}`, undefined, { Origin: 'https://jackery.cz' })).status, 200);
  assert.equal(seen[1].headers.origin, 'https://jackery.cz');
  assert.equal((await call(`${root}/${job}/resume`, { sessionId }, { Origin: 'https://jackery.cz' })).status, 202);
  assert.deepEqual(JSON.parse(seen[2].body), { sessionId });
  for (const path of [root, `${root}/${job}?sessionId=${sessionId}`, `${root}/${job}/resume`]) {
    const method = path.includes('?') ? 'GET' : 'POST';
    const preflight = await httpFetch(base + path, { method: 'OPTIONS', headers: { Host: 'demo.example', Origin: 'https://jackery.cz', 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': 'content-type, ngrok-skip-browser-warning' } });
    assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-methods'), `${method}, OPTIONS`);
    const wrongMethod = await httpFetch(base + path, { method: 'OPTIONS', headers: { Host: 'demo.example', Origin: 'https://jackery.cz', 'Access-Control-Request-Method': method === 'GET' ? 'POST' : 'GET' } });
    assert.equal(wrongMethod.status, 403);
  }
  assert.equal(seen.length, 3);
  for (const path of [`${root}/${job}`, `${root}/${job}?sessionId=invalid`, `${root}/${job}?sessionId=${sessionId}&extra=true`, `${root}/${job}?sessionId=${sessionId}&sessionId=${sessionId}`, `${root}/${job}?sessionId=%35${sessionId.slice(1)}`, `${root}/${job}?SessionId=${sessionId}`, `${root.toUpperCase()}/${job}?sessionId=${sessionId}`, `${root}/${job}/resume`]) {
    assert.equal((await call(path)).status, 404, path);
  }
  for (const path of [`${root}/not-uuid?sessionId=${sessionId}`, `${root}/${job}`, `${root}/${job}?sessionId=bad`, `${root}/${job}?sessionId=${sessionId}&extra=true`, `${root}/${job}?sessionId=${sessionId}&sessionId=${sessionId}`, `${root}/${job}/resume?sessionId=${sessionId}`, `${root}/${job}/refresh`, '/api/growth/personalizations', '/api/growth/personalizations/' + job, '/api/growth/designs', '/api/growth/config', '/api/growth/session']) {
    assert.equal((await call(path, {})).status, 404, path);
  }
  assert.equal((await call(`${root}/${job}/resume`, { sessionId, extra: true })).status, 400);
  assert.equal((await call(`${root}/${job}/resume`, { sessionId: 'invalid' })).status, 400);
  assert.equal((await call(root, { sessionId }, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await call(`${root}/${job}?sessionId=${sessionId}`, undefined, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await call(`${root}/${job}/resume`, { sessionId }, { Origin: 'https://evil.example' })).status, 403);
  assert.equal(seen.length, 3);
});

test('customer errors expose only static actionable messages for known codes', async t => {
  let upstreamStatus = 429, upstreamCode = 'customer_personalization_limit', upstreamCalls = 0, oversized = false;
  const secret = 'SECRET-key-mask-customer-text-do-not-reflect';
  const server = createServer((req, res) => {
    upstreamCalls++;
    res.writeHead(upstreamStatus, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { code: upstreamCode, message: secret, input: secret, apiKey: secret }, secret: oversized ? 'x'.repeat(1024 * 1024) : secret }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const { call } = await gateway(t, { app: { server } });
  const root = '/api/growth/customer-personalizations';
  let response = await call(root, {});
  assert.equal(response.status, 429);
  let value = await response.json();
  assert.equal(value.error.code, 'customer_personalization_limit');
  assert.match(value.error.message, /limit/i); assert.doesNotMatch(JSON.stringify(value), /SECRET|apiKey|mask|input/);
  upstreamStatus = 409; upstreamCode = 'personalization_busy';
  response = await call(root, {}); value = await response.json();
  assert.equal(response.status, 409); assert.equal(value.error.code, 'personalization_busy'); assert.match(value.error.message, /wait|progress/i);
  for (const [status, code] of [[400, 'arbitrary_private_code'], [502, 'personalization_busy']]) {
    upstreamStatus = status; upstreamCode = code;
    response = await call(root, {}); value = await response.json();
    assert.equal(response.status, status); assert.equal(value.error.code, 'public_demo_request_failed'); assert.doesNotMatch(JSON.stringify(value), /SECRET|apiKey|mask|input/);
  }
  upstreamStatus = 429; upstreamCode = 'customer_personalization_limit';
  value = await (await call('/api/growth/quote', {})).json();
  assert.equal(value.error.code, 'public_demo_request_failed');
  oversized = true;
  response = await call(root, {}); value = await response.json();
  assert.equal(response.status, 429); assert.equal(value.error.code, 'public_demo_request_failed');
  const before = upstreamCalls;
  assert.equal((await call('/api/growth/personalizations', {})).status, 404);
  assert.equal(upstreamCalls, before);
});

test('customer history gateway accepts only exact GET session queries and retains response limits', async t => {
  const seen = []; let oversized = false;
  const server = createServer((req, res) => {
    seen.push({ method: req.method, url: req.url, headers: req.headers });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ items: oversized ? [{ product: { name: 'x'.repeat(1024 * 1024) } }] : [] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const { call, base } = await gateway(t, { app: { server } });
  const root = '/api/growth/customer-personalizations', sessionId = '5d7fab7a-27fa-4c6d-a62a-a27408013939';
  const path = `${root}?sessionId=${sessionId}&campaignId=main`;
  const response = await call(path, undefined, { Origin: 'https://jackery.cz', Cookie: 'secret-cookie', Authorization: 'Bearer secret-token' });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { items: [] });
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://jackery.cz');
  assert.equal(seen[0].method, 'GET'); assert.equal(seen[0].url, path);
  assert.equal(seen[0].headers.origin, 'https://jackery.cz'); assert.equal(seen[0].headers.cookie, undefined); assert.equal(seen[0].headers.authorization, undefined);
  const options = method => httpFetch(base + path, { method: 'OPTIONS', headers: { Host: 'demo.example', Origin: 'https://jackery.cz', 'Access-Control-Request-Method': method } });
  const preflight = await options('GET'); assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-methods'), 'GET, OPTIONS');
  assert.equal((await options('POST')).status, 403);
  for (const invalid of [root, `${root}?sessionId=invalid&campaignId=main`, `${root}?sessionId=${sessionId}`, `${root}?campaignId=main`, `${path}&extra=1`, `${path}&sessionId=${sessionId}`, `${path}&campaignId=main`,
    `${root}?sessionId=%35${sessionId.slice(1)}&campaignId=main`, `${root}?SessionId=${sessionId}&campaignId=main`, `${root}?sessionId=${sessionId}&campaignId=other`,
    `${path}&campaign=main`, '/api/growth/personalizations', '/api/growth/personalizations?sessionId=' + sessionId]) {
    assert.equal((await call(invalid)).status, 404, invalid);
  }
  assert.equal((await call(path, {})).status, 404);
  assert.equal((await call(path, undefined, { Origin: 'https://evil.example' })).status, 403);
  assert.equal(seen.length, 1);
  assert.equal((await call(`${root}?campaignId=main&sessionId=${sessionId}`)).status, 200);
  oversized = true; assert.equal((await call(path)).status, 413);
  assert.equal(seen.length, 3);
});
