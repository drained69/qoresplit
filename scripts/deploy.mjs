import { readFile } from 'node:fs/promises';
import { createPublicClient, createWalletClient, defineChain, hexToBytes, http } from 'viem';
import { bech32 } from '@scure/base';
import { NATIVE_REST, RECEIPTS } from '../server/native.mjs';
import { privateKeyToAccount } from 'viem/accounts';

const key = process.env.DIANA_DEPLOYER_KEY;
if (!/^0x[\da-f]{64}$/i.test(key ?? '')) {
  console.error('Set DIANA_DEPLOYER_KEY to a funded Diana testnet key with a registered PQ key and an open deployment window.');
  process.exit(1);
}
const chain = defineChain({
  id: 9800, name: 'QoreChain Diana', nativeCurrency: { name: 'Test QOR', symbol: 'QOR', decimals: 18 },
  rpcUrls: { default: { http: ['https://evm-testnet.qore.host'] } },
});
const artifact = JSON.parse(await readFile(new URL('../artifacts/QoreSplit.json', import.meta.url)));
const account = privateKeyToAccount(key);
const client = createPublicClient({ chain, transport: http() });
const wallet = createWalletClient({ account, chain, transport: http() });
async function nativeJson(path) {
  const response = await fetch(NATIVE_REST + path, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error('Diana Native preflight returned HTTP ' + response.status + '.');
  return response.json();
}

try {
  const [chainId, balance] = await Promise.all([
    client.getChainId(), client.getBalance({ address: account.address }),
  ]);
  if (chainId !== chain.id) throw new Error('The RPC is not Diana.');
  if (balance === 0n) throw new Error('Fund this testnet account first.');

  const qor = bech32.encode('qor', bech32.toWords(hexToBytes(account.address)));
  const [bridge, window] = await Promise.all([
    nativeJson('/qorechain/crossvm/v1/params'),
    nativeJson('/qorechain/pqc/v1/evm_window/' + qor),
  ]);
  const params = bridge.params ?? bridge;
  if (!params.enabled || !params.bridge_target_pins?.some(({ target, code_id }) =>
    target === 'cosmwasm:' + RECEIPTS && String(code_id) === '865')) {
    throw new Error('Diana’s Native receipt book is not pinned on the bridge allowlist.');
  }
  if (!window.live || window.native_only || window.allowed_targets?.length) {
    throw new Error('Open a live Diana EVM window that permits contract creation.');
  }

  const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode });
  console.log('Diana deployment submitted', hash);
  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 90_000 });
  if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error('Diana deployment reverted.');
  const code = await client.getCode({ address: receipt.contractAddress });
  if (code?.toLowerCase() !== artifact.runtime.toLowerCase()) {
    throw new Error('Diana returned different bytecode. Inspect deployment ' + hash + ' before retrying.');
  }
  console.log('VITE_QORESPLIT_ADDRESS=' + receipt.contractAddress);
} catch (error) {
  console.error(error.shortMessage ?? error.message);
  process.exitCode = 1;
}
