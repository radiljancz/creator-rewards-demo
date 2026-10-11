// One-time, read-only export. No secrets, customer identities, or provider calls.
import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
import { labelMask } from '../../../backend/personalizations.mjs';

const db = new DatabaseSync(new URL('../../../data/demo.sqlite', import.meta.url).pathname, { readOnly: true });
const row = db.prepare('SELECT value,revision FROM growth_config WHERE id=?').get('main');
const campaign = { ...JSON.parse(row.value), revision: row.revision };
const designs = db.prepare('SELECT value FROM designs').all().map(r => JSON.parse(r.value))
  .filter(d => d.status === 'succeeded' && d.mode === 'live' && d.product?.imageSource === 'arcade')
  .map(d => ({ id: d.id, status: d.status, stage: d.stage, mode: d.mode, category: d.category, product: d.product }));
const successful = db.prepare('SELECT value FROM personalizations').all().map(r => JSON.parse(r.value)).filter(r => r.status === 'succeeded');
const examples = successful.map(r => ({ product: r.product, sourceDesignId: r.input.sourceDesignId, text: r.input.text }));
// Sources are measured again at generation time; saved masks are documentary assets only.
const masks = {};
for (const d of designs) {
  const previous = successful.find(r => r.input.sourceDesignId === d.id && r.mask?.width && r.mask?.height);
  if (previous) masks[d.id] = labelMask(previous.mask.width, previous.mask.height);
}
const snapshot = { exportedAt: new Date().toISOString(), campaign, designs, masks, examples };
writeFileSync(new URL('../worker/snapshot.mjs', import.meta.url), `export const snapshot = ${JSON.stringify(snapshot, null, 2)};\n`);
console.log(`Exported ${designs.length} creator originals and ${examples.length} saved personal examples, without customer ownership data.`);
db.close();
