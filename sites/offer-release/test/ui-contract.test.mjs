import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const studio = readFileSync(new URL('../public/studio.html', import.meta.url), 'utf8');
const source = [...studio.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1];
const drain = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  const nodes = new Map(), requests = [], stored = [], timers = [];
  const element = id => {
    if (!nodes.has(id)) nodes.set(id, { hidden: id === 'merchant-layout', value: '', disabled: false, textContent: '', children: [], dataset: {}, classList: {toggle(){},add(){},remove(){}}, setAttribute(){}, focus(){} });
    return nodes.get(id);
  };
  const storage = {getItem:()=>null,setItem:(...args)=>stored.push(args),removeItem(){}};
  const context = vm.createContext({document:{getElementById:element,querySelectorAll:()=>[]},location:{origin:'https://creator.example',search:''},localStorage:storage,sessionStorage:storage,URL,URLSearchParams,crypto:{randomUUID:()=> 'request-uuid'},Intl,console,navigator:{},setInterval:()=>0,setTimeout:(fn)=>{timers.push(fn);return timers.length},clearTimeout(){},fetch:async(path,options={})=>{requests.push({path,options});return {ok:false,status:401,json:async()=>({error:{code:'operator_required',message:'Access key required'}})}}});
  vm.runInContext(source,context);
  return {context,element,requests,stored,timers};
}

test('opening studio asks for access without creating an operator session', async()=>{
  const h=harness(); await drain();
  assert.equal(h.requests.length,1);
  assert.equal(h.requests[0].path,'/api/growth/config');
  assert.equal(h.requests[0].options.method,undefined);
  assert.equal(h.element('merchant-layout').hidden,true);
  assert.equal(h.element('operator-login').hidden,false);
  assert.equal(h.stored.length,0);
});

test('explicit login sends entered key once, clears field, and never persists it', async()=>{
  const h=harness(); await drain();
  vm.runInContext('openStudio=async()=>{}',h.context);
  h.context.fetch=async(path,options)=>{h.requests.push({path,options});assert.equal(h.element('operator-token').value,'');return {ok:true,status:200,json:async()=>({authenticated:true})}};
  h.element('operator-token').value='fixture-access-key';
  await h.element('login-form').onsubmit({preventDefault(){}});
  const login=h.requests.at(-1);
  assert.equal(login.path,'/api/growth/session');
  assert.equal(login.options.credentials,'same-origin');
  assert.deepEqual(JSON.parse(login.options.body),{token:'fixture-access-key'});
  assert.equal(h.stored.length,0);
});

test('restored design reads status; explicit continuation advances the saved job',async()=>{
  const h=harness();await drain();h.requests.length=0;
  h.context.fetch=async(path,options={})=>{h.requests.push({path,options});return {ok:true,status:200,json:async()=>({designId:'saved-design',status:'running',stage:'pattern',mode:'live'})}};
  vm.runInContext("state.designId='saved-design';designAuthorized=false;updateStudio=()=>{}",h.context);
  await vm.runInContext('pollDesign(false)',h.context);
  assert.deepEqual(h.requests.map(r=>r.path),['/api/growth/designs/saved-design']);
  assert.equal(h.timers.length,0);
  await h.element('resume').onclick();
  assert.deepEqual(h.requests.slice(1).map(r=>[r.path,r.options.method]),[['/api/growth/designs/saved-design/advance','POST'],['/api/growth/designs/saved-design',undefined]]);
  assert.equal(h.timers.length,1);
});

test('saved operator personalization reads status without automatic provider work',async()=>{
  const h=harness();await drain();h.requests.length=0;
  h.context.fetch=async(path,options={})=>{h.requests.push({path,options});return {ok:true,status:200,json:async()=>({personalizationId:'saved-variant',status:'running',stage:'pattern',text:'Prague'})}};
  vm.runInContext("personalizationRecord={personalizationId:'saved-variant'};personalizationAuthorized=false;state.personalizationEnabled=true;updatePersonalizationControls=()=>{}",h.context);
  await vm.runInContext('readPersonalization(false)',h.context);
  assert.deepEqual(h.requests.map(r=>r.path),['/api/growth/personalizations/saved-variant']);
  assert.equal(h.timers.length,0);
  await h.element('personalize-resume').onclick();
  assert.deepEqual(h.requests.slice(1).map(r=>[r.path,r.options.method]),[['/api/growth/personalizations/saved-variant/advance','POST'],['/api/growth/personalizations/saved-variant',undefined]]);
  assert.equal(h.timers.length,1);
});

function widgetHarness() {
  const requests=[],intervals=new Map(),nodes=new Map(),storage=new Map();
  const element=id=>{
    if(!nodes.has(id))nodes.set(id,{value:'',src:'',hidden:false,disabled:false,isConnected:true,children:[],dataset:{},classList:{add(){},toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(){},append(){},replaceChildren(){}});
    return nodes.get(id);
  };
  const shadow={getElementById:element,querySelector:element,innerHTML:''};
  const host=element('host');host.attachShadow=()=>shadow;
  const context=vm.createContext({document:{currentScript:{dataset:{campaign:'main'}},getElementById:element,createElement:()=>host,hidden:false},window:{addEventListener(){},dispatchEvent(){}},location:{origin:'https://creator.example',search:''},sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},crypto:{randomUUID:()=> 'visitor-session'},URL,URLSearchParams,Intl,console,setTimeout:()=>0,clearTimeout(){},setInterval:(callback,ms)=>{intervals.set(ms,callback);return ms},clearInterval(){},fetch:async(path,options={})=>{requests.push({path,options});return {ok:false,status:503,json:async()=>({error:{message:'Fixture service unavailable'}})}}});
  const widgetSource=readFileSync(new URL('../public/rewards.js',import.meta.url),'utf8');
  // Expose private entry points while retaining the real lifecycle and request code.
  vm.runInContext(widgetSource.replace(/\}\)\(\);\s*$/,`globalThis.widgetTest={recoverPersonalization,updatePersonalControls,setState(record,authorized,metadata={}){config={creator:{id:'alex',name:'Alex'},customerPersonalizationEnabled:true,rewards:[{id:'original',name:'Original',imageSource:'arcade',imageUrl:'https://images.example/original.png'}],...metadata};creatorId='alex';rewardId='original';personalization='Prague';personalRecord=record;personalAuthorized=authorized}};})();`),context);
  const input={campaignId:'main',creatorId:'alex',sessionId:'visitor-session',sourceDesignId:'original',text:'Prague',requestId:'saved-request'};
  const result={personalizationId:'saved-variant',sourceDesignId:'original',text:'Prague',status:'running',stage:'pattern'};
  return {context,requests,intervals,input,result,element};
}

test('customer generation polling advances with the exact visitor ownership body',async()=>{
  const h=widgetHarness();await drain();h.requests.length=0;
  h.context.fetch=async(path,options={})=>{h.requests.push({path,options});return {ok:true,status:200,json:async()=>h.result}};
  h.context.widgetTest.setState({id:'saved-variant',input:h.input,state:h.result,startedAt:Date.now()},true);
  await h.intervals.get(2500)();
  assert.equal(h.requests[0].path,'https://creator.example/api/growth/customer-personalizations/saved-variant/advance');
  assert.equal(h.requests[0].options.method,'POST');
  assert.deepEqual(JSON.parse(h.requests[0].options.body),{sessionId:'visitor-session'});
  assert.equal(h.requests[1].options.method,undefined);
});

test('customer explicit continuation preserves the exact advance ownership body',async()=>{
  const h=widgetHarness();await drain();h.requests.length=0;
  h.context.fetch=async(path,options={})=>{h.requests.push({path,options});return {ok:true,status:200,json:async()=>h.result}};
  h.context.widgetTest.setState({id:'saved-variant',input:h.input,state:{...h.result,status:'awaiting_product'},startedAt:Date.now()},false);
  await h.context.widgetTest.recoverPersonalization();
  assert.equal(h.requests[0].path,'https://creator.example/api/growth/customer-personalizations/saved-variant/advance');
  assert.deepEqual(JSON.parse(h.requests[0].options.body),{sessionId:'visitor-session'});
});

test('customer create recovery keeps the complete original generation input',async()=>{
  const h=widgetHarness();await drain();h.requests.length=0;
  h.context.fetch=async(path,options={})=>{h.requests.push({path,options});return {ok:true,status:200,json:async()=>h.result}};
  h.context.widgetTest.setState({id:null,input:h.input,state:null,startedAt:Date.now()},false);
  await h.context.widgetTest.recoverPersonalization();
  assert.equal(h.requests[0].path,'https://creator.example/api/growth/customer-personalizations');
  assert.deepEqual(JSON.parse(h.requests[0].options.body),h.input);
});


test('widget shows shared personalization usage and disables new generation at zero remaining',async()=>{
  const h=widgetHarness();await drain();
  h.context.widgetTest.setState(null,false,{remainingPersonalizations:16,maxPersonalizations:20,activeGeneration:false});
  h.context.widgetTest.updatePersonalControls();
  assert.match(h.element('personal-budget').textContent,/16 of 20 remaining/);
  assert.match(h.element('personal-budget').textContent,/4 requests already reserved or used, including seeded requests/);
  assert.match(h.element('personal-budget').textContent,/Shared by all visitors and the studio/);
  assert.equal(h.element('generate').disabled,false);
  h.context.widgetTest.setState(null,false,{remainingPersonalizations:0,maxPersonalizations:20,activeGeneration:true});
  h.context.widgetTest.updatePersonalControls();
  assert.match(h.element('personal-budget').textContent,/0 of 20 remaining/);
  assert.match(h.element('personal-budget').textContent,/An Arcade generation is currently active/);
  assert.equal(h.element('generate').disabled,true);
});


test('customer final reserved slot still allows explicit continuation and stable create recovery',async()=>{
  const h=widgetHarness();await drain();h.requests.length=0;
  h.context.fetch=async(path,options={})=>{h.requests.push({path,options});return {ok:true,status:200,json:async()=>h.result}};
  const metadata={remainingPersonalizations:0,maxPersonalizations:20,customerPersonalizationEnabled:true};
  h.context.widgetTest.setState({id:'saved-variant',input:h.input,state:{...h.result,status:'awaiting_product'},startedAt:Date.now()},false,metadata);
  h.context.widgetTest.updatePersonalControls();
  assert.equal(h.element('generate').disabled,true);
  assert.equal(h.element('recover').disabled,false);
  assert.equal(h.element('recover').hidden,false);
  await h.context.widgetTest.recoverPersonalization();
  assert.equal(h.requests[0].path,'https://creator.example/api/growth/customer-personalizations/saved-variant/advance');
  assert.deepEqual(JSON.parse(h.requests[0].options.body),{sessionId:'visitor-session'});
  h.requests.length=0;
  h.context.widgetTest.setState({id:null,input:h.input,state:null,startedAt:Date.now()},false,metadata);
  h.context.widgetTest.updatePersonalControls();
  assert.equal(h.element('recover').disabled,false);
  await h.context.widgetTest.recoverPersonalization();
  assert.equal(h.requests[0].path,'https://creator.example/api/growth/customer-personalizations');
  assert.deepEqual(JSON.parse(h.requests[0].options.body),h.input);
});

test('studio final reserved slot blocks fresh personalization but allows stable replay and continuation',async()=>{
  const h=harness();await drain();h.requests.length=0;
  h.context.fetch=async(path,options={})=>{h.requests.push({path,options});return {ok:true,status:200,json:async()=>({personalizationId:'saved-variant',status:'running',stage:'pattern',text:'Prague'})}};
  h.element('personal-text').value='Prague';
  vm.runInContext("state.catalog={remainingPersonalizations:0};state.personalizationEnabled=true;state.rewards=[{id:'original',imageSource:'arcade'}];state.rewardId='original';updatePersonalizationControls()",h.context);
  assert.equal(h.element('personalize-generate').disabled,true);
  vm.runInContext("personalizationRecord={requestId:'saved-request',sourceDesignId:'original',text:'Prague'};updatePersonalizationControls()",h.context);
  assert.equal(h.element('personalize-generate').disabled,false);
  vm.runInContext("personalizationRecord.personalizationId='saved-variant';personalizationJob={status:'awaiting_product'};updatePersonalizationControls()",h.context);
  assert.equal(h.element('personalize-resume').disabled,false);
  assert.equal(h.element('personalize-resume').hidden,false);
  await h.element('personalize-resume').onclick();
  assert.deepEqual(h.requests.map(r=>[r.path,r.options.method]),[['/api/growth/personalizations/saved-variant/advance','POST'],['/api/growth/personalizations/saved-variant',undefined]]);
});
