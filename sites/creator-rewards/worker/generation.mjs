import { Arcade } from './arcade.mjs';
import { ApiError, exactObject, textField } from './errors.mjs';

export const schema = `CREATE TABLE IF NOT EXISTS generation_jobs (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('design','personalization')),
  request_key TEXT UNIQUE NOT NULL, input_json TEXT NOT NULL, session_id TEXT,
  status TEXT NOT NULL, stage TEXT NOT NULL, value_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0, lock_token TEXT, lock_until INTEGER
);
CREATE INDEX IF NOT EXISTS generation_status ON generation_jobs(status);
CREATE INDEX IF NOT EXISTS generation_owner ON generation_jobs(session_id,kind);`;
const active = ['queued', 'starting', 'running', 'unknown', 'timed_out', 'awaiting_product', 'awaiting_resume'];
const activeSQL = active.map(value => `'${value}'`).join(',');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const enabled = env => env.GENERATION_ENABLED === 'true' || env.GENERATION_ENABLED === true;
function positive(value, fallback) { const n = Number(value ?? fallback); return Number.isSafeInteger(n) && n >= 0 ? n : 0; }
function ownerSession(value) {
  if (typeof value !== 'string' || !uuid.test(value)) throw new ApiError(400, 'invalid_input', 'A UUID visitor sessionId is required');
  return value;
}
function providerProduct(value, row) {
  textField(value.productId, 'provider product ID'); textField(value.patternId, 'provider pattern ID');
  let image;
  try { image = new URL(value.imageUrl); } catch { throw new ApiError(502, 'invalid_provider_result', 'Invalid preview URL'); }
  if (image.protocol !== 'https:' || !Number.isFinite(Date.parse(value.createdAt))) throw new ApiError(502, 'invalid_provider_result', 'Expected dated HTTPS preview');
  return { id: row.id, name: value.title, imageUrl: value.imageUrl, imageSource: 'arcade', providerProductId: value.productId,
    providerPatternId: value.patternId, providerJobId: row.productJobId, generatedAt: value.createdAt, providerUnitPrice: value.unitPrice ?? null,
    priceIncludesShippingAndTax: false, previewRetrievedAt: new Date().toISOString() };
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function concat(...parts) { const result = new Uint8Array(parts.reduce((n, part) => n + part.length, 0)); let at = 0; for (const part of parts) { result.set(part, at); at += part.length; } return result; }
function chunk(name, bytes) {
  const kind = new TextEncoder().encode(name), length = new Uint8Array(4), crc = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, bytes.length); new DataView(crc.buffer).setUint32(0, crc32(concat(kind, bytes)));
  return concat(length, kind, bytes, crc);
}
async function labelMask(sourceWidth, sourceHeight) {
  if (![sourceWidth, sourceHeight].every(n => Number.isSafeInteger(n) && n >= 64 && n <= 100000)) throw new ApiError(400, 'invalid_dimensions', 'Pattern dimensions cannot support the label region');
  const scale = Math.min(1, 1536 / Math.max(sourceWidth, sourceHeight)), width = Math.round(sourceWidth * scale), height = Math.round(sourceHeight * scale);
  const region = { left: Math.floor(width * 0.15), top: Math.floor(height * 0.60), width: Math.floor(width * 0.70), height: Math.floor(height * 0.20) };
  if (region.width < 16 || region.height < 16) throw new ApiError(400, 'invalid_dimensions', 'Label region must cover at least 16 by 16 pixels');
  const stride = width * 4 + 1, pixels = new Uint8Array(stride * height);
  for (let y = region.top; y < region.top + region.height; y++) for (let x = region.left; x < region.left + region.width; x++) pixels[y * stride + 1 + x * 4 + 3] = 255;
  const ihdr = new Uint8Array(13); const view = new DataView(ihdr.buffer); view.setUint32(0, width); view.setUint32(4, height); ihdr[8] = 8; ihdr[9] = 6;
  const compressed = new Uint8Array(await new Response(new Blob([pixels]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  const png = concat(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', new Uint8Array()));
  let binary = ''; for (let at = 0; at < png.length; at += 8192) binary += String.fromCharCode(...png.subarray(at, at + 8192));
  return { width, height, region, dataUrl: `data:image/png;base64,${btoa(binary)}` };
}

export class Generation {
  constructor(env, { snapshot, transport = fetch }) {
    if (!env.DB) throw new ApiError(503, 'missing_database', 'Persistent generation storage is required');
    this.env = env; this.snapshot = snapshot; this.transport = transport; this.db = env.DB;
  }
  adapter() { return new Arcade({ key: this.env.ARCADE_API_KEY, transport: this.transport,
    requestTimeoutMs: Math.min(180000, Math.max(1000, positive(this.env.ARCADE_REQUEST_TIMEOUT_MS, 180000))) }); }
  authorize() { if (!enabled(this.env)) throw new ApiError(403, 'generation_disabled', 'Provider generation is disabled'); }
  async categories() {
    if (enabled(this.env) && this.env.ARCADE_API_KEY) return this.adapter().demoCategories();
    return [...new Map(this.snapshot.designs.filter(row => row.category?.categoryId).map(row => [row.category.categoryId, row.category])).values()];
  }
  async metadata() {
    const rows = (await this.db.prepare('SELECT kind,status FROM generation_jobs').all()).results;
    const maxDesigns = positive(this.env.MAX_DESIGNS, 3), maxPersonalizations = positive(this.env.MAX_PERSONALIZATIONS, 1);
    const remainingDesigns = Math.max(0, maxDesigns - this.seedCount('design') - rows.filter(row => row.kind === 'design').length);
    const remainingPersonalizations = Math.max(0, maxPersonalizations - this.seedCount('personalization') - rows.filter(row => row.kind === 'personalization').length);
    const activeGeneration = rows.some(row => active.includes(row.status));
    const generationBlocker = !enabled(this.env) ? 'generation_disabled' : !this.env.ARCADE_API_KEY ? 'provider_unavailable'
      : activeGeneration ? 'generation_busy' : remainingDesigns === 0 ? 'design_limit' : null;
    return { mode: 'live', maxDesigns, remainingDesigns, maxPersonalizations, remainingPersonalizations, activeGeneration,
      generationAvailable: generationBlocker === null, generationBlocker,
      personalizationGenerationEnabled: enabled(this.env) && Boolean(this.env.ARCADE_API_KEY),
      personalizationAdmissionAvailable: enabled(this.env) && Boolean(this.env.ARCADE_API_KEY) && remainingPersonalizations > 0 && !activeGeneration };
  }
  seedCount(kind) { return kind === 'design' ? this.snapshot.designs.length : (this.snapshot.examples?.length ?? 0); }
  async listDesigns() { return (await this.db.prepare("SELECT value_json FROM generation_jobs WHERE kind='design' ORDER BY rowid").all()).results.map(row => JSON.parse(row.value_json)); }
  async listPersonalizations() { return (await this.db.prepare("SELECT value_json FROM generation_jobs WHERE kind='personalization' ORDER BY rowid DESC").all()).results.map(row => JSON.parse(row.value_json)); }
  async row(id, kind) {
    const row = await this.db.prepare('SELECT * FROM generation_jobs WHERE id=? AND kind=?').bind(id, kind).first();
    if (!row) throw new ApiError(404, kind === 'design' ? 'unknown_design' : 'unknown_personalization', `Unknown ${kind}`);
    return { record: row, value: JSON.parse(row.value_json) };
  }
  async owned(id, owner) {
    const sessionId = ownerSession(owner?.sessionId), row = await this.row(id, 'personalization');
    if (row.value.customer?.sessionId !== sessionId) throw new ApiError(404, 'unknown_personalization', 'Unknown personalization');
    return row;
  }
  public(row) {
    if (row.kind === 'design') return { designId: row.id, status: row.status, stage: row.stage, mode: 'live', error: row.error ?? null,
      providerJobId: row.stage === 'pattern' ? row.patternJobId ?? null : row.productJobId ?? null, product: row.product ?? null };
    return { personalizationId: row.id, status: row.status, stage: row.stage, sourceDesignId: row.input.sourceDesignId, text: row.input.text,
      sourcePatternId: row.sourcePatternId, refinedPatternId: row.refinedPatternId ?? null, refineJobId: row.refineJobId ?? null,
      productJobId: row.productJobId ?? null, product: row.product ?? null, error: row.error ?? null };
  }
  async readDesign(id) { return this.public((await this.row(id, 'design')).value); }
  async readPersonalization(id, owner) { return this.public((await this.owned(id, owner)).value); }
  async existing(kind, key, input) {
    const record = await this.db.prepare('SELECT value_json,input_json FROM generation_jobs WHERE request_key=?').bind(`${kind}:${key}`).first();
    if (!record) return null;
    if (record.input_json !== JSON.stringify(input)) throw new ApiError(409, 'request_conflict', 'requestId was used with different input');
    return JSON.parse(record.value_json);
  }
  async admit(kind, key, input, extra) {
    const id = crypto.randomUUID(), sessionId = extra.customer?.sessionId ?? null;
    const row = { id, kind, input, mode: 'live', stage: kind === 'design' ? 'pattern' : 'refine', status: 'queued', product: null,
      error: null, createdAt: new Date().toISOString(), ...extra };
    const cap = positive(kind === 'design' ? this.env.MAX_DESIGNS : this.env.MAX_PERSONALIZATIONS, kind === 'design' ? 3 : 1);
    const result = await this.db.prepare(`INSERT INTO generation_jobs (id,kind,request_key,input_json,session_id,status,stage,value_json)
      SELECT ?,?,?,?,?,?,?,? WHERE ?=1
      AND NOT EXISTS (SELECT 1 FROM generation_jobs WHERE status IN (${activeSQL}))
      AND (SELECT COUNT(*) FROM generation_jobs WHERE kind=?) + ? < ?
      ON CONFLICT(request_key) DO NOTHING`).bind(id, kind, `${kind}:${key}`, JSON.stringify(input), sessionId, row.status, row.stage,
        JSON.stringify(row), enabled(this.env) ? 1 : 0, kind, this.seedCount(kind), cap).run();
    if (result.meta.changes) return { row, fresh: true };
    const duplicate = await this.existing(kind, key, input); if (duplicate) return { row: duplicate, fresh: false };
    this.authorize();
    if ((await this.db.prepare(`SELECT id FROM generation_jobs WHERE status IN (${activeSQL}) LIMIT 1`).first())) throw new ApiError(409, 'generation_busy', 'Resolve the existing provider work first');
    throw new ApiError(429, kind === 'design' ? 'design_limit' : 'personalization_limit', 'Shared configured generation allowance is exhausted');
  }
  async createDesign(value) {
    this.authorize(); exactObject(value, ['prompt', 'categoryId', 'requestId']);
    const input = { prompt: textField(value.prompt, 'prompt', 1000), categoryId: textField(value.categoryId, 'categoryId'), requestId: textField(value.requestId, 'requestId') };
    const existing = await this.existing('design', input.requestId, input); if (existing) return this.public(existing);
    const category = (await this.categories()).find(item => item.categoryId === input.categoryId);
    if (!category) throw new ApiError(400, 'unsupported_category', 'Choose a supported category from /api/designs/categories');
    const { row, fresh } = await this.admit('design', input.requestId, input, { category });
    return fresh ? this.advanceDesign(row.id) : this.public(row);
  }
  async source(id) {
    let source = this.snapshot.designs.find(row => row.id === id);
    if (!source) { try { source = (await this.row(id, 'design')).value; } catch (error) { if (error.status !== 404) throw error; } }
    if (!source || source.status !== 'succeeded' || source.mode !== 'live' || source.product?.imageSource !== 'arcade'
      || !source.product.providerJobId || !source.product.providerPatternId || !source.product.providerProductId || !source.category?.selections)
      throw new ApiError(400, 'invalid_source', 'Choose a completed proven live creator design');
    return source;
  }
  async createPersonalization(value) {
    this.authorize(); exactObject(value, ['campaignId', 'creatorId', 'sessionId', 'sourceDesignId', 'text', 'requestId']);
    const input = { campaignId: textField(value.campaignId, 'campaignId'), creatorId: textField(value.creatorId, 'creatorId'),
      sessionId: ownerSession(value.sessionId), sourceDesignId: textField(value.sourceDesignId, 'sourceDesignId'), text: textField(value.text, 'text', 32), requestId: textField(value.requestId, 'requestId') };
    if (!uuid.test(input.requestId) || !/^[\p{L}\p{N} .,'’\-]+$/u.test(input.text)) throw new ApiError(400, 'invalid_text', 'Use a request UUID and short place/year text');
    if (input.campaignId !== this.snapshot.campaign.id || input.creatorId !== this.snapshot.campaign.creator.id) throw new ApiError(400, 'invalid_input', 'Unknown campaign or creator');
    const key = `${input.sessionId}:${input.requestId}`, existing = await this.existing('personalization', key, input); if (existing) return this.public(existing);
    const source = await this.source(input.sourceDesignId); this.adapter();
    const { row, fresh } = await this.admit('personalization', key, input, { category: source.category, sourcePatternId: source.product.providerPatternId,
      sourceProductId: source.product.providerProductId, customer: { sessionId: input.sessionId, campaignId: input.campaignId, creatorId: input.creatorId } });
    return fresh ? this.advancePersonalization(row.id, { sessionId: input.sessionId }) : this.public(row);
  }
  async validateEvent(value) {
    const row = (await this.owned(value.personalizationId, value)).value;
    if (!['reward_selected', 'checkout_simulated'].includes(value.type) || row.status !== 'succeeded' || !row.product
      || row.customer.campaignId !== value.campaignId || row.customer.creatorId !== value.creatorId
      || row.input.sourceDesignId !== value.rewardId || row.input.text !== value.personalization?.text)
      throw new ApiError(400, 'invalid_personalization', 'Use your completed variant with matching design and text');
    return row.product;
  }
  async advanceDesign(id) { this.authorize(); return this.advance(await this.row(id, 'design')); }
  async advancePersonalization(id, owner) { this.authorize(); return this.advance(await this.owned(id, owner)); }
  async save(row, version, token, release = false) {
    const result = await this.db.prepare(`UPDATE generation_jobs SET value_json=?,status=?,stage=?,version=version+1,
      lock_token=?,lock_until=? WHERE id=? AND version=? AND lock_token=?`).bind(JSON.stringify(row), row.status, row.stage,
        release ? null : token, release ? null : Date.now() + 30000, row.id, version, token).run();
    return result.meta.changes ? version + 1 : null;
  }
  async advance({ record, value: row }) {
    if (['succeeded', 'failed'].includes(row.status)) return this.public(row);
    if (['starting', 'unknown'].includes(row.status)) throw new ApiError(409, 'unknown_start', 'Provider start requires manual reconciliation; no automatic retry');
    const token = crypto.randomUUID();
    const claimed = await this.db.prepare(`UPDATE generation_jobs SET lock_token=?,lock_until=?,version=version+1 WHERE id=? AND version=?
      AND (lock_token IS NULL OR lock_until<?)`).bind(token, Date.now() + 30000, row.id, record.version, Date.now()).run();
    if (!claimed.meta.changes) return this.public((await this.row(row.id, row.kind)).value);
    let version = record.version + 1, started = false;
    const persist = async (release = false) => { const next = await this.save(row, version, token, release); if (next === null) throw new ApiError(409, 'generation_changed', 'Generation advanced in another request'); version = next; };
    try {
      const adapter = this.adapter(), pattern = row.stage === 'pattern', refine = row.stage === 'refine';
      const jobField = pattern ? 'patternJobId' : refine ? 'refineJobId' : 'productJobId';
      if (!row[jobField]) {
        let body;
        if (pattern) body = { requestId: `${row.id}:pattern`, prompt: row.input.prompt };
        else if (refine) {
          const source = await adapter.call('patterns/get', { patternId: row.sourcePatternId });
          if (source.patternId !== row.sourcePatternId) throw new ApiError(502, 'invalid_provider_result', 'Unexpected source pattern');
          const prepared = this.snapshot.masks?.[row.input.sourceDesignId];
          const mask = prepared?.sourceWidth === source.width && prepared?.sourceHeight === source.height ? prepared : await labelMask(source.width, source.height);
          row.sourceDimensions = { width: source.width, height: source.height }; row.maskRegion = { width: mask.width, height: mask.height, region: mask.region };
          body = { requestId: `${row.id}:refine`, patternId: row.sourcePatternId,
            instruction: `Inside the selected region only, integrate the exact text ${JSON.stringify(row.input.text)} as an elegant, clearly readable travel signature. Center the lettering in the selected region, with letter height about 7 percent of the whole image height. Use refined dark teal lettering and a quiet sand-colored area behind it, harmonized with the existing textile artwork. Keep it inside the print-safe area, away from the bottom edge. Preserve all creator artwork, colors and composition outside the selected region. Add no other text or logos.`, mask: mask.dataUrl };
        } else {
          if (row.kind === 'personalization') {
            const derived = await adapter.call('patterns/get', { patternId: row.refinedPatternId });
            if (derived.patternId !== row.refinedPatternId || derived.sourcePatternId !== row.sourcePatternId) throw new ApiError(502, 'invalid_provider_result', 'Derivative source lineage is not verified');
          }
          body = { requestId: `${row.id}:product`, patternId: row.kind === 'design' ? row.patternId : row.refinedPatternId,
            categoryId: row.category.categoryId, selections: row.category.selections, fit: { mode: 'fill' } };
        }
        row[pattern ? 'patternBody' : refine ? 'refineBody' : 'productBody'] = body;
        row.status = 'starting'; row.error = null; await persist(); started = true;
        const result = await (pattern ? adapter.startPattern(body) : refine ? adapter.call('patterns/refine/editRegion', body) : adapter.startProduct(body));
        if (typeof result.jobId !== 'string' || !result.jobId) throw new ApiError(502, 'invalid_provider_result', 'Missing provider job ID');
        row[jobField] = result.jobId; row.status = 'running'; await persist(true); return this.public(row);
      }
      const job = await adapter.getJob(row[jobField]);
      if (job.jobId !== row[jobField] || job.kind !== (pattern || refine ? 'pattern' : 'product')) throw new ApiError(502, 'invalid_provider_result', 'Wrong job identity or kind');
      if (job.status === 'failed') throw new ApiError(502, 'provider_failed', 'Provider job failed');
      if (job.status === 'running') { row.status = 'running'; row.error = null; await persist(true); return this.public(row); }
      if (job.status !== 'succeeded') throw new ApiError(502, 'invalid_provider_result', 'Unexpected job status');
      if (pattern || refine) {
        const patternId = job.result?.patternId;
        if (typeof patternId !== 'string' || !patternId || (refine && patternId === row.sourcePatternId)) throw new ApiError(502, 'provider_no_result', 'No usable new pattern');
        if (pattern) {
          const source = await adapter.call('patterns/get', { patternId });
          if (source.patternId !== patternId || ![source.width, source.height].every(n => Number.isSafeInteger(n) && n > 0)) throw new ApiError(502, 'invalid_provider_result', 'Pattern metadata does not match the completed job');
          row.patternId = patternId; row.sourceDimensions = { width: source.width, height: source.height };
        } else row.refinedPatternId = patternId;
        row.stage = 'product'; row.status = 'queued'; row.error = null; await persist(true); return this.public(row);
      }
      if (typeof job.result?.productId !== 'string' || !job.result.productId) throw new ApiError(502, 'provider_no_result', 'No product result');
      row.productId = job.result.productId; await persist();
      const product = await adapter.getProduct(row.productId), expected = row.kind === 'design' ? row.patternId : row.refinedPatternId;
      if (product.productId !== row.productId || product.patternId !== expected) throw new ApiError(502, 'invalid_provider_result', 'Product provenance does not match the job');
      row.product = providerProduct(product, row);
      if (row.kind === 'personalization') Object.assign(row.product, { sourceDesignId: row.input.sourceDesignId, sourcePatternId: row.sourcePatternId,
        personalizationText: row.input.text, visualReviewRequired: true });
      row.status = 'succeeded'; row.error = null; await persist(true); return this.public(row);
    } catch (error) {
      if (error.code === 'generation_changed') return this.public((await this.row(row.id, row.kind)).value);
      row.status = started ? 'unknown' : ['provider_failed', 'provider_no_result', 'invalid_dimensions'].includes(error.code) ? 'failed' : 'timed_out';
      row.error = { code: started ? 'unknown_start' : error.code ?? 'provider_unavailable',
        message: started ? 'Start response is uncertain; manual reconciliation is required' : 'Provider result was not confirmed; existing job and source are preserved' };
      const next = await this.save(row, version, token, true);
      return this.public(next === null ? (await this.row(row.id, row.kind)).value : row);
    }
  }
}
