import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Store } from '../store.mjs';
import { createApp } from '../server.mjs';
const sourceId = 'creator-live';
const category = { categoryId: 'pillow', selections: { size: '18x18' } };
async function fixture(t, options = {}) {
 const store = new Store(':memory:');
 const source = { id: sourceId, requestId: 'source', mode: 'live', status: 'succeeded', stage: 'product', category, product: { id: sourceId, name: 'Original', imageSource: 'arcade', imageUrl: 'https://example.test/source.png', providerJobId: 'source-job', providerPatternId: 'source-pattern', providerProductId: 'source-product' } };
 store.putDesign(source);store.putProduct(source.product);
 const calls=[];
 const adapter={
  async call(op,body){calls.push(op); return op==='patterns/get'?{patternId:body.patternId,sourcePatternId:body.patternId==='source-pattern'?null:'source-pattern',width:1024,height:1024}:{jobId:'refine'}},
  async startProduct(){calls.push('products/create');return {jobId:'product'}},
  async getJob(jobId){calls.push('jobs/get');return {jobId,kind:jobId==='refine'?'pattern':'product',status:'succeeded',result:jobId==='refine'?{patternId:'derived-pattern'}:{productId:'derived-product'}}},
  async getProduct(productId){calls.push('products/get');return {productId,patternId:'derived-pattern',title:'Personalized',imageUrl:'https://example.test/derived.png',createdAt:new Date().toISOString(),unitPrice:{amount:'40.56',currency:'USD'}}}
 };
 const app=createApp({store,adapter,mode:'live',category,personalizationGenerationEnabled:true,customerPersonalizationEnabled:true,maxPersonalizations:10,pollMs:5,timeoutMs:1000,...options});
 await app.listen(0);t.after(()=>app.close());const base=`http://127.0.0.1:${app.server.address().port}`;
 const call=async(path,data,origin='https://jackery.cz')=>{const r=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{Origin:origin,...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})});return {status:r.status,value:await r.json(),cors:r.headers.get('access-control-allow-origin')}};
 const input=()=>({campaignId:'main',creatorId:'alex',sessionId:randomUUID(),sourceDesignId:sourceId,text:'Yosemite 2026',requestId:randomUUID()});
 const done=async(id,session)=>{for(let n=0;n<100;n++){const r=await call(`/api/growth/customer-personalizations/${id}?sessionId=${session}`);if(r.status!==200||['succeeded','failed','unknown'].includes(r.value.status))return r;await new Promise(r=>setTimeout(r,5))}throw Error('job did not finish')};
 return {store,app,calls,call,input,done,base};
}
test('customer generation is separately disabled and rejects wrong origins and arbitrary inputs',async t=>{
 const f=await fixture(t,{customerPersonalizationEnabled:false});
 assert.equal((await f.call('/api/growth/public?campaign=main')).value.customerPersonalizationEnabled,false);
 assert.equal((await f.call('/api/growth/customer-personalizations',f.input())).status,403);
 assert.equal((await f.call('/api/growth/customer-personalizations',f.input(),'https://evil.example')).status,403);
 assert.equal(f.calls.length,0);
});
test('owned public creation is idempotent, read-only on GET, and preserves the source',async t=>{
 const f=await fixture(t),input=f.input(), original=f.store.getDesign(sourceId);
 for(const invalid of [{...input,creatorId:'wrong'},{...input,sourceDesignId:'coastal-pillow'},{...input,sessionId:'short'},{...input,instruction:'replace art'},{...input,text:'<script>'}])assert.equal((await f.call('/api/growth/customer-personalizations',invalid)).status,400);
 assert.equal(f.calls.length,0);
 const first=await f.call('/api/growth/customer-personalizations',input);assert.equal(first.status,202);assert.equal(first.cors,'https://jackery.cz');const id=first.value.personalizationId;
 const completed=await f.done(id,input.sessionId);assert.equal(completed.value.status,'succeeded');
 const count=f.calls.length;
 assert.equal((await f.call('/api/growth/customer-personalizations',input)).value.personalizationId,id);
 assert.equal((await f.call('/api/growth/customer-personalizations',{...input,text:'Changed'})).status,409);
 assert.equal((await f.call(`/api/growth/customer-personalizations/${id}?sessionId=${randomUUID()}`)).status,404);
 assert.equal((await f.call(`/api/growth/customer-personalizations/${id}`)).status,400);
 assert.equal((await f.call(`/api/growth/customer-personalizations/${id}?sessionId=${input.sessionId}&extra=1`)).status,400);
 assert.equal((await f.call(`/api/growth/customer-personalizations/${id}/resume`,{sessionId:randomUUID()})).status,404);
 for(let n=0;n<3;n++)assert.equal((await f.done(id,input.sessionId)).value.status,'succeeded');
 assert.equal(f.calls.length,count);assert.deepEqual(f.store.getDesign(sourceId),original);
 const serialized=JSON.stringify(completed.value);for(const field of ['refineBody','productBody','mask','customer','requestId'])assert.equal(serialized.includes('"'+field+'"'),false);
 assert.equal((await f.call('/api/growth/personalizations')).status,403);
});
test('a visitor can use the configured demo allowance beyond two attempts, with global persistence and safe replays',async t=>{
 const f=await fixture(t,{maxPersonalizations:3}),first=f.input();let last;
 for(let i=0;i<3;i++){last={...first,requestId:randomUUID()};const r=await f.call('/api/growth/customer-personalizations',last);assert.equal(r.status,202);await f.done(r.value.personalizationId,first.sessionId)}
 const rejected=await f.call('/api/growth/customer-personalizations',{...first,requestId:randomUUID()});assert.equal(rejected.status,429);assert.equal(rejected.value.error.code,'customer_personalization_limit');
 assert.equal((await f.call('/api/growth/customer-personalizations',f.input())).value.error.code,'personalization_limit');
 const calls=f.calls.length,replay=await f.call('/api/growth/customer-personalizations',last);assert.equal(replay.status,202);assert.equal(replay.value.status,'succeeded');assert.equal(f.calls.length,calls);
 assert.equal(f.app.personalizations.rows().length,3);
});
test('generated events require owned completed derivative matching text and source',async t=>{
 const f=await fixture(t),input=f.input(),r=await f.call('/api/growth/customer-personalizations',input),id=r.value.personalizationId;assert.equal(r.status,202);await f.done(id,input.sessionId);
 const event={campaignId:'main',creatorId:'alex',sessionId:input.sessionId,eventId:randomUUID(),type:'checkout_simulated',rewardId:sourceId,items:[{productId:'weekend',quantity:1}],personalization:{text:input.text},personalizationId:id};
 for(const bad of [{...event,sessionId:randomUUID()},{...event,personalization:{text:'Other'}},{...event,rewardId:'coastal-pillow'},{...event,personalization:undefined}])assert.ok((await f.call('/api/growth/events',bad)).status>=400);
 const good=await f.call('/api/growth/events',event);assert.equal(good.status,201);assert.equal(good.value.event.personalizationStatus,'arcade_generated');assert.equal(good.value.event.orderPlaced,false);assert.equal(good.value.event.paymentOccurred,false);assert.equal(good.value.event.payoutsOccurred,false);assert.equal(good.value.event.quote.merchantContributionAfter,undefined);
 assert.equal((await f.call('/api/growth/events',event)).value.duplicate,true);
});

test('customer history lists only owned campaign rows newest first with safe state and no provider work', async t => {
 const f = await fixture(t), sessionId = randomUUID(), otherSession = randomUUID();
 const save = (id, createdAt, customer, status = 'succeeded') => f.app.personalizations.save({ id,
  input: { sourceDesignId: sourceId, text: 'Yosemite 2026', requestId: `local-${id}` }, customer,
  status, stage: 'product', createdAt, sourcePatternId: 'source-pattern', refinedPatternId: 'derived-pattern',
  refineJobId: `refine-${id}`, productJobId: `product-${id}`, product: status === 'succeeded' ? { id, imageUrl: 'https://example.test/derived.png', imageSource: 'arcade' } : null,
  refineBody: { secret: 'private-marker' }, productBody: { secret: 'private-marker' }, mask: 'private-marker' });
 const customer = { sessionId, campaignId: 'main', creatorId: 'alex' };
 const newest = randomUUID(), oldest = randomUUID(), undated = randomUUID();
 save(newest, '2026-10-11T22:30:00.000Z', customer);
 save(oldest, '2026-10-11T21:00:00.000Z', customer, 'unknown');
 save(undated, undefined, customer, 'running');
 save(randomUUID(), '2026-10-11T23:00:00.000Z', { ...customer, sessionId: otherSession });
 save(randomUUID(), '2026-10-11T23:30:00.000Z', undefined);
 save(randomUUID(), '2026-10-11T23:45:00.000Z', { ...customer, campaignId: 'other' });
 const before = f.app.personalizations.rows();
 f.app.personalizations.kick = () => { throw new Error('History must never kick provider work'); };
 const path = `/api/growth/customer-personalizations?sessionId=${sessionId}&campaignId=main`;
 const expected = { items: [newest, oldest, undated].map(id => ({ ...f.app.personalizations.get(id), createdAt: before.find(row => row.id === id).createdAt ?? null })) };
 for (let n = 0; n < 2; n++) {
  const response = await f.call(path); assert.equal(response.status, 200); assert.equal(response.cors, 'https://jackery.cz'); assert.deepEqual(response.value, expected);
  const serialized = JSON.stringify(response.value);
  for (const field of ['input', 'customer', 'requestId', 'refineBody', 'productBody', 'mask', 'private-marker', sessionId]) assert.equal(serialized.includes(field), false);
 }
 const local = await f.call(path, undefined, f.base); assert.equal(local.status, 200); assert.equal(local.cors, null);
 assert.deepEqual((await f.call(`/api/growth/customer-personalizations?sessionId=${randomUUID()}&campaignId=main`)).value, { items: [] });
 assert.equal((await f.call(`/api/growth/customer-personalizations?sessionId=${otherSession}&campaignId=main`)).value.items.length, 1);
 assert.deepEqual((await f.call(`/api/growth/customer-personalizations?campaignId=main&sessionId=${sessionId}`)).value, expected);
 f.app.personalizations.generationEnabled = false;
 assert.deepEqual((await f.call(path)).value, expected);
 assert.deepEqual(f.app.personalizations.rows(), before); assert.equal(f.calls.length, 0);
 for (const invalid of ['', '?sessionId=short&campaignId=main', `?sessionId=${sessionId}`, '?campaignId=main', `?sessionId=${sessionId}&campaignId=other`,
  `?sessionId=${sessionId}&campaignId=main&sessionId=${sessionId}`, `?sessionId=${sessionId}&campaignId=main&campaignId=main`, `?sessionId=${sessionId}&campaign=main`, `?sessionId=${sessionId}&campaignId=main&extra=1`]) {
  assert.equal((await f.call('/api/growth/customer-personalizations' + invalid)).status, 400);
 }
 assert.equal((await f.call(path, undefined, 'https://evil.example')).status, 403);
 assert.equal((await f.call(path, f.input())).status, 400);
 assert.equal(f.calls.length, 0);
});
