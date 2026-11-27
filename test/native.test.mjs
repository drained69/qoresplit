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

test('an EVM transaction maps to the Cosmos hash the explorer lists', async () => {
  const hash = '0x' + 'ab'.repeat(32);
  const result = await nativeRead(new Request('https://treaty.example/api/native/evm-tx/' + hash), async (url) => {
    assert.ok(url.startsWith(NATIVE_REST + '/cosmos/tx/v1beta1/txs?query='));
    assert.equal(decodeURIComponent(url.split('query=')[1]), "ethereum_tx.ethereumTxHash='" + hash + "'");
    return Response.json({ tx_responses: [{ txhash: 'ABC123', height: '42' }] });
  });
  assert.deepEqual(await result.json(), { cosmosTx: 'ABC123', height: '42' });
  const missing = await nativeRead(new Request('https://treaty.example/api/native/evm-tx/' + hash), async () => Response.json({ tx_responses: [] }));
  assert.equal(missing.status, 404);
  const fetch = () => assert.fail('Unexpected upstream request');
  assert.equal((await nativeRead(new Request('https://treaty.example/api/native/evm-tx/0x1234'), fetch)).status, 404);
});
