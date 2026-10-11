// Local-only SQLite adapter. Provider transport always mocked; real keys ignored.
import { createServer } from 'node:http';
import { readFileSync,mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createHandler } from '../worker/index.mjs';
import { Generation } from '../worker/generation.mjs';
import { snapshot } from '../worker/snapshot.mjs';

mkdirSync('.sites-runtime',{recursive:true});
const previewPort=Number(process.env.PORT||4317);
if(!Number.isInteger(previewPort)||previewPort<1024||previewPort>65535)throw Error('Invalid preview port');
const sqlite=new DatabaseSync(process.env.PREVIEW_DB||'.sites-runtime/preview.sqlite');
if(!sqlite.prepare("SELECT name FROM sqlite_master WHERE name='generation_jobs'").get())sqlite.exec(readFileSync('drizzle/0000_hosted_demo.sql','utf8').replaceAll('--> statement-breakpoint',''));
const DB={prepare(sql){let args=[];const api={bind(...values){args=values;return api},async first(){return sqlite.prepare(sql).get(...args)||null},async all(){return {results:sqlite.prepare(sql).all(...args)}},async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)},success:true}}};return api}};
const category=snapshot.designs[0].category;let generationCount=0;const jobs=new Map(),patternSources=new Map();
async function mockTransport(url,options){const operation=new URL(url).pathname.split('/v1/')[1],value=JSON.parse(options.body);let result;
 if(operation==='categories/list')result={items:[category]};else if(operation==='categories/get')result=category;
 else if(operation==='patterns/create'||operation==='patterns/refine/editRegion'||operation==='products/create'){const suffix=++generationCount,jobId='preview-job-'+suffix,patternId=operation==='products/create'?value.patternId:'preview-pattern-'+suffix,productId='preview-product-'+suffix;patternSources.set(patternId,value.patternId);jobs.set(jobId,{jobId,kind:operation==='products/create'?'product':'pattern',status:'succeeded',result:operation==='products/create'?{productId}:{patternId},patternId,productId});result={jobId};}
 else if(operation==='jobs/get')result=jobs.get(value.jobId);
 else if(operation==='patterns/get')result={patternId:value.patternId,sourcePatternId:patternSources.get(value.patternId),width:1024,height:1024};
 else if(operation==='products/get'){const job=[...jobs.values()].find(j=>j.productId===value.productId);result={productId:value.productId,patternId:job.patternId,title:'Local mock product',imageUrl:snapshot.designs[0].product.imageUrl,createdAt:new Date().toISOString(),unitPrice:{amount:'40.56',currency:'USD'}};}
 else throw Error('Unexpected mock provider operation');
 return new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json'}});
}
const env={DB,ARCADE_API_KEY:'mock-only',GENERATION_ENABLED:'true',MAX_DESIGNS:'20',MAX_PERSONALIZATIONS:'20'};
const app=createHandler({generation:()=>new Generation(env,{snapshot,transport:mockTransport})});
const server=createServer(async(req,res)=>{try{const chunks=[];for await(const c of req)chunks.push(c);const url='http://127.0.0.1:'+previewPort+req.url;const request=new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});const response=await app.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch{res.writeHead(500);res.end('Preview error')}});
server.listen(previewPort,'127.0.0.1',()=>console.log('Local Sites preview http://127.0.0.1:'+previewPort+' · mock provider only. Open shared studio.'));
process.on('SIGTERM',()=>server.close(()=>{sqlite.close();process.exit()}));
