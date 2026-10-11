// Mounted behind the local operator session; disabled by default.
// No provider calls during import or construction.
import { randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { ApiError, exactObject, textField } from './errors.mjs';
import { providerProduct } from './designs.mjs';

const active = new Set(['queued', 'starting', 'running', 'unknown', 'timed_out', 'awaiting_product', 'awaiting_resume']);

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(name, data) {
  const kind = Buffer.from(name), size = Buffer.alloc(4), crc = Buffer.alloc(4);
  size.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([kind, data])));
  return Buffer.concat([size, kind, data, crc]);
}
export function labelMask(sourceWidth, sourceHeight) {
  if (![sourceWidth, sourceHeight].every(n => Number.isSafeInteger(n) && n >= 64 && n <= 100000)) throw new ApiError(400, 'invalid_dimensions', 'Pattern dimensions cannot support the label region');
  const scale = Math.min(1, 1536 / Math.max(sourceWidth, sourceHeight));
  const width = Math.round(sourceWidth * scale), height = Math.round(sourceHeight * scale);
  // Keep lettering inside the pillow's visible print area rather than its seam/crop.
  const region = { left: Math.floor(width * 0.15), top: Math.floor(height * 0.60), width: Math.floor(width * 0.70), height: Math.floor(height * 0.20) };
  if (region.width < 16 || region.height < 16) throw new ApiError(400, 'invalid_dimensions', 'Label region must cover at least 16 by 16 pixels');
  const stride = width * 4 + 1, pixels = Buffer.alloc(stride * height);
  for (let y = region.top; y < region.top + region.height; y++) for (let x = region.left; x < region.left + region.width; x++) pixels[y * stride + 1 + x * 4 + 3] = 255;
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(pixels)), pngChunk('IEND', Buffer.alloc(0))]);
  return { width, height, region, dataUrl: `data:image/png;base64,${png.toString('base64')}` };
}

export class Personalizations {
  constructor({ store, adapter, generationEnabled = false, maxPersonalizations = 1, pollMs = 2500, timeoutMs = 180000 }) {
    Object.assign(this, { store, adapter, generationEnabled, maxPersonalizations, pollMs, timeoutMs });
    this.tasks = new Map(); this.stopped = false;
    store.db.exec('CREATE TABLE IF NOT EXISTS personalizations (id TEXT PRIMARY KEY, request_id TEXT UNIQUE NOT NULL, value TEXT NOT NULL)');
  }
  authorize(options) {
    if (options?.authorized !== true) throw new ApiError(401, 'operator_required', 'Caller must verify the protected operator session');
    if (!this.generationEnabled) throw new ApiError(403, 'personalization_disabled', 'Additional provider generations need separate explicit approval');
  }
  rows() { return this.store.db.prepare('SELECT value FROM personalizations').all().map(row => JSON.parse(row.value)); }
  hasActive() { return this.rows().some(row => active.has(row.status)); }
  row(id) {
    const value = this.store.db.prepare('SELECT value FROM personalizations WHERE id=?').get(id);
    if (!value) throw new ApiError(404, 'unknown_personalization', 'Unknown personalization');
    return JSON.parse(value.value);
  }
  save(row) { this.store.db.prepare('INSERT INTO personalizations VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(row.id, row.input.requestId, JSON.stringify(row)); }
  get(id) {
    const row = this.row(id);
    return { personalizationId: row.id, status: row.status, stage: row.stage, sourceDesignId: row.input.sourceDesignId, text: row.input.text,
      sourcePatternId: row.sourcePatternId, refinedPatternId: row.refinedPatternId ?? null, refineJobId: row.refineJobId ?? null,
      productJobId: row.productJobId ?? null, product: row.product ?? null, error: row.error ?? null };
  }
  create(value, options) {
    this.authorize(options); exactObject(value, ['sourceDesignId', 'text', 'requestId']);
    const input = { sourceDesignId: textField(value.sourceDesignId, 'sourceDesignId'), text: textField(value.text, 'text', 32), requestId: textField(value.requestId, 'requestId') };
    if (!/^[\p{L}\p{N} .,'’\-]+$/u.test(input.text)) throw new ApiError(400, 'invalid_text', 'Use short place/year text, not markup or multiline instructions');
    const row = this.store.transaction(() => {
      const existing = this.rows().find(item => item.input.requestId === input.requestId);
      if (existing) { if (!isDeepStrictEqual(existing.input, input) || !isDeepStrictEqual(existing.customer, options.customer)) throw new ApiError(409, 'request_conflict', 'requestId has different personalization input'); return existing; }
      const source = this.store.getDesign(input.sourceDesignId);
      if (!source || source.status !== 'succeeded' || source.mode !== 'live' || source.product?.imageSource !== 'arcade' || !source.product.providerJobId || !source.product.providerPatternId || !source.category?.selections) throw new ApiError(400, 'invalid_source', 'Choose a completed, proven live creator design');
      const rows = this.rows();
      if (options.customer && rows.filter(item => item.customer?.sessionId === options.customer.sessionId).length >= this.maxPersonalizations) throw new ApiError(429, 'customer_personalization_limit', 'This visitor has used the configured demo personalization allowance');
      if (rows.some(item => active.has(item.status)) || this.store.designs().some(item => active.has(item.status))) throw new ApiError(409, 'personalization_busy', 'Resolve the existing provider work first');
      if (rows.length >= this.maxPersonalizations) throw new ApiError(429, 'personalization_limit', 'Persistent personalization limit reached');
      const fresh = { id: randomUUID(), input, sourcePatternId: source.product.providerPatternId, sourceProductId: source.product.providerProductId,
        category: source.category, status: 'queued', stage: 'refine', createdAt: new Date().toISOString(), product: null, error: null,
        ...(options.customer ? { customer: { ...options.customer } } : {}) };
      this.save(fresh); return fresh;
    });
    const result = this.get(row.id);
    if (row.status === 'queued' && !row.refineBody) this.kick(row.id);
    return result;
  }
  resume(id, options) {
    this.authorize(options);
    const row = this.store.transaction(() => {
      const row = this.row(id);
      if (['starting', 'unknown'].includes(row.status)) throw new ApiError(409, 'unknown_start', 'Reconcile the original exact provider request manually');
      if (['failed', 'succeeded'].includes(row.status) || this.tasks.has(id)) return row;
      if (this.store.designs().some(item => active.has(item.status)) || this.rows().some(item => item.id !== id && active.has(item.status))) throw new ApiError(409, 'personalization_busy', 'Resolve the existing provider work first');
      row.status = 'queued'; row.error = null; this.save(row); return row;
    });
    if (!['failed', 'succeeded'].includes(row.status)) this.kick(id);
    return this.get(id);
  }
  recover() {
    for (const listed of this.rows()) {
      const row = this.store.transaction(() => {
        const fresh = this.row(listed.id);
        if (!['queued', 'starting', 'running'].includes(fresh.status)) return null;
        const jobId = fresh.stage === 'refine' ? fresh.refineJobId : fresh.productJobId;
        if (jobId) return fresh;
        fresh.status = fresh.status === 'starting' ? 'unknown' : 'awaiting_resume'; this.save(fresh); return null;
      });
      if (row) this.kick(row.id, true);
    }
  }
  kick(id, readsOnly = false) {
    if (this.stopped || this.tasks.has(id)) return;
    const task = Promise.resolve().then(() => this.run(id, readsOnly)).catch(error => {
      if (this.stopped) return;
      this.store.transaction(() => {
        const row = this.row(id), expected = error.personalizationSnapshot;
        if (['succeeded', 'failed', 'unknown'].includes(row.status)) return;
        if (expected && (row.stage !== expected.stage || row.refineJobId !== expected.refineJobId || row.productJobId !== expected.productJobId)) return;
        row.status = row.status === 'starting' ? 'unknown' : ['provider_failed', 'provider_no_result'].includes(error.code) ? 'failed' : 'timed_out';
        row.error = { code: error.code ?? 'provider_unavailable', message: row.status === 'unknown' ? 'Uncertain provider start; no automatic retry' : 'Provider result is not confirmed; preserve existing job and source' };
        this.save(row);
      });
    }).finally(() => this.tasks.delete(id));
    this.tasks.set(id, task);
  }
  async run(id, readsOnly) {
    let observed;
    try {
      const deadline = Date.now() + this.timeoutMs;
      const timeout = row => this.store.transaction(() => {
        const fresh = this.row(id);
        if (fresh.stage !== row.stage || fresh.refineJobId !== row.refineJobId || fresh.productJobId !== row.productJobId || ['succeeded', 'failed', 'unknown', 'starting'].includes(fresh.status)) return;
        fresh.status = 'timed_out'; fresh.error = { code: 'poll_timeout', message: 'Existing provider job was preserved' }; this.save(fresh);
      });
      while (!this.stopped) {
        let row = this.row(id);
        observed = row;
        if (['succeeded', 'failed', 'unknown'].includes(row.status)) return;
        if (Date.now() >= deadline) { timeout(row); return; }
        const refine = row.stage === 'refine', jobField = refine ? 'refineJobId' : 'productJobId';
        if (!row[jobField]) {
          if (readsOnly) {
            const paused = this.store.transaction(() => {
              const fresh = this.row(id);
              if (fresh.stage !== row.stage || fresh[jobField]) return false;
              if (['starting', 'unknown', 'succeeded', 'failed'].includes(fresh.status)) return true;
              fresh.status = refine ? 'awaiting_resume' : 'awaiting_product'; this.save(fresh); return true;
            });
            if (paused) return;
            continue;
          }
          let body;
          if (refine) {
            const source = await this.adapter.call('patterns/get', { patternId: row.sourcePatternId });
            if (source.patternId !== row.sourcePatternId) throw new ApiError(502, 'invalid_provider_result', 'Unexpected source pattern');
            const mask = labelMask(source.width, source.height);
            body = { requestId: `${id}:refine`, patternId: row.sourcePatternId,
              instruction: `Inside the selected region only, integrate the exact text ${JSON.stringify(row.input.text)} as an elegant, clearly readable travel signature. Center the lettering in the selected region, with letter height about 7 percent of the whole image height. Use refined dark teal lettering and a quiet sand-colored area behind it, harmonized with the existing textile artwork. Keep it inside the print-safe area, away from the bottom edge. Preserve all creator artwork, colors and composition outside the selected region. Add no other text or logos.`, mask: mask.dataUrl };
            row.maskRegion = { width: mask.width, height: mask.height, region: mask.region };
          } else {
            const derived = await this.adapter.call('patterns/get', { patternId: row.refinedPatternId });
            if (derived.patternId !== row.refinedPatternId || derived.sourcePatternId !== row.sourcePatternId) throw new ApiError(502, 'invalid_provider_result', 'Derivative source lineage is not verified');
            body = { requestId: `${id}:product`, patternId: row.refinedPatternId, categoryId: row.category.categoryId, selections: row.category.selections, fit: { mode: 'fill' } };
          }
          if (this.stopped) return;
          if (Date.now() >= deadline) { timeout(row); return; }
          const claimed = this.store.transaction(() => {
            const fresh = this.row(id);
            if (fresh.stage !== row.stage || fresh[jobField]) return null;
            if (['starting', 'unknown'].includes(fresh.status)) return false;
            fresh[refine ? 'refineBody' : 'productBody'] = body;
            if (row.maskRegion) fresh.maskRegion = row.maskRegion;
            fresh.status = 'starting'; this.save(fresh); return fresh;
          });
          if (claimed === false) return;
          if (!claimed) continue;
          row = claimed;
          observed = row;
          const started = refine ? await this.adapter.call('patterns/refine/editRegion', body) : await this.adapter.startProduct(body);
          if (typeof started.jobId !== 'string' || !started.jobId) throw new ApiError(502, 'invalid_provider_result', 'Missing provider job ID');
          row[jobField] = started.jobId; row.status = 'running'; this.save(row);
        }
        if (this.stopped) return;
        if (Date.now() >= deadline) { timeout(row); return; }
        const requestedJobId = row[jobField], requestedStage = row.stage;
        const job = await this.adapter.getJob(requestedJobId);
        const latest = this.row(id);
        if (latest.stage !== requestedStage || latest[jobField] !== requestedJobId || ['succeeded', 'failed', 'unknown'].includes(latest.status)) continue;
        row = latest;
        observed = row;
        if (job.jobId !== requestedJobId || job.kind !== (refine ? 'pattern' : 'product')) throw new ApiError(502, 'invalid_provider_result', 'Wrong job identity or kind');
        if (job.status === 'failed') throw new ApiError(502, 'provider_failed', 'Provider job failed');
        if (Date.now() >= deadline) { timeout(row); return; }
        if (job.status === 'succeeded') {
          if (refine) {
            if (typeof job.result?.patternId !== 'string' || !job.result.patternId || job.result.patternId === row.sourcePatternId) throw new ApiError(502, 'provider_no_result', 'No new derivative pattern');
            this.store.transaction(() => {
              const fresh = this.row(id);
              if (fresh.stage !== 'refine' || fresh.refineJobId !== requestedJobId || ['succeeded', 'failed', 'unknown'].includes(fresh.status)) return;
              fresh.refinedPatternId = job.result.patternId; fresh.stage = 'product'; fresh.status = 'queued'; this.save(fresh);
            });
            continue;
          }
          if (typeof job.result?.productId !== 'string' || !job.result.productId) throw new ApiError(502, 'provider_no_result', 'No product result');
          const retrieved = this.store.transaction(() => {
            const fresh = this.row(id);
            if (fresh.stage !== 'product' || fresh.productJobId !== requestedJobId || ['succeeded', 'failed', 'unknown'].includes(fresh.status)) return null;
            fresh.productId = job.result.productId; this.save(fresh); return fresh;
          });
          if (!retrieved) continue;
          row = retrieved; observed = row;
          const value = await this.adapter.getProduct(row.productId);
          if (value.productId !== row.productId || value.patternId !== row.refinedPatternId) throw new ApiError(502, 'invalid_provider_result', 'Product does not match derivative pattern');
          const product = { ...providerProduct(value, row.id, row.productJobId), sourceDesignId: row.input.sourceDesignId, sourcePatternId: row.sourcePatternId,
            personalizationText: row.input.text, visualReviewRequired: true };
          this.store.transaction(() => {
            const fresh = this.row(id);
            if (fresh.stage !== 'product' || fresh.productJobId !== requestedJobId || fresh.productId !== row.productId || ['succeeded', 'failed', 'unknown'].includes(fresh.status)) return;
            fresh.product = product; fresh.status = 'succeeded'; fresh.error = null; this.save(fresh);
          });
          return;
        }
        if (job.status !== 'running') throw new ApiError(502, 'invalid_provider_result', 'Unknown job state');
        await delay(this.pollMs);
      }
    } catch (error) {
      if (observed) error.personalizationSnapshot = { stage: observed.stage, refineJobId: observed.refineJobId, productJobId: observed.productJobId };
      throw error;
    }
  }
  async close() { this.stopped = true; await Promise.allSettled(this.tasks.values()); }
}
