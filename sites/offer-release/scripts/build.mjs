import { build } from 'esbuild';
import { readFileSync,writeFileSync,mkdirSync,readdirSync,rmSync } from 'node:fs';
import { resolve,extname } from 'node:path';
import { gzipSync } from 'node:zlib';
const root=resolve(import.meta.dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.mp4':'video/mp4','.vtt':'text/vtt; charset=utf-8','.woff':'font/woff','.woff2':'font/woff2'};
const binaryTypes=new Set(['.jpg','.jpeg','.png','.mp4','.woff','.woff2']);
const assets={};
function collect(directory,prefix=''){
 for(const entry of readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
  const name=prefix+entry.name,filename=resolve(directory,entry.name);
  if(entry.isDirectory()){collect(filename,name+'/');continue}
  if(!entry.isFile())throw Error('Public assets must be regular files: '+name);
  const extension=extname(name).toLowerCase();
  if(!types[extension])throw Error('Unexpected public artifact: '+name);
  const bytes=readFileSync(filename),binary=binaryTypes.has(extension);
  assets['/'+name]={type:types[extension],body:bytes.toString(binary?'base64':'utf8'),...(binary?{encoding:'base64',size:bytes.length}:{})};
 }
}
collect(resolve(root,'public'));
writeFileSync(resolve(root,'worker/assets.mjs'),'export const assets = '+JSON.stringify(assets)+';\n');
const dist=resolve(root,'dist');rmSync(dist,{recursive:true,force:true});mkdirSync(resolve(dist,'server'),{recursive:true});mkdirSync(resolve(dist,'.openai'),{recursive:true});
await build({entryPoints:[resolve(root,'worker/index.mjs')],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:resolve(dist,'server/index.js'),legalComments:'none',minify:false});
const hosting=JSON.parse(readFileSync(resolve(root,'.openai/hosting.json'),'utf8'));
writeFileSync(resolve(dist,'.openai/hosting.json'),JSON.stringify(hosting,null,2)+'\n');
// Archive owns the single Worker; all frontend assets are embedded, no Node runtime.
const code=readFileSync(resolve(dist,'server/index.js'),'utf8');if(/\bfrom\s+["']node:/.test(code))throw Error('Node runtime leaked into Worker');
const rawBytes=Buffer.byteLength(code),gzipBytes=gzipSync(code).length,maxGzipBytes=3*1024*1024;
console.log(`Built Worker with ${Object.keys(assets).length} public assets (${rawBytes} raw bytes; ${gzipBytes} gzip bytes).`);
if(gzipBytes>maxGzipBytes)throw Error(`Worker exceeds the ${maxGzipBytes}-byte gzip budget: ${gzipBytes} bytes. Compress media before packaging.`);
