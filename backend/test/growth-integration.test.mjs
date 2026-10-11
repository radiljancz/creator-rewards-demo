import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.mjs';
import { Store } from '../store.mjs';
test('application mounts growth public CORS without opening admin or legacy provider endpoints', async t => {
 const app=createApp({store:new Store(':memory:')});await app.listen(0);t.after(()=>app.close());
 const base=`http://127.0.0.1:${app.server.address().port}`;
 const pub=await fetch(base+'/api/growth/public?campaign=main',{headers:{Origin:'https://jackery.cz'}});
 assert.equal(pub.status,200);assert.equal((await pub.json()).products[0].cost,undefined);
 assert.equal((await fetch(base+'/api/growth/config',{headers:{Origin:'https://jackery.cz'}})).status,403);
 assert.equal((await fetch(base+'/api/designs/categories',{headers:{Origin:'https://jackery.cz'}})).status,403);
 const widget=await fetch(base+'/rewards.js');assert.equal(widget.status,200);assert.match(widget.headers.get('content-type'),/javascript/);
 const shop=await fetch(base+'/shop?creator=alex');assert.equal(shop.status,200);assert.match(shop.headers.get('content-type'),/text\/html/);
});
