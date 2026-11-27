// QORE_NATIVE_REST is only for local rehearsals; hosted Workers always use Diana.
export const NATIVE_REST = globalThis.process?.env?.QORE_NATIVE_REST?.trim() || 'https://api-testnet.qore.host';
export const RECEIPTS = 'qor1xjayq5ev55tkzpml9klxwyshr7gdrha0nurha9jhm0f0gdckksgs3gltw8';

export async function nativeRead(request, fetchImpl = fetch) {
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith('/api/native/')) return null;
  if (request.method !== 'GET') return Response.json({ error: 'GET required' }, { status: 405, headers: { Allow: 'GET' } });

  const receipt = pathname.match(/^\/api\/native\/receipts\/([1-9]\d{0,15})$/);
  const window = pathname.match(/^\/api\/native\/windows\/(qor1[023456789acdefghjklmnpqrstuvwxyz]{38})$/);
  const evmTx = pathname.match(/^\/api\/native\/evm-tx\/(0x[\da-fA-F]{64})$/);
  let upstreamPath;
  let pick = (body) => body;
  if (receipt && Number.isSafeInteger(Number(receipt[1]))) {
    const query = btoa(JSON.stringify({ receipt: { id: Number(receipt[1]) } }));
    upstreamPath = '/cosmwasm/wasm/v1/contract/' + RECEIPTS + '/smart/' + encodeURIComponent(query);
  } else if (window) {
    upstreamPath = '/qorechain/pqc/v1/evm_window/' + window[1];
  } else if (evmTx) {
    // The Cosmos hash of an EVM transaction: the form the QoreChain explorer lists.
    upstreamPath = '/cosmos/tx/v1beta1/txs?query=' + encodeURIComponent("ethereum_tx.ethereumTxHash='" + evmTx[1].toLowerCase() + "'");
    pick = (body) => {
      const found = body?.tx_responses?.[0];
      return found ? { cosmosTx: found.txhash, height: found.height } : undefined;
    };
  } else {
    return Response.json({ error: 'Unknown Diana query' }, { status: 404 });
  }

  try {
    const response = await fetchImpl(NATIVE_REST + upstreamPath, {
      redirect: 'error', signal: AbortSignal.timeout(8500), headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      const status = response.status === 404 ? 404 : 502;
      return Response.json({ error: 'Diana query unavailable' }, { status, headers: { 'Cache-Control': 'no-store' } });
    }
    const body = pick(await response.json());
    if (body === undefined) return Response.json({ error: 'Not found on Diana' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    return Response.json(body, {
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return Response.json({ error: 'Diana query unavailable' }, { status: 502 });
  }
}
