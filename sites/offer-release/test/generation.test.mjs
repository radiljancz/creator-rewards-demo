import test from 'node:test';
import assert from 'node:assert/strict';
import { Generation, schema } from '../worker/generation.mjs';
import { sqliteD1, provider, snapshot, session, requestId } from './helpers.mjs';

const designInput = { prompt: 'Coastal textile', categoryId: 'outdoor-pillow', requestId: 'design-request' };
const personalizeInput = { campaignId: 'campaign', creatorId: 'creator', sessionId: session, sourceDesignId: 'source', text: 'Praha 2026', requestId };
function setup(t, options = {}) {
  const DB = sqliteD1(); DB.exec(schema); t.after(() => DB.close());
  const fake = provider(options);
  const env = { DB, GENERATION_ENABLED: 'true', ARCADE_API_KEY: 'test-only', MAX_DESIGNS: '3', MAX_PERSONALIZATIONS: '10' };
  return { DB, fake, env, generation: new Generation(env, { snapshot, transport: fake.transport }) };
}
async function finishDesign(generation, id) { for (let i = 0; i < 4; i++) await generation.advanceDesign(id); return generation.readDesign(id); }
async function finishPersonalization(generation, id) { for (let i = 0; i < 4; i++) await generation.advancePersonalization(id, { sessionId: session }); return generation.readPersonalization(id, { sessionId: session }); }

test('base generation persists jobs across instances and only explicit advance starts the product', async t => {
  const { generation, env, fake } = setup(t);
  const created = await generation.createDesign(designInput);
  assert.equal(created.status, 'running'); assert.equal(created.stage, 'pattern');
  const restarted = new Generation(env, { snapshot, transport: fake.transport });
  assert.equal((await restarted.readDesign(created.designId)).providerJobId, 'pattern-job');
  await restarted.advanceDesign(created.designId);
  assert.equal((await restarted.readDesign(created.designId)).stage, 'product');
  assert.equal(fake.calls.filter(call => call.op === 'products/create').length, 0);
  const done = await finishDesign(restarted, created.designId);
  assert.equal(done.status, 'succeeded'); assert.equal(done.product.providerPatternId, 'new-pattern');
});

test('idempotent repeat survives restart and conflicting input never starts a second job', async t => {
  const { generation, env, fake } = setup(t);
  const first = await generation.createDesign(designInput);
  const restarted = new Generation(env, { snapshot, transport: fake.transport });
  assert.equal((await restarted.createDesign(designInput)).designId, first.designId);
  await assert.rejects(restarted.createDesign({ ...designInput, prompt: 'different' }), { code: 'request_conflict' });
  assert.equal(fake.calls.filter(call => call.op === 'patterns/create').length, 1);
});

test('concurrent instances admit exactly one active generation globally', async t => {
  const { generation, env, fake, DB } = setup(t);
  const second = new Generation(env, { snapshot, transport: fake.transport });
  const results = await Promise.allSettled([generation.createDesign(designInput), second.createPersonalization(personalizeInput)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await DB.prepare('SELECT COUNT(*) AS count FROM generation_jobs').first()).count, 1);
  assert.equal(fake.calls.filter(call => /patterns\/create|editRegion/.test(call.op)).length, 1);
});

test('uncertain POST blocks future starts, restart and GET never retry it', async t => {
  const { generation, env, fake } = setup(t, { uncertain: true });
  const created = await generation.createDesign(designInput);
  assert.equal(created.status, 'unknown');
  const restarted = new Generation(env, { snapshot, transport: fake.transport });
  await restarted.readDesign(created.designId); await restarted.createDesign(designInput);
  await assert.rejects(restarted.advanceDesign(created.designId), { code: 'unknown_start' });
  await assert.rejects(restarted.createDesign({ ...designInput, requestId: 'second' }), { code: 'generation_busy' });
  assert.equal(fake.calls.filter(call => call.op === 'patterns/create').length, 1);
});

test('generation flag and persistent global caps fail closed', async t => {
  const { generation, env, fake } = setup(t);
  const disabled = new Generation({ ...env, GENERATION_ENABLED: 'false' }, { snapshot, transport: fake.transport });
  await assert.rejects(disabled.createDesign(designInput), { code: 'generation_disabled' });
  const first = await generation.createDesign(designInput); await finishDesign(generation, first.designId);
  const capped = new Generation({ ...env, MAX_DESIGNS: '2' }, { snapshot, transport: fake.transport });
  await assert.rejects(capped.createDesign({ ...designInput, requestId: 'another' }), { code: 'design_limit' });
});

test('refinement uses source dimensions, persists derivative provenance and enforces owner on reads/resume/events', async t => {
  const { generation, fake, env } = setup(t, { dimensions: [2000, 1000] });
  const created = await generation.createPersonalization(personalizeInput);
  assert.equal(created.status, 'running'); assert.equal(created.refineJobId, 'refine-job');
  const restarted = new Generation(env, { snapshot, transport: fake.transport });
  await assert.rejects(restarted.readPersonalization(created.personalizationId, { sessionId: '33333333-3333-4333-8333-333333333333' }), { code: 'unknown_personalization' });
  await assert.rejects(restarted.advancePersonalization(created.personalizationId, { sessionId: '33333333-3333-4333-8333-333333333333' }), { code: 'unknown_personalization' });
  const done = await finishPersonalization(restarted, created.personalizationId);
  assert.equal(done.status, 'succeeded'); assert.equal(done.product.sourcePatternId, 'original'); assert.equal(done.product.providerPatternId, 'derived');
  const refine = fake.calls.find(call => call.op === 'patterns/refine/editRegion').body;
  assert.equal(refine.patternId, 'original'); assert.match(refine.instruction, /Praha 2026/); assert.match(refine.mask, /^data:image\/png;base64,/);
  const bytes = Buffer.from(refine.mask.split(',')[1], 'base64');
  assert.equal(bytes.readUInt32BE(16), 1536); assert.equal(bytes.readUInt32BE(20), 768);
  const event = { ...personalizeInput, personalizationId: done.personalizationId, rewardId: 'source', type: 'reward_selected', personalization: { text: 'Praha 2026' } };
  assert.equal((await restarted.validateEvent(event)).providerProductId, done.product.providerProductId);
  await assert.rejects(restarted.validateEvent({ ...event, sessionId: '33333333-3333-4333-8333-333333333333' }), { code: 'unknown_personalization' });
});

test('customer session permits a third attempt while shared configured budget remains and source must be proven live', async t => {
  const { generation, env, fake } = setup(t);
  await assert.rejects(generation.createPersonalization({ ...personalizeInput, sourceDesignId: 'foreign' }), { code: 'invalid_source' });
  const base = await generation.createDesign(designInput); await finishDesign(generation, base.designId);
  const first = await generation.createPersonalization({ ...personalizeInput, sourceDesignId: base.designId }); await finishPersonalization(generation, first.personalizationId);
  const second = await generation.createPersonalization({ ...personalizeInput, requestId: '44444444-4444-4444-8444-444444444444' }); await finishPersonalization(generation, second.personalizationId);
  const third = await generation.createPersonalization({ ...personalizeInput, requestId: '55555555-5555-4555-8555-555555555555' });
  assert.equal(third.status, 'running'); await finishPersonalization(generation, third.personalizationId);
  const restarted = new Generation({ ...env, MAX_PERSONALIZATIONS: '4' }, {
    snapshot: { ...snapshot, examples: [{ product: {} }] }, transport: fake.transport,
  });
  const metadata = await restarted.metadata();
  assert.equal(metadata.maxPersonalizations, 4); assert.equal(metadata.remainingPersonalizations, 0);
  assert.equal(metadata.personalizationGenerationEnabled, true);
  assert.equal(metadata.personalizationAdmissionAvailable, false);
  await assert.rejects(restarted.createPersonalization({ ...personalizeInput,
    sessionId: '66666666-6666-4666-8666-666666666666', requestId: '77777777-7777-4777-8777-777777777777' }), { code: 'personalization_limit' });
});

test('wrong derivative lineage stops before product creation', async t => {
  const { generation, fake } = setup(t, { wrongLineage: true });
  const created = await generation.createPersonalization(personalizeInput);
  await generation.advancePersonalization(created.personalizationId, { sessionId: session });
  const result = await generation.advancePersonalization(created.personalizationId, { sessionId: session });
  assert.equal(result.status, 'timed_out'); assert.equal(result.error.code, 'invalid_provider_result');
  assert.equal(fake.calls.filter(call => call.op === 'products/create').length, 0);
});

test('seed generations consume global allowances and disabled catalog uses stored metadata without provider reads', async t => {
  const { env, fake } = setup(t);
  const capped = new Generation({ ...env, MAX_DESIGNS: '1' }, { snapshot, transport: fake.transport });
  await assert.rejects(capped.createDesign(designInput), { code: 'design_limit' });
  const seeded = { ...snapshot, examples: [{ product: {} }] };
  const cappedPersonalization = new Generation({ ...env, MAX_PERSONALIZATIONS: '1' }, { snapshot: seeded, transport: fake.transport });
  await assert.rejects(cappedPersonalization.createPersonalization(personalizeInput), { code: 'personalization_limit' });
  const disabled = new Generation({ ...env, GENERATION_ENABLED: 'false' }, { snapshot, transport: fake.transport });
  const before = fake.calls.length;
  const categories = await disabled.categories();
  assert.equal(categories[0].categoryId, 'outdoor-pillow'); assert.equal(fake.calls.length, before);
  const metadata = await disabled.metadata();
  assert.equal(metadata.generationAvailable, false); assert.equal(metadata.personalizationGenerationEnabled, false);
});

test('real database reopen retains request idempotency and job IDs without provider work on read', async t => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'generation-d1-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'persist.sqlite'), fake = provider();
  const firstDB = sqliteD1(file); firstDB.exec(schema);
  const env = { DB: firstDB, GENERATION_ENABLED: 'true', ARCADE_API_KEY: 'test-only', MAX_DESIGNS: '3' };
  const first = await new Generation(env, { snapshot, transport: fake.transport }).createDesign(designInput);
  firstDB.close();
  const reopened = sqliteD1(file); t.after(() => reopened.close());
  const next = new Generation({ ...env, DB: reopened }, { snapshot, transport: fake.transport });
  const before = fake.calls.length;
  assert.equal((await next.readDesign(first.designId)).providerJobId, 'pattern-job');
  assert.equal((await next.createDesign(designInput)).designId, first.designId);
  assert.equal(fake.calls.length, before);
});

test('concurrent advances cannot dispatch the same product twice', async t => {
  const { generation, env, fake } = setup(t);
  const first = await generation.createDesign(designInput); await generation.advanceDesign(first.designId);
  const second = new Generation(env, { snapshot, transport: fake.transport });
  await Promise.all([generation.advanceDesign(first.designId), second.advanceDesign(first.designId)]);
  assert.equal(fake.calls.filter(call => call.op === 'products/create').length, 1);
  assert.equal((await generation.readDesign(first.designId)).providerJobId, 'product-new-pattern');
});

test('failed provider poll retains job identity and explicit advance resumes reads of that job', async t => {
  const { generation, env, fake } = setup(t);
  const first = await generation.createDesign(designInput);
  const pollFailure = new Generation(env, { snapshot, transport: async (url, options) => {
    if (url.endsWith('/jobs/get')) throw new Error('read temporarily unavailable');
    return fake.transport(url, options);
  } });
  const paused = await pollFailure.advanceDesign(first.designId);
  assert.equal(paused.status, 'timed_out'); assert.equal(paused.providerJobId, 'pattern-job');
  await generation.advanceDesign(first.designId);
  assert.equal((await generation.readDesign(first.designId)).stage, 'product');
  assert.equal(fake.calls.filter(call => call.op === 'patterns/create').length, 1);
});

test('provider failure is terminal and does not dispatch product creation', async t => {
  const { generation, env, fake } = setup(t);
  const first = await generation.createDesign(designInput);
  const failed = new Generation(env, { snapshot, transport: async (url, options) => url.endsWith('/jobs/get')
    ? Response.json({ jobId: 'pattern-job', kind: 'pattern', status: 'failed' }) : fake.transport(url, options) });
  const result = await failed.advanceDesign(first.designId);
  assert.equal(result.status, 'failed'); assert.equal(result.product, null);
  await generation.advanceDesign(first.designId);
  assert.equal(fake.calls.filter(call => call.op === 'products/create').length, 0);
});

test('final admitted personalization remains resumable after restart with zero slots',async t=>{const {env,fake}=setup(t);const last=new Generation({...env,MAX_PERSONALIZATIONS:'1'},{snapshot,transport:fake.transport});const job=await last.createPersonalization(personalizeInput);const metadata=await last.metadata();assert.equal(metadata.remainingPersonalizations,0);assert.equal(metadata.personalizationGenerationEnabled,true);assert.equal(metadata.personalizationAdmissionAvailable,false);const restarted=new Generation({...env,MAX_PERSONALIZATIONS:'1'},{snapshot,transport:fake.transport});assert.equal((await finishPersonalization(restarted,job.personalizationId)).status,'succeeded');await assert.rejects(restarted.createPersonalization({...personalizeInput,requestId:'99999999-9999-4999-8999-999999999999'}),{code:'personalization_limit'});});
test('saved personalization list restores newest variant first',async t=>{const {generation}=setup(t);const first=await generation.createPersonalization(personalizeInput);await finishPersonalization(generation,first.personalizationId);const last=await generation.createPersonalization({...personalizeInput,requestId:'88888888-8888-4888-8888-888888888888'});assert.equal((await generation.listPersonalizations())[0].id,last.personalizationId);});
