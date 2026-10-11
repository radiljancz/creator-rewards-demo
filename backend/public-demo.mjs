import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const publicApis = new Set(['/api/growth/public', '/api/growth/quote', '/api/growth/events']);
const customerRoot = '/api/growth/customer-personalizations';
const uuidPattern = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const uuid = new RegExp(`^${uuidPattern}$`);
const customerItem = new RegExp(`^${customerRoot}/${uuidPattern}$`);
const customerResume = new RegExp(`^${customerRoot}/${uuidPattern}/resume$`);
const assets = new Map([['/shop', 'text/html; charset=utf-8'], ['/rewards.js', 'application/javascript; charset=utf-8'], ['/assets/coastal-pillow.svg', 'image/svg+xml']]);
const safeQuoteFields = ['eligible', 'reason', 'basketTotal', 'productCost', 'merchantSubsidy', 'fanCopay', 'currency', 'pricingSource'];
const safeQuote = quote => Object.fromEntries(safeQuoteFields.filter(key => Object.hasOwn(quote, key)).map(key => [key, quote[key]]));
const customerErrors = Object.freeze({
  customer_personalization_disabled: 'Customer personalization is not enabled. Ask the demo operator to enable it.',
  personalization_disabled: 'Personalization is not enabled. Ask the demo operator to enable it.',
  customer_personalization_limit: 'Your personalization attempt limit has been reached. Keep an existing design or ask the demo operator for help.',
  personalization_limit: 'The demo personalization limit has been reached. Keep an existing design or ask the demo operator for help.',
  personalization_busy: 'A personalization is already in progress. Wait for it to finish before starting another.',
  invalid_text: 'Use a short personalization text of at most 32 characters.',
  invalid_source: 'This design cannot be personalized. Choose an available Arcade design.',
  invalid_input: 'Check the selected design and personalization text, then try again.',
  request_conflict: 'This request belongs to a different customization. Return to the existing design or start a new request.',
  unknown_start: 'The generation start could not be confirmed. Do not start another attempt; ask the demo operator to check it.',
  unknown_personalization: 'This personalization is unavailable in your session. Return to the design selection.',
  invalid_personalization: 'This customization does not match the selected design or text. Select your completed customization again.',
  rate_limit: 'Too many requests. Wait a minute before trying again.',
});
function originUrl(value, name) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`Invalid ${name} origin`); }
  if (url.protocol !== 'https:' || url.username || url.password || value !== url.origin) throw new Error(`Invalid ${name} origin: use an exact HTTPS origin`);
  return url;
}
function reject(status) { const error = new Error('Public demo request failed'); error.status = status; throw error; }
async function readLimited(stream, limit) {
  const chunks = []; let length = 0;
  for await (const chunk of stream) { length += chunk.length; if (length > limit) reject(413); chunks.push(Buffer.from(chunk)); }
  return Buffer.concat(chunks);
}

export function createPublicDemo({ publicOrigin, shopOrigin = null, upstream = 'http://127.0.0.1:3100', allowLocalHost = false, timeoutMs = 5000, requestsPerMinute = 180 } = {}) {
  const publicUrl = originUrl(publicOrigin, 'public');
  if (shopOrigin) originUrl(shopOrigin, 'shop');
  let upstreamUrl;
  try { upstreamUrl = new URL(upstream); } catch { throw new Error('Invalid upstream'); }
  if (upstreamUrl.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(upstreamUrl.hostname) || !upstreamUrl.port || upstream !== upstreamUrl.origin || upstreamUrl.username || upstreamUrl.password) throw new Error('Upstream must be a fixed loopback HTTP origin with a port');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000 || !Number.isInteger(requestsPerMinute) || requestsPerMinute < 1 || requestsPerMinute > 10000) throw new Error('Invalid gateway limits');
  const rates = new Map();
  const server = createServer(async (req, res) => {
    const json = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
    try {
      const localHost = `127.0.0.1:${server.address().port}`;
      if (req.headers.host !== publicUrl.host && !(allowLocalHost && req.headers.host === localHost)) reject(403);
      const now = Date.now();
      for (const [ip, bucket] of rates) if (bucket.until <= now) rates.delete(ip);
      const ip = req.socket.remoteAddress || 'unknown';
      if (!rates.has(ip)) { if (rates.size >= 1000) reject(429); rates.set(ip, { count: 0, until: now + 60000 }); }
      if (++rates.get(ip).count > requestsPerMinute) reject(429);
      if (!req.url?.startsWith('/') || req.url.startsWith('//') || req.url.includes('\\')) reject(404);
      const url = new URL(req.url, publicOrigin), path = url.pathname;
      const customerRead = customerItem.test(path), customerContinue = customerResume.test(path);
      const customerStart = path === customerRoot;
      const customerHistory = customerStart && Boolean(url.search);
      const isApi = publicApis.has(path) || customerStart || customerRead || customerContinue, isAsset = assets.has(path);
      const allowedMethod = isAsset || path === '/api/growth/public' || customerRead || customerHistory ? 'GET' : 'POST';
      const getAllowed = req.method === 'GET' && (isAsset || isApi) && allowedMethod === 'GET';
      const postAllowed = req.method === 'POST' && isApi && allowedMethod === 'POST';
      const preflight = req.method === 'OPTIONS' && isApi;
      if (!getAllowed && !postAllowed && !preflight) reject(404);
      if (path === '/api/growth/public') {
        if (url.search !== '?campaign=main') reject(404);
      } else if (customerHistory) {
        const sessionId = url.searchParams.get('sessionId');
        if ([...url.searchParams].length !== 2 || url.searchParams.getAll('sessionId').length !== 1 || url.searchParams.getAll('campaignId').length !== 1
          || !uuid.test(sessionId ?? '') || url.searchParams.get('campaignId') !== 'main'
          || ![`?sessionId=${sessionId}&campaignId=main`, `?campaignId=main&sessionId=${sessionId}`].includes(url.search)) reject(404);
      } else if (customerRead) {
        const entries = [...url.searchParams];
        if (entries.length !== 1 || entries[0][0] !== 'sessionId' || !uuid.test(entries[0][1]) || url.search !== `?sessionId=${entries[0][1]}`) reject(404);
      } else if (path === '/shop') {
        if ([...url.searchParams].some(([key, value]) => key !== 'creator' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) || url.searchParams.getAll('creator').length > 1) reject(404);
      } else if (url.search) reject(404);
      const origin = req.headers.origin;
      if (origin && origin !== publicOrigin && origin !== shopOrigin) reject(403);
      if ((postAllowed || preflight) && !origin) reject(403);
      if (isApi && origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
      if (preflight) {
        if (req.headers['access-control-request-method'] !== allowedMethod) reject(403);
        if ((req.headers['access-control-request-headers'] || '').split(',').some(header => header.trim() && !['content-type', 'ngrok-skip-browser-warning'].includes(header.trim().toLowerCase()))) reject(403);
        res.writeHead(204, { 'Access-Control-Allow-Methods': `${allowedMethod}, OPTIONS`, 'Access-Control-Allow-Headers': 'Content-Type, ngrok-skip-browser-warning', 'Access-Control-Max-Age': '300' }); res.end(); return;
      }
      const headers = { Accept: isApi ? 'application/json' : '*/*' };
      if (isApi) headers.Origin = origin === shopOrigin && shopOrigin ? shopOrigin : upstream;
      let requestBody;
      if (postAllowed) {
        if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') reject(415);
        requestBody = await readLimited(req, 16384);
        let parsed; try { parsed = JSON.parse(requestBody.toString('utf8')); } catch { reject(400); }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) reject(400);
        if (customerContinue && (Object.keys(parsed).length !== 1 || !Object.hasOwn(parsed, 'sessionId') || typeof parsed.sessionId !== 'string' || !uuid.test(parsed.sessionId))) reject(400);
        headers['Content-Type'] = 'application/json';
      }
      const response = await fetch(upstream + path + url.search, { method: req.method, headers, ...(requestBody ? { body: requestBody } : {}), redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) {
        if ((customerStart || customerRead || customerContinue) && response.status >= 400 && response.status <= 499) {
          let code;
          try {
            const content = await readLimited(response.body, 1024 * 1024);
            code = JSON.parse(content.toString('utf8'))?.error?.code;
          } catch { /* Unreadable or oversized upstream errors remain generic. */ }
          if (typeof code === 'string' && Object.hasOwn(customerErrors, code)) {
            json(response.status, { error: { code, message: customerErrors[code] } }); return;
          }
        } else await response.body?.cancel();
        reject(response.status >= 400 && response.status <= 499 ? response.status : 502);
      }
      const content = await readLimited(response.body, 1024 * 1024);
      if (isApi) {
        let data; try { data = JSON.parse(content.toString('utf8')); } catch { reject(502); }
        if (path === '/api/growth/quote') data = safeQuote(data);
        if (path === '/api/growth/events' && data.event?.quote) data.event.quote = safeQuote(data.event.quote);
        json(response.status, data); return;
      }
      res.writeHead(200, { 'Content-Type': assets.get(path), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }); res.end(content);
    } catch (error) {
      if (!res.headersSent) json(error.status || 502, { error: { code: 'public_demo_request_failed', message: 'Public demo request could not be completed' } });
      else res.destroy();
    }
  });
  server.requestTimeout = 10000; server.headersTimeout = 10000; server.maxHeadersCount = 40;
  return {
    server,
    async listen(port = 3200) {
      if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid gateway port');
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); }); });
    },
    async close() { if (server.listening) await new Promise(resolve => server.close(resolve)); },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const proxy = createPublicDemo({ publicOrigin: process.env.PUBLIC_DEMO_ORIGIN, shopOrigin: process.env.SHOP_ORIGIN || null });
    const port = process.env.PUBLIC_DEMO_PORT === undefined ? 3200 : Number(process.env.PUBLIC_DEMO_PORT);
    await proxy.listen(port);
    console.log(`Public-demo gateway ready on 127.0.0.1:${port}; no tunnel was started.`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await proxy.close(); process.exit(0); });
  } catch { console.error('Public-demo gateway startup failed. Check the public HTTPS origin, optional shop origin and local port.'); process.exitCode = 1; }
}
