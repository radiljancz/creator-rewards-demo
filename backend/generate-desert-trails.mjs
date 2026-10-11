// Explicit operator command: exactly one persisted pattern -> product design.
// No checkout, order, manufacturing or payout calls.
import { mkdirSync, writeFileSync } from 'node:fs';
import { Store } from './store.mjs';
import { Arcade } from './arcade.mjs';
import { Designs } from './designs.mjs';
import { setTimeout as delay } from 'node:timers/promises';

const input = {
  requestId: 'hackathon-desert-trails-base-v1',
  prompt: 'Desert trails: an original sophisticated abstract textile artwork for an outdoor pillow cover. Layered abstract mountains and dunes, one winding hiking trail, warm sand, muted terracotta, deep blue-green teal, a small sunset circle. Clean graphic shapes, balanced composition, subtle natural textile feeling. Preserve negative space suitable for a small future personalization. No text, no letters, no typography, no logos, no brands, no product photograph; generate the flat artwork only.',
};
const store = new Store('data/demo.sqlite');
let manager;
try {
  const adapter = new Arcade({ key: process.env.ARCADE_API_KEY, userAgent: process.env.ARCADE_USER_AGENT, requestTimeoutMs: 30000 });
  const category = await adapter.demoCategory('e31ea74b-f8a6-42f1-b005-c67ea65faecf');
  manager = new Designs({ store, adapter, mode: 'live', category, pollMs: 2500, timeoutMs: 600000, maxDesigns: 1 });
  const accepted = manager.create({ ...input, categoryId: category.categoryId });
  const saved = store.getDesign(accepted.designId);
  if (['timed_out', 'awaiting_product', 'awaiting_resume', 'running'].includes(saved.status)) manager.resume(saved.id);
  console.log(JSON.stringify({ designId: accepted.designId, requestId: input.requestId, category: category.name, selections: category.selections, status: accepted.status }));
  let previous = '';
  for (let attempts = 0; attempts < 330; attempts++) {
    const state = manager.get(accepted.designId);
    const summary = JSON.stringify({ designId: state.designId, status: state.status, stage: state.stage, providerJobId: state.providerJobId, error: state.error });
    if (summary !== previous) { console.log(summary); previous = summary; }
    if (state.status === 'succeeded') {
      const row = store.getDesign(state.designId);
      const result = { ...state, patternJobId: row.patternJobId, productJobId: row.productJobId, categoryId: category.categoryId, selections: category.selections };
      mkdirSync('data', { recursive: true, mode: 0o700 });
      writeFileSync('data/arcade-desert-trails-result.json', JSON.stringify(result, null, 2), { mode: 0o600 });
      console.log(JSON.stringify({ completed: true, designId: state.designId, productId: state.product.providerProductId, patternId: state.product.providerPatternId,
        patternJobId: row.patternJobId, productJobId: row.productJobId, providerUnitPrice: state.product.providerUnitPrice, generatedAt: state.product.generatedAt,
        provenanceFile: 'data/arcade-desert-trails-result.json' }));
      break;
    }
    if (['failed', 'unknown', 'timed_out', 'awaiting_product', 'awaiting_resume'].includes(state.status)) { process.exitCode = 1; break; }
    await delay(2000);
  }
  if (manager.get(accepted.designId).status !== 'succeeded') process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ code: error.code ?? 'generation_command_failed', message: error.code ? error.message : 'Inspect persisted design; do not start a new request' }));
  process.exitCode = 1;
} finally { if (manager) await manager.close(); store.close(); }
