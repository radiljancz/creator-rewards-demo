import { Store } from './store.mjs';
import { Arcade } from './arcade.mjs';
import { createApp } from './server.mjs';

function integer(name, fallback, minimum, maximum) {
  const value = process.env[name] === undefined ? fallback : Number(process.env[name]);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`Invalid ${name}`);
  return value;
}

try {
  const mode = process.env.ARCADE_MODE ?? 'mock';
  if (!['mock', 'live'].includes(mode)) throw new Error('ARCADE_MODE must be mock or live');
  const adapter = mode === 'live' ? new Arcade({ key: process.env.ARCADE_API_KEY, userAgent: process.env.ARCADE_USER_AGENT }) : null;
  let category, categories;
  if (adapter) {
    try { categories = await adapter.demoCategories(process.env.ARCADE_CATEGORY_ID); category = categories[0]; }
    catch { category = null; categories = []; console.error('Live category is unavailable; generation stays disabled. No provider job was started.'); }
  }
  const app = createApp({ store: new Store(process.env.DEMO_DB_PATH ?? 'data/demo.sqlite'), mode, adapter, category, categories,
    personalizationGenerationEnabled: process.env.PERSONALIZATION_GENERATION_ENABLED === 'true',
    customerPersonalizationEnabled: process.env.CUSTOMER_PERSONALIZATION_ENABLED === 'true',
    maxPersonalizations: integer('DEMO_MAX_PERSONALIZATIONS', 1, 0, 100),
    operatorToken: process.env.DEMO_OPERATOR_TOKEN, maxDesigns: integer('DEMO_MAX_DESIGNS', 3, 0, 100),
    pollMs: integer('ARCADE_POLL_MS', 2500, 2000, 5000), timeoutMs: integer('ARCADE_JOB_TIMEOUT_MS', 180000, 1000, 600000) });
  const port = integer('PORT', 3000, 1, 65535);
  await app.listen(port, process.env.HOST ?? '127.0.0.1');
  console.log(`Creator Rewards demo: http://127.0.0.1:${port} (${mode}, USD fixture)`);
  let closing = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { if (closing) return; closing = true; await app.close(); process.exit(0); });
} catch (error) {
  console.error(error.code ? `${error.code}: ${error.message}` : 'Demo startup failed; check local configuration');
  process.exitCode = 1;
}
