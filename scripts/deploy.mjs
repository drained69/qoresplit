import { readFile } from 'node:fs/promises';
import { createPublicClient, createWalletClient, defineChain, http } from 'viem';
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
if (await client.getChainId() !== chain.id) throw new Error('The RPC is not Diana.');
if (await client.getBalance({ address: account.address }) === 0n) throw new Error('Fund this testnet account first.');
try {
  const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode });
  console.log('Diana deployment submitted', hash);
  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 90_000 });
  if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error('Diana deployment reverted.');
  console.log('VITE_QORESPLIT_ADDRESS=' + receipt.contractAddress);
} catch (error) {
  console.error(error.shortMessage ?? error.message);
  process.exitCode = 1;
}
