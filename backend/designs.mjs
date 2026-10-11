import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { ApiError, exactObject, textField } from './errors.mjs';
import { illustration } from './campaign.mjs';

const reserved = new Set(['queued', 'starting', 'running', 'unknown', 'timed_out', 'awaiting_product', 'awaiting_resume']);

export function providerProduct(value, id, jobId = null) {
  textField(value.productId, 'provider product ID');
  textField(value.patternId, 'provider pattern ID');
  const image = new URL(value.imageUrl);
  if (image.protocol !== 'https:') throw new ApiError(502, 'invalid_provider_result', 'Expected HTTPS preview');
  if (!Number.isFinite(Date.parse(value.createdAt))) throw new ApiError(502, 'invalid_provider_result', 'Missing creation date');
  return { id, name: value.title, imageUrl: value.imageUrl, imageSource: 'arcade',
    providerProductId: value.productId, providerPatternId: value.patternId, providerJobId: jobId,
    generatedAt: value.createdAt, providerUnitPrice: value.unitPrice ?? null,
    priceIncludesShippingAndTax: false, previewRetrievedAt: new Date().toISOString() };
}

export class Designs {
  constructor({ store, adapter, mode = 'mock', category, categories, pollMs = 2500, timeoutMs = 180000, maxDesigns = 3, admit = () => {} }) {
    Object.assign(this, { store, adapter, mode, category, pollMs, timeoutMs, maxDesigns, admit });
    this.categories = structuredClone(categories ?? (category ? [category] : []));
    this.tasks = new Map(); this.stopped = false;
  }
  hasActive() { return this.store.designs().some(row => reserved.has(row.status)); }
  create(value) {
    exactObject(value, ['prompt', 'categoryId', 'requestId']);
    const input = { prompt: textField(value.prompt, 'prompt', 1000), categoryId: textField(value.categoryId, 'categoryId'), requestId: textField(value.requestId, 'requestId') };
    const row = this.store.transaction(() => {
      const existing = this.store.getDesignRequest(input.requestId);
      if (existing) {
        if (!isDeepStrictEqual(existing.input, input)) throw new ApiError(409, 'request_conflict', 'requestId was used with different input');
        return existing;
      }
      const category = this.categories.find(item => item.categoryId === input.categoryId);
      if (!category) throw new ApiError(400, 'unsupported_category', 'Choose a supported category from /api/designs/categories');
      this.admit();
      const rows = this.store.designs();
      if (rows.some(item => reserved.has(item.status))) throw new ApiError(409, 'design_busy', 'Resolve or resume the existing design first');
      if (rows.filter(item => item.mode === this.mode).length >= this.maxDesigns) throw new ApiError(429, 'design_limit', 'Persistent demo generation limit reached');
      const fresh = { id: randomUUID(), requestId: input.requestId, input, mode: this.mode, category: structuredClone(category),
        status: 'queued', stage: 'pattern', product: null, error: null, createdAt: new Date().toISOString() };
      this.store.putDesign(fresh); return fresh;
    });
    const response = this.public(row);
    if (row.status === 'queued' && !row.patternJobId && !row.patternBody) this.kick(row.id);
    return response;
  }
  public(row) {
    return { designId: row.id, status: row.status, stage: row.stage, mode: row.mode, error: row.error ?? null,
      providerJobId: row.stage === 'pattern' ? row.patternJobId ?? null : row.productJobId ?? null, product: row.product ?? null };
  }
  row(id) {
    const row = this.store.getDesign(id);
    if (!row) throw new ApiError(404, 'unknown_design', 'Unknown design');
    return row;
  }
  get(id) { return this.public(this.row(id)); }
  resume(id) {
    const row = this.store.transaction(() => {
      const row = this.row(id);
      if (row.mode !== this.mode) throw new ApiError(409, 'mode_mismatch', 'Start the server in the original design mode');
      if (row.status === 'unknown' || row.status === 'starting') throw new ApiError(409, 'unknown_start', 'Provider start needs manual reconciliation; no automatic retry');
      if (row.status === 'failed' || row.status === 'succeeded' || this.tasks.has(id)) return row;
      this.admit();
      row.error = null; row.status = 'queued'; this.store.putDesign(row); return row;
    });
    if (!['failed', 'succeeded'].includes(row.status)) this.kick(id);
    return this.public(row);
  }
  async recover() {
    for (const row of this.store.designs()) {
      if (!['queued', 'starting', 'running'].includes(row.status)) continue;
      const jobId = row.stage === 'pattern' ? row.patternJobId : row.productJobId;
      if (row.mode === 'live' && jobId) {
        if (this.mode === 'live') this.kick(row.id, true);
      } else {
        row.status = row.status === 'starting' ? 'unknown' : 'awaiting_resume';
        row.error = { code: row.status === 'unknown' ? 'unknown_start' : 'resume_required', message: 'Restart preserved the design; operator action is required' };
        this.store.putDesign(row);
      }
    }
  }
  kick(id, readsOnly = false) {
    if (this.tasks.has(id) || this.stopped) return;
    const task = Promise.resolve().then(() => this.run(id, readsOnly)).catch(error => {
      const row = this.row(id);
      if (this.stopped) return;
      row.status = row.status === 'starting' ? 'unknown' : error.code === 'provider_failed' || error.code === 'provider_no_result' ? 'failed' : 'timed_out';
      row.error = { code: row.status === 'unknown' ? 'unknown_start' : error.code ?? 'provider_unavailable', message: row.status === 'unknown' ? 'Start response is uncertain; do not start another generation' : 'Provider work did not complete; inspect status and existing job IDs' };
      this.store.putDesign(row);
    }).finally(() => this.tasks.delete(id));
    this.tasks.set(id, task);
  }
  async run(id, readsOnly) {
    let row = this.row(id);
    if (row.mode === 'mock') {
      row.status = 'succeeded'; row.stage = 'product'; row.error = null;
      row.product = { ...illustration, id: row.id, name: 'Concept illustration — mock generation' };
      this.store.transaction(() => { this.store.putProduct(row.product); this.store.putDesign(row); });
      return;
    }
    const deadline = Date.now() + this.timeoutMs;
    const timeout = value => {
      value.status = 'timed_out'; value.error = { code: 'poll_timeout', message: 'Polling stopped; provider job was preserved' };
      this.store.putDesign(value);
    };
    while (!this.stopped) {
      row = this.row(id);
      if (['failed', 'succeeded'].includes(row.status)) return;
      if (Date.now() >= deadline) { timeout(row); return; }
      const field = row.stage === 'pattern' ? 'patternJobId' : 'productJobId';
      if (!row[field]) {
        if (readsOnly) { row.status = 'awaiting_product'; this.store.putDesign(row); return; }
        const claimed = this.store.transaction(() => {
          const fresh = this.row(id);
          if (fresh.stage !== row.stage || fresh[field]) return null;
          if (['starting', 'unknown'].includes(fresh.status)) return false;
          const pattern = fresh.stage === 'pattern';
          const bodyField = pattern ? 'patternBody' : 'productBody';
          fresh[bodyField] = pattern
            ? { requestId: `${id}:pattern`, prompt: fresh.input.prompt }
            : { requestId: `${id}:product`, patternId: fresh.patternId, categoryId: fresh.category.categoryId, selections: fresh.category.selections, fit: { mode: 'fill' } };
          fresh.status = 'starting'; this.store.putDesign(fresh); return fresh;
        });
        if (claimed === false) return;
        if (claimed === null) continue;
        row = claimed;
        const pattern = row.stage === 'pattern';
        const bodyField = pattern ? 'patternBody' : 'productBody';
        const started = await (pattern ? this.adapter.startPattern(row[bodyField]) : this.adapter.startProduct(row[bodyField]));
        if (typeof started.jobId !== 'string' || !started.jobId) throw new ApiError(502, 'invalid_provider_result', 'Missing job ID');
        row[field] = started.jobId; row.status = 'running'; this.store.putDesign(row);
      }
      if (this.stopped) return;
      if (Date.now() >= deadline) { timeout(row); return; }
      const requestedJobId = row[field], requestedStage = row.stage;
      const job = await this.adapter.getJob(requestedJobId);
      const latest = this.row(id);
      if (latest.stage !== requestedStage || latest[field] !== requestedJobId || ['failed', 'succeeded'].includes(latest.status)) continue;
      row = latest;
      if (job.jobId !== requestedJobId || job.kind !== requestedStage) throw new ApiError(502, 'invalid_provider_result', 'Job response does not match the requested job and stage');
      if (job.status === 'failed') throw new ApiError(502, 'provider_failed', 'Provider job failed');
      if (Date.now() >= deadline) { timeout(row); return; }
      if (job.status === 'succeeded') {
        const key = row.stage === 'pattern' ? 'patternId' : 'productId';
        if (typeof job.result?.[key] !== 'string' || !job.result[key]) throw new ApiError(502, 'provider_no_result', 'Job succeeded without a usable result');
        if (row.stage === 'pattern') {
          this.store.transaction(() => {
            const fresh = this.row(id);
            if (fresh.stage !== 'pattern' || fresh.patternJobId !== requestedJobId) return;
            fresh.patternId = job.result.patternId; fresh.stage = 'product'; fresh.status = 'queued'; this.store.putDesign(fresh);
          });
          continue;
        }
        row.productId = job.result.productId; this.store.putDesign(row);
        const value = await this.adapter.getProduct(row.productId);
        if (value.productId !== row.productId || value.patternId !== row.patternId) throw new ApiError(502, 'invalid_provider_result', 'Provider provenance does not match the job');
        row.product = providerProduct(value, row.id, row.productJobId); row.status = 'succeeded'; row.error = null;
        this.store.transaction(() => { this.store.putProduct(row.product); this.store.putDesign(row); });
        return;
      }
      if (job.status !== 'running') throw new ApiError(502, 'invalid_provider_result', 'Unexpected job status');
      await delay(this.pollMs);
    }
  }
  async refresh(id) {
    const row = this.row(id);
    if (row.status !== 'succeeded' || row.mode !== 'live' || !row.product?.providerProductId) throw new ApiError(409, 'not_refreshable', 'Only a completed live design can refresh its preview');
    const value = await this.adapter.getProduct(row.product.providerProductId);
    if (value.productId !== row.product.providerProductId || value.patternId !== row.product.providerPatternId) throw new ApiError(502, 'invalid_provider_result', 'Provider provenance changed');
    row.product = providerProduct(value, row.id, row.product.providerJobId);
    this.store.transaction(() => { this.store.putProduct(row.product); this.store.putDesign(row); });
    return this.public(row);
  }
  async close() { this.stopped = true; await Promise.allSettled(this.tasks.values()); }
}
