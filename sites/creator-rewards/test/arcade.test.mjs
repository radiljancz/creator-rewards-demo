import test from 'node:test';
import assert from 'node:assert/strict';
import { Arcade } from '../worker/arcade.mjs';

test('native Worker fetch transport is invoked without an unrelated receiver', async () => {
  let calls = 0;
  const transport = async function (url, options) {
    if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
    calls++;
    assert.equal(url, 'https://platform.arcade.ai/v1/categories/list');
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    return new Response(JSON.stringify({items: []}));
  };
  const result = await new Arcade({key: 'fixture-only', transport}).categories();
  assert.deepEqual(result, {items: []});
  assert.equal(calls, 1);
});

test('transport diagnostics redact credentials and never log headers or input', async () => {
  const messages = [], original = console.error;
  console.error = (...args) => messages.push(args);
  try {
    await assert.rejects(new Arcade({key: 'private-fixture-key', transport: async () => {
      throw new TypeError('Native failure private-fixture-key');
    }}).categories(), {code: 'provider_unavailable'});
  } finally { console.error = original; }
  assert.equal(messages.length, 1);
  const entry = JSON.parse(messages[0][1]);
  assert.deepEqual(entry, {operation: 'categories/list', name: 'TypeError', message: 'Native failure [redacted]'});
  assert.equal(JSON.stringify(messages).includes('private-fixture-key'), false);
});
