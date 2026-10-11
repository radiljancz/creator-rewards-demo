import { Generation } from './generation.mjs';
import { ApiError, exactObject } from './errors.mjs';
import { configInput, cart, calculate, publicQuote } from './economics.mjs';
import { snapshot as savedSnapshot } from './snapshot.mjs';
import { assets as savedAssets } from './assets.mjs';

const fail=(status,code,message)=>{throw new ApiError(status,code,message)};
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const publicEvent=event=>({...event,...(event.quote?{quote:publicQuote(event.quote)}:{})});
const identifier=(value)=>{if(typeof value!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(value))fail(400,'invalid_input','Invalid identifier');return value};
async function hash(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('')}
async function sameSecret(a,b){const x=await hash(a),y=await hash(b);let d=0;for(let i=0;i<x.length;i++)d|=x.charCodeAt(i)^y.charCodeAt(i);return d===0}
async function body(request){
 if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')fail(415,'json_required','Use application/json');
 const reader=request.body?.getReader();if(!reader)fail(400,'invalid_input','JSON body required');let length=0,chunks=[];
 for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>16384){await reader.cancel();fail(413,'body_too_large','Request exceeds 16 KiB')}chunks.push(value)}
 const all=new Uint8Array(length);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length}
 try{return JSON.parse(new TextDecoder().decode(all))}catch{fail(400,'invalid_input','Invalid JSON')}
}
function assetResponse(request,asset){
 const headers={'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",'Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
 if(asset.encoding!=='base64')return new Response(request.method==='HEAD'?null:asset.body,{headers});
 const size=asset.size;
 headers['Accept-Ranges']='bytes';headers['Content-Length']=String(size);
 // Range applies only to GET. Metadata suffices for HEAD without decoding media.
 if(request.method==='HEAD')return new Response(null,{headers});
 let start=0,end=size-1,status=200;
 // Without a validator we cannot establish that an If-Range representation matches.
 const range=request.headers.has('if-range')?null:request.headers.get('range');
 const match=range&&/^bytes=(\d*)-(\d*)$/.exec(range.trim());
 if(match&&(match[1]||match[2])){
  if(match[1]){start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),size-1):size-1}
  else start=Math.max(0,size-Number(match[2]));
  if(start>=size||end<start||size===0){
   headers['Content-Range']=`bytes */${size}`;headers['Content-Length']='0';
   return new Response(null,{status:416,headers});
  }
  status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;headers['Content-Length']=String(end-start+1);
 }
 // Decode only the requested asset, never all embedded media at module startup.
 const decoded=atob(asset.body),bytes=new Uint8Array(decoded.length);
 for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
 return new Response(status===206?bytes.subarray(start,end+1):bytes,{status,headers});
}
export function createHandler({snapshot=savedSnapshot,assets=savedAssets,generation=env=>new Generation(env,{snapshot})}={}){
 return {async fetch(request,env){try{
  const url=new URL(request.url),path=url.pathname,db=env.DB;
  if(!path.startsWith('/api/')){
   if(!['GET','HEAD'].includes(request.method))return json({error:{code:'not_found',message:'Not found'}},404);
   const aliases={'/':'/index.html','/shop':'/shop.html','/studio':'/studio.html','/present':'/presentation.html','/presentation':'/presentation.html'};
   const asset=assets[aliases[path]||path];if(!asset)return json({error:{code:'not_found',message:'Not found'}},404);
   return assetResponse(request,asset);
  }
  if(!db)fail(503,'storage_unavailable','Hosted storage is unavailable');
  if(!['GET','POST','PUT','DELETE','OPTIONS'].includes(request.method))fail(405,'method_not_allowed','Unsupported method');
  if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)fail(403,'invalid_origin','Use this Site to access the demo');
  if(request.method!=='GET'&&request.headers.get('origin')!==url.origin)fail(403,'invalid_origin','Same-origin request required');
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Methods':'GET, POST, PUT, DELETE','Access-Control-Allow-Headers':'Content-Type'}});
  // Persistent shared demo bounds survive Worker isolate changes.
  async function rate(key,limit){const minute=Math.floor(Date.now()/60000),bucket=key+':'+minute;const r=await db.prepare('INSERT INTO demo_rate_limits(bucket,count) VALUES (?,1) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count').bind(bucket).first();if(r.count>limit)fail(429,'rate_limit','Slow down demo requests');if(minute%5===0)await db.prepare('DELETE FROM demo_rate_limits WHERE CAST(substr(bucket,instr(bucket,\':\')+1) AS INTEGER) < ?').bind(minute-5).run()}
  await rate('all',600);
  const gen=generation(env);
  const configured=await db.prepare('SELECT value,revision FROM app_config WHERE id=?').bind('main').first();
  const config=configured?{...JSON.parse(configured.value),revision:configured.revision}:snapshot.campaign;
  gen.snapshot={...snapshot,campaign:config};
  const token=/\bcreator_operator=([a-f0-9]{64})\b/.exec(request.headers.get('cookie')||'')?.[1];
  let operator;
  async function authenticate(){if(operator)return operator;if(!token)fail(401,'operator_required','Sign in to the merchant studio');const row=await db.prepare('SELECT session_id,expires_at FROM operator_sessions WHERE token_hash=?').bind(await hash(token)).first();if(!row||row.expires_at<Date.now())fail(401,'operator_required','Your studio session has expired');operator=row;return row}
  async function collection(){const generated=await gen.listDesigns();const archive=(await db.prepare('SELECT product_id FROM collection_archives WHERE archived=1').all()).results;const hidden=new Set(archive.map(x=>x.product_id));const originals=[...snapshot.designs,...generated].filter(d=>d.status==='succeeded'&&d.product?.imageSource==='arcade').map(d=>({...d.product,id:d.id,archived:hidden.has(d.id)}));return originals}
  async function published(){return (await collection()).filter(p=>!p.archived).map(({archived,...p})=>p)}
  async function reward(id){if(!(await published()).some(p=>p.id===id))fail(400,'invalid_source','Choose a published creator design')}
  function quote(value){exactObject(value,['campaignId','items','rewardId']);if(value.campaignId!==config.id)fail(400,'invalid_input','Unknown campaign');return calculate(cart(value.items,config),config)}
  if(path==='/api/growth/session'&&request.method==='POST'){
   await rate('login',10);const value=await body(request);
   if(!env.DEMO_OPERATOR_TOKEN||env.DEMO_OPERATOR_TOKEN.length<24||typeof value?.token!=='string'||!(await sameSecret(value.token,env.DEMO_OPERATOR_TOKEN)))fail(401,'operator_required','Invalid studio access key');
   exactObject(value,['token']);await db.prepare('DELETE FROM operator_sessions WHERE expires_at < ?').bind(Date.now()).run();
   // Stable operator identity survives login renewal; a lost response can replay its saved request safely.
   const identity=await hash('creator-operator:'+env.DEMO_OPERATOR_TOKEN);
   const sessionId=`${identity.slice(0,8)}-${identity.slice(8,12)}-${identity.slice(12,16)}-${identity.slice(16,20)}-${identity.slice(20,32)}`;
   const cookie=[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
   await db.prepare('INSERT INTO operator_sessions VALUES (?,?,?)').bind(await hash(cookie),sessionId,Date.now()+4*3600000).run();
   return json({operatorSession:true,mode:'live'},200,{'Set-Cookie':`creator_operator=${cookie}; HttpOnly; Secure; SameSite=Strict; Path=/api/growth; Max-Age=14400`});
  }
  if(path==='/api/growth/session'&&request.method==='DELETE'){if(token)await db.prepare('DELETE FROM operator_sessions WHERE token_hash=?').bind(await hash(token)).run();return json({operatorSession:false},200,{'Set-Cookie':'creator_operator=; HttpOnly; Secure; SameSite=Strict; Path=/api/growth; Max-Age=0'})}
  if(path==='/api/growth/public'&&request.method==='GET'){
   if(url.searchParams.get('campaign')!==config.id)fail(404,'unknown_campaign','Unknown campaign');
   const metadata=await gen.metadata();
   return json({id:config.id,shopName:config.shopName,shopUrl:config.shopUrl,currency:config.currency,creator:config.creator,products:config.products.map(({cost,...p})=>p),rewards:await published(),rewardCost:config.economics.rewardCost,revision:config.revision,customerPersonalizationEnabled:metadata.personalizationGenerationEnabled,maxPersonalizations:metadata.maxPersonalizations,remainingPersonalizations:metadata.remainingPersonalizations,activeGeneration:metadata.activeGeneration});
  }
  if(path==='/api/growth/quote'&&request.method==='POST'){const value=await body(request);await reward(value.rewardId);const q=quote(value);if(token){await authenticate();return json(q)}return json(publicQuote(q))}
  if(path==='/api/growth/events'&&request.method==='POST'){
   const value=await body(request);exactObject(value,['campaignId','creatorId','sessionId','eventId','type'],['rewardId','items','personalization','personalizationId']);
   if(value.campaignId!==config.id||value.creatorId!==config.creator.id)fail(400,'invalid_input','Unknown creator or campaign');identifier(value.sessionId);identifier(value.eventId);
   if(!['visit','reward_selected','basket_updated','checkout_simulated'].includes(value.type))fail(400,'invalid_input','Unknown event type');
   const input=canonical(value),existing=await db.prepare('SELECT input,value FROM demo_events WHERE event_id=?').bind(value.eventId).first();
   if(existing){if(existing.input!==input)fail(409,'event_conflict','Event ID has different input');return json({duplicate:true,event:publicEvent(JSON.parse(existing.value))})}
   if(value.rewardId!==undefined)await reward(value.rewardId);
   if(['reward_selected','checkout_simulated'].includes(value.type)&&!value.rewardId)fail(400,'invalid_input','Choose a reward');
   if(['basket_updated','checkout_simulated'].includes(value.type)&&!value.items)fail(400,'invalid_input','Choose a basket');
   if(value.items)cart(value.items,config);
   if(value.personalization){exactObject(value.personalization,['text']);if(typeof value.personalization.text!=='string'||[...value.personalization.text].length>32)fail(400,'invalid_input','Use short personalization text');if(!value.personalizationId)fail(400,'invalid_personalization','Use a completed Arcade variant')}
   const personal=value.personalizationId?await gen.validateEvent(value):null;
   const event={...value,id:crypto.randomUUID(),origin:url.origin,createdAt:new Date().toISOString(),observationSource:'browser_reported',paymentOccurred:false,orderPlaced:false,payoutsOccurred:false,...(value.items?{quote:calculate(cart(value.items,config),config)}:{}),...(personal?{personalizationStatus:'arcade_generated',personalizedProviderProductId:personal.providerProductId}:{})};
   const result=await db.prepare('INSERT INTO demo_events(event_id,input,value,type) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM demo_events)<10000 ON CONFLICT(event_id) DO NOTHING').bind(value.eventId,input,JSON.stringify(event),value.type).run();
   if(result.meta.changes!==1){const conflict=await db.prepare('SELECT input,value FROM demo_events WHERE event_id=?').bind(value.eventId).first();if(!conflict)fail(429,'event_limit','Demo event capacity reached');if(conflict.input!==input)fail(409,'event_conflict','Event ID has different input');return json({duplicate:true,event:publicEvent(JSON.parse(conflict.value))})}
   return json({duplicate:false,event:publicEvent(event)},201);
  }
  const customer=/^\/api\/growth\/customer-personalizations(?:\/([a-zA-Z0-9-]+)(?:\/(advance|resume))?)?$/.exec(path);
  if(customer){
   if(request.method==='GET'&&customer[1]&&!customer[2]){if([...url.searchParams].length!==1||!url.searchParams.has('sessionId'))fail(400,'invalid_input','Use one visitor sessionId');return json(await gen.readPersonalization(customer[1],{sessionId:url.searchParams.get('sessionId'),campaignId:config.id,creatorId:config.creator.id}))}
   if(request.method==='POST'){await rate('generation',60);const value=await body(request);if(!customer[1]){await reward(value.sourceDesignId);return json(await gen.createPersonalization(value),202)}exactObject(value,['sessionId']);return json(await gen.advancePersonalization(customer[1],{...value,campaignId:config.id,creatorId:config.creator.id}),202)}
  }
  // Every remaining API is operator-only, including configuration reads.
  await authenticate();
  if(path==='/api/growth/config'&&request.method==='GET')return json(config);
  if(path==='/api/growth/config'&&request.method==='PUT'){const next=configInput(await body(request));await db.prepare('INSERT INTO app_config VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value, revision=app_config.revision+1').bind('main',JSON.stringify(next),config.revision+1).run();const row=await db.prepare('SELECT revision FROM app_config WHERE id=?').bind('main').first();return json({...next,revision:row.revision})}
  if(path==='/api/growth/dashboard'&&request.method==='GET'){
   const events=(await db.prepare('SELECT value FROM demo_events ORDER BY seq DESC LIMIT 200').all()).results.map(r=>JSON.parse(r.value));
   const rows=(await db.prepare('SELECT type,COUNT(*) AS count FROM demo_events GROUP BY type').all()).results;const counts=Object.fromEntries(rows.map(r=>[r.type,r.count]));
   return json({config,events,stats:{visits:counts.visit||0,selections:counts.reward_selected||0,simulatedCheckouts:counts.checkout_simulated||0},demoConnected:events.length>0,shopConnected:false,observationSource:'browser_reported',mode:'live'});
  }
  if(path==='/api/growth/collection'&&request.method==='GET')return json({items:await collection()});
  const archive=/^\/api\/growth\/collection\/([a-zA-Z0-9_-]{1,128})\/(archive|restore)$/.exec(path);
  if(archive&&request.method==='POST'){exactObject(await body(request),[]);if(!(await collection()).some(p=>p.id===archive[1]))fail(404,'unknown_product','Unknown collection product');await db.prepare('INSERT INTO collection_archives VALUES (?,?) ON CONFLICT(product_id) DO UPDATE SET archived=excluded.archived').bind(archive[1],archive[2]==='archive'?1:0).run();return json({productId:archive[1],archived:archive[2]==='archive'})}
  if(path==='/api/growth/designs/categories'&&request.method==='GET'){const items=await gen.categories(),metadata=await gen.metadata();return json({items,...metadata})}
  if(path==='/api/growth/designs'&&request.method==='POST')return json(await gen.createDesign(await body(request)),202);
  const design=/^\/api\/growth\/designs\/([a-zA-Z0-9-]+)(?:\/(advance|resume|refresh))?$/.exec(path);
  if(design){if(request.method==='GET'&&!design[2])return json(await gen.readDesign(design[1]));if(request.method==='POST'&&design[2]){exactObject(await body(request),[]);return json(await gen.advanceDesign(design[1]),202)}}
  if(path==='/api/growth/personalizations'&&request.method==='GET'){const rows=await gen.listPersonalizations();return json({items:await Promise.all(rows.map(async row=>({...await gen.readPersonalization(row.id,{sessionId:row.customer.sessionId}),requestId:row.input.requestId})))})}
  if(path==='/api/growth/personalizations'&&request.method==='POST'){const value=await body(request);exactObject(value,['sourceDesignId','text','requestId']);await reward(value.sourceDesignId);return json(await gen.createPersonalization({...value,campaignId:config.id,creatorId:config.creator.id,sessionId:operator.session_id}),202)}
  const personal=/^\/api\/growth\/personalizations\/([a-zA-Z0-9-]+)(?:\/(advance|resume))?$/.exec(path);
  if(personal){const row=await db.prepare('SELECT input_json,session_id FROM generation_jobs WHERE id=? AND kind=?').bind(personal[1],'personalization').first();if(!row)fail(404,'unknown_personalization','Unknown personalization');const owner={sessionId:row.session_id,campaignId:config.id,creatorId:config.creator.id};if(request.method==='GET'&&!personal[2])return json(await gen.readPersonalization(personal[1],owner));if(request.method==='POST'&&personal[2]){exactObject(await body(request),[]);return json(await gen.advancePersonalization(personal[1],owner),202)}}
  fail(404,'not_found','Unknown endpoint');
 }catch(error){return json({error:{code:error instanceof ApiError?error.code:'service_unavailable',message:error instanceof ApiError?error.message:'The demo service could not complete this request.'}},error instanceof ApiError?error.status:503)}}};
}
export default createHandler();
