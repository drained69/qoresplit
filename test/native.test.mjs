import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nativeRead, NATIVE_REST, RECEIPTS } from '../server/native.mjs';

test('hosted Native receipts use the pinned Diana receipt book', async () => {
  const result = await nativeRead(new Request('https://treaty.example/api/native/receipts/42'), async (url) => {
    const path = '/cosmwasm/wasm/v1/contract/' + RECEIPTS + '/smart/';
    assert.ok(url.startsWith(NATIVE_REST + path));
    assert.deepEqual(JSON.parse(atob(decodeURIComponent(url.slice((NATIVE_REST + path).length)))), { receipt: { id: 42 } });
    return Response.json({ data: { id: 42 } });
  });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await result.json(), { data: { id: 42 } });
});

test('unsupported Native queries do not make upstream requests', async () => {
  const fetch = () => assert.fail('Unexpected upstream request');
  assert.equal((await nativeRead(new Request('https://treaty.example/api/native/receipts/0'), fetch)).status, 404);
  assert.equal((await nativeRead(new Request('https://treaty.example/api/native/receipt/42'), fetch)).status, 404);
  assert.equal((await nativeRead(new Request('https://treaty.example/api/native/receipts/42', { method: 'POST' }), fetch)).status, 405);
});
