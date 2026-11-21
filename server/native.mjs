export const NATIVE_REST = 'https://api-testnet.qore.host';
export const RECEIPTS = 'qor1xjayq5ev55tkzpml9klxwyshr7gdrha0nurha9jhm0f0gdckksgs3gltw8';

export async function nativeRead(request, fetchImpl = fetch) {
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith('/api/native/')) return null;
  if (request.method !== 'GET') return Response.json({ error: 'GET required' }, { status: 405, headers: { Allow: 'GET' } });

  const receipt = pathname.match(/^\/api\/native\/receipts\/([1-9]\d{0,15})$/);
  const window = pathname.match(/^\/api\/native\/windows\/(qor1[023456789acdefghjklmnpqrstuvwxyz]{38})$/);
  let upstreamPath;
  if (receipt && Number.isSafeInteger(Number(receipt[1]))) {
    const query = btoa(JSON.stringify({ receipt: { id: Number(receipt[1]) } }));
    upstreamPath = '/cosmwasm/wasm/v1/contract/' + RECEIPTS + '/smart/' + encodeURIComponent(query);
  } else if (window) {
    upstreamPath = '/qorechain/pqc/v1/evm_window/' + window[1];
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
    return Response.json(await response.json(), {
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return Response.json({ error: 'Diana query unavailable' }, { status: 502 });
  }
}
