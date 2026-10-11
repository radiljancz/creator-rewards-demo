import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const code=readFileSync(new URL('../../prototype/rewards.js',import.meta.url),'utf8');
const baseReward={id:'base',name:'Creator pillow',imageSource:'arcade',imageUrl:'https://images.example/base.png'};
const config={id:'main',currency:'USD',creator:{id:'alex',name:'Alex'},rewards:[baseReward,{id:'coastal-pillow',name:'Concept',imageSource:'illustrative',imageUrl:'https://images.example/concept.svg'}],rewardCost:14000};
const result=(status='succeeded')=>({personalizationId:'personal-1',sourceDesignId:'base',text:'Yosemite 2027',status,stage:'product',product:status==='succeeded'?{imageUrl:'https://images.example/personal.png',imageSource:'arcade',providerProductId:'arcade-personal-1',providerUnitPrice:{amount:'40.56',currency:'USD'},personalizationText:'Yosemite 2027'}:null});
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function fixture({storage=new Map(),create=()=>result(),read=()=>result(),history=()=>({items:[]}),manualImages=false,enabled=true,bridge=false,storefront=false,pageType='product',cartRead=()=>({currency:'USD',total_discount:0,total_price:0,items:[]}),quoteRead=()=>({eligible:true,fanCopay:6000,merchantSubsidy:8000,productCost:14000}),now=()=>Date.now(),publicRead=()=>({...config,customerPersonalizationEnabled:enabled})}={}){
 const nodes=new Map(),calls=[],intervals=[];
 class Element{
  constructor(){this.hidden=false;this.disabled=false;this.value='';this.textContent='';this.style={};this.dataset={};this.listeners={};this.classList={add(){},toggle(){}};this.attrs={};this.isConnected=true;this.complete=true;this.naturalWidth=1024;}
  addEventListener(name,fn){this.listeners[name]=fn;}
  async emit(name){await this.listeners[name]?.();await flush();}
  set src(value){this._src=value;this.complete=false;this.naturalWidth=0;if(!manualImages||this!==nodes.get('image'))queueMicrotask(()=>{this.complete=true;this.naturalWidth=1024;this.onload?.();});}get src(){return this._src;}
  removeAttribute(name){if(name==='src')this._src='';}
  replaceChildren(...children){this.children=children;}
  append(...children){this.children=[...(this.children||[]),...children];}
  prepend(child){child.parentNode?.removeChild(child);this.children=[child,...(this.children||[])];child.parentNode=this;}
  removeChild(child){this.children=(this.children||[]).filter(item=>item!==child);child.parentNode=null;}
  before(child){const parent=this.parentNode;if(!parent)return;child.parentNode?.removeChild(child);parent.children.splice(parent.children.indexOf(this),0,child);child.parentNode=parent;}
  get nextElementSibling(){return this.parentNode?.children[this.parentNode.children.indexOf(this)+1]||null;}
  scrollIntoView(){this.scrolled=true;}
  closest(){return this.parentNode;}
  setAttribute(name,value){this.attrs[name]=value;}
  focus(){this.focused=true;}
  attachShadow(){return shadow;}
 }
 const card=new Element(),launcher=new Element(),close=new Element();
 const shadow={set innerHTML(value){for(const match of value.matchAll(/id="([^"]+)"/g))nodes.set(match[1],new Element());},getElementById:id=>nodes.get(id),querySelector:s=>s==='.card'?card:s==='.launcher'?launcher:close};
 const listeners=new Map();const window={Shopify:{routes:{root:'/'}},addEventListener:(type,fn,opts)=>{listeners.set(type,[...(listeners.get(type)||[]),{fn,once:opts?.once}]);},dispatchEvent:e=>{for(const l of [...(listeners.get(e.type)||[])]){if(l.once)listeners.set(e.type,listeners.get(e.type).filter(item=>item!==l));l.fn(e);}}};
 const bridgeConfig=new Element();bridgeConfig.textContent=JSON.stringify({backendOrigin:'https://api.example',mapping:{variants:{'1':'weekend','2':'adventure'}},...(storefront?{storefront:{pageType,productVariantId:'1',cartUrl:'/cart',weekendUrl:'/products/weekend',adventureUrl:'/products/adventure'}}:{})});const bridgeStatus=new Element();
 const rootNodes=new Map();const main=new Element(),footer=new Element(),productContainer=new Element(),productForm=new Element(),cartForm=new Element(),formInput=new Element();formInput.value='1';productForm.parentNode=productContainer;productContainer.children=[productForm];cartForm.parentNode=main;main.children=[cartForm];rootNodes.set('MainContent',main);
 if(storefront){for(const id of ['creator-rewards-storefront','creator-rewards-welcome','creator-rewards-headline','creator-rewards-hero-image','creator-rewards-contribution','creator-rewards-contribution-copy','creator-rewards-offer-status','creator-rewards-start','creator-rewards-retry','creator-rewards-editor','creator-rewards-editor-title','creator-rewards-close-editor','creator-rewards-slot','creator-rewards-purchase','creator-rewards-purchase-image','creator-rewards-purchase-price','creator-rewards-purchase-copy','creator-rewards-purchase-start','creator-rewards-cart','creator-rewards-cart-title','creator-rewards-cart-image','creator-rewards-cart-price','creator-rewards-cart-copy','creator-rewards-cart-status','creator-rewards-cart-start','creator-rewards-to-cart','creator-rewards-weekend','creator-rewards-adventure'])rootNodes.set(id,new Element());for(const id of ['creator-rewards-storefront','creator-rewards-purchase','creator-rewards-cart']){const node=rootNodes.get(id);node.parentNode=footer;footer.children=[...(footer.children||[]),node];node.hidden=true;}rootNodes.get('creator-rewards-editor').hidden=true;}
 const sandbox={window,document:{currentScript:{src:'https://shop.example/rewards.js',dataset:{apiOrigin:'https://api.example',campaign:'main',...(storefront?{storefront:'true'}:{})}},createElement:()=>new Element(),getElementById:id=>bridge&&id==='creator-rewards-shopify-config'?bridgeConfig:bridge&&id==='creator-rewards-shopify-status'?bridgeStatus:rootNodes.get(id)||null,querySelector:selector=>selector.includes('add-to-cart-form')?(selector.includes('input')?formInput:productForm):selector==='#cart'?cartForm:selector.includes('MainProduct')?productContainer:null,addEventListener(){},body:{append(){}},hidden:false},location:{href:'https://shop.example/?creator=alex',search:'?creator=alex'},sessionStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},crypto:webcrypto,URL,URLSearchParams,Intl,AbortSignal,CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts.detail;}},queueMicrotask,setTimeout:()=>1,clearTimeout(){},setInterval:(fn,delay)=>{intervals.push({fn,delay});return intervals.length;},clearInterval(){},fetch:async(url,options)=>{
  const data=options.body?JSON.parse(options.body):null;const path=new URL(url,'https://shop.example').pathname;calls.push({path,data,storage:[...storage.values()]});
  let body;if(path==='/cart.js')body=await cartRead();else if(path.endsWith('/public'))body=await publicRead();else if(path.endsWith('/quote'))body=await quoteRead(data);else if(path.endsWith('/events'))body={};else if(path.endsWith('/customer-personalizations'))body=data?await create(data):await history();else if(path.includes('/customer-personalizations/'))body=await read(path,data);else throw Error('Unexpected path '+path);
  if(body?.httpError){const {status,code,message}=body.httpError;return {ok:false,status,json:async()=>({error:{code,message}})};}return {ok:true,status:200,json:async()=>body};
 }};
 sandbox.Date=class extends Date{static now(){return now();}};
 vm.createContext(sandbox);vm.runInContext(code,sandbox);
 if(bridge)vm.runInContext(readFileSync(new URL('./creator-rewards-shopify.js',import.meta.url),'utf8').replaceAll('export ',''),sandbox);
 return {nodes,rootNodes,main,productContainer,cartForm,calls,storage,intervals,window,async loadImage(){const i=nodes.get('image');i.complete=true;i.naturalWidth=1024;await i.onload?.();await flush();},async ready(){await window.CreatorRewards.ready;if(!(storefront&&bridge))await window.CreatorRewards.setBasket([{productId:'weekend',quantity:1}]);await flush();if(storefront&&bridge&&window.CreatorRewardsShopify)await window.CreatorRewardsShopify.refresh();await flush();},async text(value){nodes.get('personal').value=value;await nodes.get('personal').emit('input');},async generate(){assert.ok(nodes.get('generate'),'explicit Arcade generation action must exist');await nodes.get('generate').emit('click');}};
}
const generations=f=>f.calls.filter(c=>c.path.endsWith('/customer-personalizations')&&c.data);

test('text entry never generates or paints a fake text layer',async()=>{
 const f=fixture();await f.ready();await f.text('Yosemite 2027');assert.equal(generations(f).length,0);assert.equal(f.nodes.has('overlay'),false);
});
test('explicit generation persists its request before POST and displays the provider product',async()=>{
 const f=fixture();await f.ready();await f.text('Yosemite 2027');await f.generate();const call=generations(f)[0];assert.equal(call.data.text,'Yosemite 2027');assert.equal(call.data.sourceDesignId,'base');assert.ok(call.storage.some(s=>s.includes(call.data.requestId)&&s.includes('Yosemite 2027')));assert.equal(f.nodes.get('image').src,'https://images.example/personal.png');assert.match(f.nodes.get('provenance').textContent,/Arcade/);await f.window.CreatorRewards.simulate();assert.equal(f.calls.filter(c=>c.data?.type==='checkout_simulated')[0].data.personalizationId,'personal-1');
});
test('reload restores an owned result with GET and never creates another generation',async()=>{
 const storage=new Map();const first=fixture({storage});await first.ready();await first.text('Yosemite 2027');await first.generate();const second=fixture({storage});await second.ready();assert.equal(generations(second).length,0);assert.ok(second.calls.some(c=>c.path.endsWith('/customer-personalizations/personal-1')&&!c.data));assert.equal(second.nodes.get('image').src,'https://images.example/personal.png');
});
test('editing the text clears the old generated image and blocks simulation',async()=>{
 const f=fixture();await f.ready();await f.text('Yosemite 2027');await f.generate();await f.text('Praha 2028');assert.equal(f.nodes.get('image').src,baseReward.imageUrl);assert.equal(f.nodes.get('simulate').disabled,true);await f.window.CreatorRewards.simulate();assert.equal(f.calls.some(c=>c.data?.type==='checkout_simulated'),false);
});
test('unknown provider state blocks additional starts instead of inventing another request',async()=>{
 const f=fixture({create:()=>result('unknown')});await f.ready();await f.text('Yosemite 2027');await f.generate();await f.generate();assert.equal(generations(f).length,1);assert.equal(f.nodes.get('simulate').disabled,true);assert.match(f.nodes.get('personal-status').textContent,/not be confirmed.*operator/i);
});
test('ambiguous POST recovery uses the same saved request and exact text',async()=>{
 let count=0;const f=fixture({create:()=>{if(++count===1)throw Error('Network interrupted');return result();}});await f.ready();await f.text('Yosemite 2027');await f.generate();const first=generations(f)[0].data;assert.ok(f.nodes.get('recover'),'explicit recovery action');await f.nodes.get('recover').emit('click');assert.deepEqual(generations(f)[1].data,first);assert.equal(f.nodes.get('image').src,'https://images.example/personal.png');
});
test('a known running job is read without automatic resume and accepts its final result',async()=>{
 const f=fixture({create:()=>result('running')});await f.ready();await f.text('Yosemite 2027');await f.generate();assert.equal(f.nodes.get('simulate').disabled,true);const poll=f.intervals.find(i=>i.delay===2500);assert.ok(poll,'read-only job poll exists');await poll.fn();await flush();assert.equal(generations(f).length,1);assert.equal(f.calls.some(c=>c.path.endsWith('/resume')),false);assert.equal(f.nodes.get('image').src,'https://images.example/personal.png');
});
test('awaiting product only resumes on an explicit user action',async()=>{
 const f=fixture({create:()=>result('awaiting_product')});await f.ready();await f.text('Yosemite 2027');await f.generate();assert.equal(f.calls.some(c=>c.path.endsWith('/resume')),false);await f.nodes.get('recover').emit('click');const call=f.calls.find(c=>c.path.endsWith('/resume'));assert.equal(call.data.sessionId,generations(f)[0].data.sessionId);assert.equal(f.nodes.get('image').src,'https://images.example/personal.png');
});
test('a failed status read after reload can be explicitly checked without a POST',async()=>{
 const storage=new Map();const first=fixture({storage});await first.ready();await first.text('Yosemite 2027');await first.generate();let attempts=0;const second=fixture({storage,read:()=>{if(++attempts===1)throw Error('Offline');return result();}});await second.ready();assert.equal(second.nodes.get('recover').hidden,false);await second.nodes.get('recover').emit('click');assert.equal(generations(second).length,0);assert.equal(second.nodes.get('image').src,'https://images.example/personal.png');
});
test('changing source displays its original and cannot simulate the other source result',async()=>{
 const f=fixture();await f.ready();await f.text('Yosemite 2027');await f.generate();f.nodes.get('reward').value='coastal-pillow';await f.nodes.get('reward').emit('change');assert.equal(f.nodes.get('image').src,'https://images.example/concept.svg');assert.equal(f.nodes.get('simulate').disabled,true);assert.equal(f.nodes.get('generate').disabled,true);
});
test('provider admission error remains visible with the saved recovery action',async()=>{
 const f=fixture({create:()=>{throw Error('Resolve the existing personalization first');}});await f.ready();await f.text('Yosemite 2027');await f.generate();assert.match(f.nodes.get('personal-status').textContent,/Resolve the existing personalization first/);assert.equal(f.nodes.get('recover').hidden,false);
});

test('missing or disabled server capability prevents provider starts',async()=>{
 for(const enabled of [false,undefined]){const f=fixture({enabled:enabled===undefined?null:enabled});await f.ready();await f.text('Yosemite 2027');assert.equal(f.nodes.get('generate').disabled,true);await f.generate();assert.equal(generations(f).length,0);}
});

test('thumbnail buttons select a source and clear an unrelated generated result',async()=>{
 const f=fixture();await f.ready();await f.text('Yosemite 2027');await f.generate();const chooser=f.nodes.get('designs');assert.ok(chooser,'visible thumbnail chooser');const cards=chooser.children;assert.equal(cards.length,2);assert.equal(cards[0].attrs.role,'radio');assert.equal(cards[0].attrs['aria-checked'],'true');await cards[1].emit('click');assert.equal(f.nodes.get('reward').value,'coastal-pillow');assert.equal(f.nodes.get('image').src,'https://images.example/concept.svg');assert.equal(f.nodes.get('simulate').disabled,true);assert.equal(cards[1].attrs['aria-checked'],'true');
});
test('arrow keys move the thumbnail selection without starting another generation',async()=>{
 const f=fixture();await f.ready();const chooser=f.nodes.get('designs');assert.ok(chooser,'visible thumbnail chooser');await chooser.children[0].listeners.keydown({key:'ArrowRight',preventDefault(){}});await flush();assert.equal(f.nodes.get('reward').value,'coastal-pillow');assert.equal(generations(f).length,0);
});

test('initial configuration outage has an explicit read-only retry',async()=>{
 let reads=0;const f=fixture({publicRead:()=>{if(++reads===1)throw Error('Gateway unavailable');return {...config,customerPersonalizationEnabled:true};}});await f.ready();const retry=f.nodes.get('retry-load');assert.ok(retry,'connection retry action');assert.equal(retry.hidden,false);await retry.emit('click');assert.equal(retry.hidden,true);assert.equal(f.nodes.get('image').src,baseReward.imageUrl);assert.equal(generations(f).length,0);
});

test('Shopify cart bridge mounts after initial outage retry without reloading',async()=>{
 let reads=0;const f=fixture({bridge:true,publicRead:()=>{if(++reads===1)throw Error('Gateway unavailable');return {...config,products:[],customerPersonalizationEnabled:true};}});await f.ready();assert.equal(f.window.CreatorRewardsShopify,undefined);await f.nodes.get('retry-load').emit('click');assert.ok(f.window.CreatorRewardsShopify,'cart sync must recover with the widget');assert.ok(f.calls.some(c=>c.path==='/cart.js'),'real cart read resumes');assert.equal(generations(f).length,0);
});

test('authoritative invalid input clears only a rejected unsent draft for correction',async()=>{
 for(const code of ['invalid_text','invalid_source','invalid_input']){let count=0;const f=fixture({create:()=>++count===1?{httpError:{status:400,code,message:'Please correct the input'}}:result()});await f.ready();await f.text('Yosemite 2027');await f.generate();assert.equal(f.nodes.get('recover').hidden,true);assert.equal(f.nodes.get('generate').disabled,false);assert.match(f.nodes.get('personal-status').textContent,/correct/);await f.generate();assert.equal(f.nodes.get('image').src,'https://images.example/personal.png');assert.notEqual(generations(f)[0].data.requestId,generations(f)[1].data.requestId);}
});
test('busy admission preserves its exact saved request and displays the actual reason',async()=>{
 const f=fixture({create:()=>({httpError:{status:409,code:'personalization_busy',message:'Wait for the current generation'}})});await f.ready();await f.text('Yosemite 2027');await f.generate();assert.match(f.nodes.get('personal-status').textContent,/Wait for the current/);await f.nodes.get('recover').emit('click');assert.deepEqual(generations(f)[0].data,generations(f)[1].data);
});

test('active generation reports its stage and elapsed time across reload without another POST',async()=>{
 let time=100000;const storage=new Map();let stage='refine';const active=()=>({...result('running'),stage});
 const first=fixture({storage,now:()=>time,create:active,read:active});await first.ready();await first.text('Yosemite 2027');await first.generate();
 assert.match(first.nodes.get('personal-status').textContent,/pattern.*Elapsed: 0:00/);
 time+=185000;stage='product';await first.intervals.find(i=>i.delay===2500).fn();
 assert.match(first.nodes.get('personal-status').textContent,/rendering your product preview.*several minutes.*Elapsed: 3:05/);
 const restored=fixture({storage,now:()=>time,read:active});await restored.ready();assert.match(restored.nodes.get('personal-status').textContent,/Elapsed: 3:05/);assert.equal(generations(restored).length,0);
});
test('an active saved job exposes an explicit status check that performs only GET',async()=>{
 const f=fixture({create:()=>result('starting')});await f.ready();await f.text('Yosemite 2027');await f.generate();assert.equal(f.nodes.get('recover').hidden,false);assert.equal(f.nodes.get('recover').textContent,'Check progress');await f.nodes.get('recover').emit('click');assert.equal(generations(f).length,1);assert.equal(f.calls.some(c=>c.path.endsWith('/resume')),false);assert.equal(f.nodes.get('image').src,'https://images.example/personal.png');
});
test('the image itself shows generation progress and switches to the completed derivative',async()=>{
 let stage='refine';let done=false;const state=()=>({...result(done?'succeeded':'running'),stage});const f=fixture({create:state,read:state});await f.ready();await f.text('Yosemite 2027');await f.generate();
 const progress=f.nodes.get('generation-status');assert.ok(progress,'progress must be visible at the image');assert.equal(progress.hidden,false);assert.match(progress.textContent,/Creating.*Yosemite 2027.*pattern/);assert.equal(f.nodes.get('preview').attrs['aria-busy'],'true');
 stage='product';await f.intervals.find(i=>i.delay===2500).fn();assert.match(progress.textContent,/Rendering.*product preview/);
 done=true;await f.intervals.find(i=>i.delay===2500).fn();await flush();assert.equal(progress.hidden,true);assert.equal(f.nodes.get('preview').attrs['aria-busy'],'false');assert.equal(f.nodes.get('image').src,'https://images.example/personal.png');assert.equal(f.nodes.get('designs').children[0].children[0].src,'https://images.example/personal.png');assert.match(f.nodes.get('designs').children[0].children[1].textContent,/Yosemite 2027/);
});
test('admission denial stays visibly not started after reload and retries only the same input',async()=>{
 const storage=new Map();const denied=()=>({httpError:{status:429,code:'customer_personalization_limit',message:'Your personalization attempt limit has been reached.'}});const first=fixture({storage,create:denied});await first.ready();await first.text('Yosemite 2027');await first.generate();assert.match(first.nodes.get('personal-status').textContent,/Generation did not start.*limit/);assert.equal(first.nodes.get('generation-status').hidden,true);assert.equal(first.nodes.get('recover').textContent,'Try generating again');
 const second=fixture({storage});await second.ready();assert.match(second.nodes.get('personal-status').textContent,/Generation did not start.*limit/);assert.equal(generations(second).length,0);await second.nodes.get('recover').emit('click');assert.deepEqual(generations(second)[0].data,generations(first)[0].data);assert.equal(second.nodes.get('image').src,'https://images.example/personal.png');
});

test('generation stays visibly busy until the final image actually loads',async()=>{
 const f=fixture({manualImages:true,create:()=>result('running')});await f.ready();await f.loadImage();await f.text('Yosemite 2027');await f.generate();await f.intervals.find(i=>i.delay===2500).fn();
 assert.equal(f.nodes.get('image').src,'https://images.example/personal.png');assert.equal(f.nodes.get('generation-status').hidden,false);assert.match(f.nodes.get('generation-status').textContent,/Loading.*final/);assert.equal(f.nodes.get('simulate').disabled,true);await f.loadImage();assert.equal(f.nodes.get('generation-status').hidden,true);assert.equal(f.nodes.get('image').hidden,false);assert.equal(f.nodes.get('simulate').disabled,false);
});
test('a new rejected attempt preserves an owned completed design and can show it again',async()=>{
 let attempt=0;const f=fixture({create:()=>++attempt===1?result():({httpError:{status:429,code:'personalization_limit',message:'Demo budget reached'}})});await f.ready();await f.text('Yosemite 2027');await f.generate();await f.text('Praha');await f.generate();
 const list=f.nodes.get('personal-history');assert.ok(list,'completed designs need a durable chooser');assert.equal(list.children.length,1);await list.children[0].emit('click');assert.equal(f.nodes.get('personal').value,'Yosemite 2027');assert.equal(f.nodes.get('image').src,'https://images.example/personal.png');assert.equal(generations(f).length,2);await f.window.CreatorRewards.simulate();assert.equal(f.calls.find(c=>c.data?.type==='checkout_simulated').data.personalizationId,'personal-1');
 await f.nodes.get('view-current').emit('click');assert.equal(f.nodes.get('personal').value,'Praha');assert.match(f.nodes.get('personal-status').textContent,/did not start/);
});
test('owned history restores earlier designs lost from the latest local record with GET only',async()=>{
 const storage=new Map();const first=fixture({storage,create:()=>({httpError:{status:429,code:'personalization_limit',message:'Demo budget reached'}})});await first.ready();await first.text('Praha');await first.generate();
 const second=fixture({storage,history:()=>({items:[result()]})});await second.ready();assert.equal(second.nodes.get('personal-history')?.children.length,1);await second.nodes.get('personal-history').children[0].emit('click');assert.equal(second.nodes.get('image').src,'https://images.example/personal.png');assert.equal(generations(second).length,0);assert.ok(second.calls.some(c=>c.path.endsWith('/customer-personalizations/personal-1')&&!c.data));
});
test('pending reload and source or config changes retain a visible current request',async()=>{
 const storage=new Map();const first=fixture({storage,create:()=>result('running')});await first.ready();await first.text('Yosemite 2027');await first.generate();let done=false,updated=false;const second=fixture({storage,read:()=>result(done?'succeeded':'running'),publicRead:()=>({...config,customerPersonalizationEnabled:true,rewards:updated?[...config.rewards,{...baseReward,id:'another'}]:config.rewards})});await second.ready();
 second.nodes.get('reward').value='coastal-pillow';await second.nodes.get('reward').emit('change');updated=true;await second.intervals.find(i=>i.delay===3000).fn();assert.match(second.nodes.get('request-progress')?.textContent||'',/Yosemite 2027/);assert.equal(second.nodes.get('request-progress').hidden,false);await second.nodes.get('view-current').emit('click');done=true;await second.intervals.find(i=>i.delay===2500).fn();await flush();assert.equal(second.nodes.get('image').src,'https://images.example/personal.png');assert.equal(generations(second).length,0);
});
test('an older history response cannot replace a newly submitted current request',async()=>{
 let release;let creates=0;let slow=false;const old=result();const pending={...result('running'),personalizationId:'personal-2',text:'Praha'};const f=fixture({create:()=>++creates===1?old:pending,read:()=>slow?new Promise(r=>{release=r;}):old});await f.ready();await f.text('Yosemite 2027');await f.generate();slow=true;const selection=f.nodes.get('personal-history')?.children[0]?.emit('click');await flush();await f.text('Praha');await f.generate();release?.(old);await selection;await flush();assert.match(f.nodes.get('request-progress')?.textContent||'',/Praha/);assert.equal(f.nodes.get('generation-status').hidden,false);assert.equal(f.nodes.get('image').src,baseReward.imageUrl);assert.equal(generations(f).length,2);
});
test('viewing an earlier design keeps the new pending request visible and recoverable',async()=>{
 const old=result();const pending={...result('running'),personalizationId:'personal-2',text:'Praha'};let attempts=0,done=false;const f=fixture({create:()=>++attempts===1?old:pending,read:path=>path.includes('personal-1')?old:{...pending,status:done?'succeeded':'running',product:done?{...old.product,imageUrl:'https://images.example/praha.png'}:null}});await f.ready();await f.text('Yosemite 2027');await f.generate();await f.text('Praha');await f.generate();await f.nodes.get('personal-history').children[0].emit('click');assert.match(f.nodes.get('request-progress').textContent,/Praha/);assert.equal(f.nodes.get('image').src,old.product.imageUrl);assert.equal(f.nodes.get('generation-status').hidden,true);await f.nodes.get('view-current').emit('click');assert.equal(f.nodes.get('personal').value,'Praha');assert.equal(f.nodes.get('generation-status').hidden,false);done=true;await f.intervals.find(i=>i.delay===2500).fn();await flush();assert.equal(f.nodes.get('image').src,'https://images.example/praha.png');assert.equal(f.nodes.get('personal-history').children.length,2);assert.equal(generations(f).length,2);
});
test('a poll response for a different personalization cannot replace the current preview',async()=>{
 const f=fixture({create:()=>result('running'),read:()=>({...result(),personalizationId:'someone-else'})});await f.ready();await f.text('Yosemite 2027');await f.generate();await f.intervals.find(i=>i.delay===2500).fn();assert.equal(f.nodes.get('image').src,baseReward.imageUrl);assert.equal(f.nodes.get('generation-status').hidden,false);assert.match(f.nodes.get('personal-status').textContent,/different request/);assert.equal(f.nodes.get('personal-history').children.length,0);
});
test('rapid history clicks keep the most recent selection despite a late older response',async()=>{
 const a=result(),b={...result(),personalizationId:'personal-b',text:'Praha',product:{...result().product,imageUrl:'https://images.example/praha.png'}};let release;const f=fixture({history:()=>({items:[a,b]}),read:path=>path.includes('personal-1')?new Promise(r=>{release=r;}):b});await f.ready();const buttons=f.nodes.get('personal-history').children;const first=buttons[0].emit('click');await flush();await buttons[1].emit('click');release(a);await first;await flush();assert.equal(f.nodes.get('personal').value,'Praha');assert.equal(f.nodes.get('image').src,b.product.imageUrl);assert.equal(generations(f).length,0);
});
test('owned history recovers a pending job even if its local current record was lost',async()=>{
 const f=fixture({history:()=>({items:[result('running')]}),read:()=>result('running')});await f.ready();assert.match(f.nodes.get('request-progress').textContent,/Yosemite 2027/);assert.equal(f.nodes.get('generation-status').hidden,false);assert.equal(f.nodes.get('generate').disabled,true);assert.equal(generations(f).length,0);
});
test('a saved personalized design stays viewable after its creator source is archived',async()=>{
 const f=fixture({history:()=>({items:[result()]}),publicRead:()=>({...config,rewards:[config.rewards[1]],customerPersonalizationEnabled:true})});await f.ready();assert.equal(f.nodes.get('personal-history').children.length,1);await f.nodes.get('personal-history').children[0].emit('click');assert.equal(f.nodes.get('image').src,result().product.imageUrl);assert.equal(f.nodes.get('simulate').disabled,true);assert.equal(f.nodes.get('generate').disabled,true);
});
test('reload keeps an explicitly selected completed history design without losing the current draft',async()=>{
 const storage=new Map();const first=fixture({storage,create:()=>({httpError:{status:429,code:'personalization_limit',message:'Limit'}}),history:()=>({items:[result()]})});await first.ready();await first.text('Praha');await first.generate();await first.nodes.get('personal-history').children[0].emit('click');
 const second=fixture({storage,history:()=>({items:[result()]})});await second.ready();assert.equal(second.nodes.get('personal').value,'Yosemite 2027');assert.equal(second.nodes.get('image').src,result().product.imageUrl);assert.equal(generations(second).length,0);await second.nodes.get('view-current').emit('click');assert.equal(second.nodes.get('personal').value,'Praha');assert.match(second.nodes.get('request-progress').textContent,/did not start/);
});
test('a late history snapshot cannot turn an already confirmed completed design back into running',async()=>{
 const storage=new Map();const first=fixture({storage,create:()=>result('running')});await first.ready();await first.text('Yosemite 2027');await first.generate();let release;const second=fixture({storage,history:()=>new Promise(r=>{release=r;})});await flush();assert.ok(release,'history fetch must be delayed after owned result confirmation');release({items:[result('running')]});await second.ready();assert.equal(second.nodes.get('personal-history').children.length,1);await second.nodes.get('personal-history').children[0].emit('click');assert.equal(second.nodes.get('image').src,result().product.imageUrl);assert.equal(generations(second).length,0);
});
test('storefront exposes only customer preview data and clears contribution with an empty basket',async()=>{
 const f=fixture({storefront:true});await f.ready();assert.equal(typeof f.window.CreatorRewards.getView,'function','storefront needs a public UI snapshot');assert.equal(f.window.CreatorRewards.getView().fanCopay,6000);assert.equal(f.nodes.get('cost-row')?.hidden,true);await f.window.CreatorRewards.setBasket([]);assert.equal(f.window.CreatorRewards.getView().fanCopay,null);assert.equal(f.window.CreatorRewards.getView().eligible,false);assert.equal('productCost' in f.window.CreatorRewards.getView(),false);
});
test('an explicit design choice and decline are reflected in the storefront without provider starts',async()=>{
 const f=fixture({storefront:true});await f.ready();assert.equal(typeof f.window.CreatorRewards.getView,'function');assert.equal(f.window.CreatorRewards.getView().selected,false);await f.nodes.get('choose').emit('click');assert.equal(f.window.CreatorRewards.getView().selected,true);await f.nodes.get('decline').emit('click');assert.equal(f.window.CreatorRewards.getView().declined,true);assert.equal(f.window.CreatorRewards.getView().selected,false);assert.equal(generations(f).length,0);
});
test('storefront preview keeps the viewed history design separate from the latest pending draft',async()=>{
 const f=fixture({storefront:true,history:()=>({items:[result()]})});await f.ready();await f.text('Praha');await f.nodes.get('personal-history').children[0].emit('click');assert.equal(typeof f.window.CreatorRewards.getView,'function');assert.equal(f.window.CreatorRewards.getView().imageUrl,result().product.imageUrl);assert.equal(f.window.CreatorRewards.getView().personalizationText,'Yosemite 2027');assert.equal(generations(f).length,0);
});
const storefrontConfig=()=>({...config,customerPersonalizationEnabled:true,products:[{id:'weekend',price:99900},{id:'adventure',price:129900}]});
const shopCart=(variant=1)=>({currency:'USD',total_discount:0,total_price:variant===1?99900:129900,items:[{variant_id:variant,product_id:10,quantity:1,final_line_price:variant===1?99900:129900}]});
test('creator arrival is inline and opens the editor only after an explicit action',async()=>{
 const f=fixture({storefront:true,bridge:true,publicRead:storefrontConfig,cartRead:()=>shopCart()});await f.ready();const ui=f.rootNodes;assert.equal(ui.get('creator-rewards-storefront').parentNode,f.main,'arrival must be inside the page');assert.equal(ui.get('creator-rewards-storefront').hidden,false);assert.match(ui.get('creator-rewards-welcome').textContent,/Alex/);assert.equal(ui.get('creator-rewards-hero-image').src,baseReward.imageUrl);assert.equal(ui.get('creator-rewards-editor').hidden,true);assert.equal(ui.get('creator-rewards-purchase').parentNode,f.productContainer);await ui.get('creator-rewards-start').emit('click');assert.equal(ui.get('creator-rewards-editor').hidden,false);await ui.get('creator-rewards-close-editor').emit('click');assert.equal(ui.get('creator-rewards-editor').hidden,true);assert.equal(generations(f).length,0);
});
test('the inline contribution follows the actual Shopify cart and invalid carts clear it',async()=>{
 let cart=shopCart();const f=fixture({storefront:true,bridge:true,publicRead:storefrontConfig,cartRead:()=>cart,quoteRead:data=>({eligible:true,fanCopay:data.items[0].productId==='adventure'?0:6000,merchantSubsidy:8000,productCost:14000})});await f.ready();assert.equal(f.rootNodes.get('creator-rewards-contribution').textContent,'$60.00');const count=f.calls.filter(c=>c.data?.type==='basket_updated').length;await f.window.CreatorRewardsShopify.refresh();assert.equal(f.calls.filter(c=>c.data?.type==='basket_updated').length,count);cart=shopCart(2);await f.window.CreatorRewardsShopify.refresh();assert.equal(f.rootNodes.get('creator-rewards-contribution').textContent,'$0.00');cart=shopCart(999);await f.window.CreatorRewardsShopify.refresh();assert.notEqual(f.rootNodes.get('creator-rewards-contribution').textContent,'$0.00');assert.equal(f.window.CreatorRewards.getView().eligible,false);assert.match(f.rootNodes.get('creator-rewards-offer-status').textContent,/eligible|offer/);assert.equal(generations(f).length,0);
});
test('the cart page shows the chosen personal design without changing Shopify cart lines',async()=>{
 const f=fixture({storefront:true,bridge:true,pageType:'cart',publicRead:storefrontConfig,cartRead:()=>shopCart(),history:()=>({items:[result()]})});await f.ready();await f.nodes.get('personal-history').children[0].emit('click');const ui=f.rootNodes;assert.equal(ui.get('creator-rewards-cart').hidden,false);assert.equal(ui.get('creator-rewards-cart').parentNode,f.main);assert.equal(ui.get('creator-rewards-cart-image').src,result().product.imageUrl);assert.match(ui.get('creator-rewards-cart-copy').textContent,/Yosemite 2027/);assert.equal(ui.get('creator-rewards-cart-price').textContent,'$60.00');assert.equal(f.calls.some(c=>c.path==='/cart/add.js'||c.path==='/cart/change.js'),false);assert.equal(generations(f).length,0);
});
test('an invalid creator link never displays the inline offer or a stale contribution',async()=>{
 const f=fixture({storefront:true,bridge:true,publicRead:()=>({...storefrontConfig(),creator:{id:'someone-else',name:'Other'}}),cartRead:()=>shopCart()});await f.ready();assert.equal(f.rootNodes.get('creator-rewards-storefront').hidden,true);assert.equal(f.rootNodes.get('creator-rewards-purchase').hidden,true);assert.equal(f.rootNodes.get('creator-rewards-cart').hidden,true);assert.equal(generations(f).length,0);
});
