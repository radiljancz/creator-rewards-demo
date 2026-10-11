import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../worker/index.mjs';

const bytes=Uint8Array.from([0,1,2,127,128,129,200,253,254,255]);
const assets={
 '/media/demo.mp4':{type:'video/mp4',encoding:'base64',body:Buffer.from(bytes).toString('base64'),size:bytes.length},
 '/index.html':{type:'text/html; charset=utf-8',body:'<h1>Demo</h1>'},
};
const handler=createHandler({assets});
const request=(headers={},method='GET',path='/media/demo.mp4')=>handler.fetch(new Request('https://demo.example'+path,{method,headers}),{});
const body=async response=>new Uint8Array(await response.arrayBuffer());

test('binary GET retains every byte and exposes media headers',async()=>{
 const response=await request();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('Content-Type'),'video/mp4');
 assert.equal(response.headers.get('Content-Length'),'10');
 assert.equal(response.headers.get('Accept-Ranges'),'bytes');
 assert.deepEqual(await body(response),bytes);
});

test('closed, open-ended, suffix and oversized-end ranges return exact slices',async()=>{
 for(const [range,start,end] of [['bytes=2-5',2,5],['bytes=6-',6,9],['bytes=-3',7,9],['bytes=8-999',8,9],['bytes=-99',0,9]]){
  const response=await request({Range:range});
  assert.equal(response.status,206,range);
  assert.equal(response.headers.get('Content-Range'),`bytes ${start}-${end}/10`);
  assert.equal(response.headers.get('Content-Length'),String(end-start+1));
  assert.deepEqual(await body(response),bytes.slice(start,end+1));
 }
});

test('unsatisfiable byte ranges return 416 without data',async()=>{
 for(const range of ['bytes=10-','bytes=12-15','bytes=5-2','bytes=-0']){
  const response=await request({Range:range});
  assert.equal(response.status,416,range);
  assert.equal(response.headers.get('Content-Range'),'bytes */10');
  assert.equal(response.headers.get('Content-Length'),'0');
  assert.equal((await body(response)).length,0);
 }
});

test('HEAD is bodyless and ignores Range without decoding binary data',async()=>{
 const headOnly=createHandler({assets:{'/media/demo.mp4':{...assets['/media/demo.mp4'],body:'intentionally invalid base64'}}});
 const response=await headOnly.fetch(new Request('https://demo.example/media/demo.mp4',{method:'HEAD',headers:{Range:'bytes=2-5'}}),{});
 assert.equal(response.status,200);
 assert.equal(response.headers.get('Content-Length'),'10');
 assert.equal(response.headers.get('Content-Range'),null);
 assert.equal((await body(response)).length,0);
});

test('unsupported or malformed ranges and unvalidated If-Range use the full representation',async()=>{
 for(const headers of [{Range:'bytes=0-1,4-5'},{Range:'items=0-1'},{Range:'bytes=wat'},{Range:'bytes=0-1','If-Range':'"old-version"'}]){
  const response=await request(headers);
  assert.equal(response.status,200);
  assert.deepEqual(await body(response),bytes);
 }
});

test('static methods and missing assets stay denied while text CSP is retained',async()=>{
 assert.equal((await request({},'POST')).status,404);
 assert.equal((await request({},'GET','/media/missing.mp4')).status,404);
 const response=await request({},'GET','/');
 assert.equal(response.status,200);
 assert.equal(await response.text(),'<h1>Demo</h1>');
 assert.match(response.headers.get('Content-Security-Policy'),/media-src 'self'/);
 assert.match(response.headers.get('Content-Security-Policy'),/object-src 'none'/);
});
