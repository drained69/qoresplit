import {
  createPublicClient, createWalletClient, custom, decodeAbiParameters, decodeEventLog, defineChain,
  encodeAbiParameters, formatEther, getAddress, hexToBytes, hexToString, http, isAddress,
  keccak256, parseEther, stringToHex, zeroAddress,
} from 'viem';
import { bech32 } from '@scure/base';
import artifact from '../artifacts/QoreSplit.json';

export const abi = artifact.abi;
export const RPC = 'https://evm-testnet.qore.host';
export const NATIVE_REST = 'https://api-testnet.qore.host';
export const RECEIPTS = 'qor1xjayq5ev55tkzpml9klxwyshr7gdrha0nurha9jhm0f0gdckksgs3gltw8';
export const chain = defineChain({
  id: 9800, name: 'QoreChain Diana',
  nativeCurrency: { name: 'Test QOR', symbol: 'QOR', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});
const configuredAddress = import.meta.env.VITE_QORESPLIT_ADDRESS?.trim();
export const address = isAddress(configuredAddress ?? '') && configuredAddress !== zeroAddress
  ? getAddress(configuredAddress) : undefined;
export const client = createPublicClient({ chain, transport: http(RPC, { timeout: 12_000 }) });
const unit = 10n ** 12n;
const domain = keccak256(stringToHex('qoresplit.checkout.v1'));

export const formatQor = (amount) => formatEther(amount) + ' QOR';
export const short = (value) => value.slice(0, 8) + '…' + value.slice(-5);

export function parsePrice(value) {
  if (!/^\d+(?:\.\d{1,6})?$/.test(value)) throw new Error('Enter a QOR amount with up to six decimal places.');
  const price = parseEther(value);
  if (price <= 0n || price >= 2n ** 128n) throw new Error('Enter a positive QOR amount within the contract limit.');
  return price;
}

export function parseShare(value) {
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(value)) throw new Error('Use percentages with up to two decimal places.');
  const [whole, fraction = ''] = value.split('.');
  const share = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (share < 1 || share > 10_000) throw new Error('Each share must be above 0% and at most 100%.');
  return share;
}

export function splitAmounts(price, shares) {
  let remainder = price;
  return shares.map((share, i) => {
    if (i === shares.length - 1) return remainder;
    const credit = (price / unit * BigInt(share) / 10_000n) * unit;
    remainder -= credit;
    return credit;
  });
}

export function validateLink(title, priceText, recipientTexts, shareTexts) {
  const titleBytes = new TextEncoder().encode(title).length;
  if (titleBytes < 1 || titleBytes > 96) throw new Error('Enter a title between 1 and 96 UTF-8 bytes.');
  if (recipientTexts.length < 2 || recipientTexts.length > 3 || recipientTexts.length !== shareTexts.length) {
    throw new Error('A split needs two or three recipients.');
  }
  const price = parsePrice(priceText);
  const recipients = recipientTexts.map((value) => {
    if (!isAddress(value)) throw new Error('Enter a valid 0x address for every recipient.');
    const recipient = getAddress(value);
    if (recipient === zeroAddress || recipient === address) throw new Error('Use a recipient wallet address.');
    return recipient;
  });
  if (new Set(recipients).size !== recipients.length) throw new Error('Each recipient needs a different address.');
  const shares = shareTexts.map(parseShare);
  if (shares.reduce((total, share) => total + share, 0) !== 10_000) throw new Error('The percentages must add up to 100%.');
  if (shares.some((share) => price / unit * BigInt(share) < 10_000n)) {
    throw new Error('Increase the price or share so each recipient receives at least 0.000001 QOR.');
  }
  return [title, price, recipients, shares];
}

export function selectWallet() {
  const listed = window.ethereum?.providers ?? [window.ethereum];
  return listed.find((provider) => provider?.isMetaMask && !provider?.isQoreX) ??
    listed.find((provider) => provider && !provider.isQoreX);
}

export async function requestWallet(provider) {
  const [account] = await provider.request({ method: 'eth_requestAccounts' });
  if (!isAddress(account ?? '')) throw new Error('Your wallet did not return an account.');
  return getAddress(account);
}

export async function switchToDiana(provider) {
  await provider.request({
    method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2648' }],
  }).catch(async (error) => {
    if (Number(error.code) !== 4902) throw error;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{ chainId: '0x2648', chainName: chain.name, nativeCurrency: chain.nativeCurrency, rpcUrls: [RPC] }],
    });
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2648' }] });
  });
}

export function read(functionName, args = []) {
  if (!address) throw new Error('Configure the Diana deployment to use live payments.');
  return client.readContract({ address, abi, functionName, args });
}

export async function checkWindow(account) {
  const qorAddress = bech32.encode('qor', bech32.toWords(hexToBytes(account)));
  const response = await fetch(NATIVE_REST + '/qorechain/pqc/v1/evm_window/' + qorAddress, {
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 404) return { active: false, qorAddress };
  if (!response.ok) throw new Error('Could not read the EVM window.');
  const result = await response.json();
  const windowState = result.window ?? result.evm_window ?? result;
  if (result.found === false) return { active: false, qorAddress };
  return {
    active: typeof windowState.live === 'boolean' ? windowState.live : undefined,
    qorAddress,
  };
}

export async function transact(provider, account, functionName, args = [], value, onHash) {
  if (!address) throw new Error('Configure the Diana deployment to use live payments.');
  await switchToDiana(provider);
  const wallet = createWalletClient({ chain, transport: custom(provider) });
  const { request } = await client.simulateContract({ account, address, abi, functionName, args, value });
  const hash = await wallet.writeContract(request);
  onHash?.(hash);
  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 90_000 });
  if (receipt.status !== 'success') throw new Error('The transaction reverted. No checkout or withdrawal was recorded.');
  return receipt;
}

export function getEvent(receipt, eventName) {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== address?.toLowerCase()) continue;
    try {
      const event = decodeEventLog({ abi, ...log });
      if (event.eventName === eventName) return event.args;
    } catch { /* Other logs are irrelevant to this event. */ }
  }
  throw new Error('This transaction has no QoreSplit ' + eventName + ' event.');
}

export function paymentCommitment({ linkId, payer, paymentId, total, credits }, recipients, contract = address) {
  const types = ['bytes32', 'uint256', 'address', 'uint256', 'address', 'bytes32', 'uint256', 'address[]', 'uint256[]'];
  return keccak256(encodeAbiParameters(types.map((type) => ({ type })), [
    domain, BigInt(chain.id), contract, linkId, payer, paymentId, total, recipients, credits,
  ]));
}

export function decodeNativeReply(reply) {
  try {
    return JSON.parse(hexToString(reply));
  } catch {
    const [decoded] = decodeAbiParameters([{ type: 'bytes' }], reply);
    return JSON.parse(hexToString(decoded));
  }
}

export async function verifyReceipt(hash) {
  if (!address) throw new Error('Configure the Diana deployment to verify live receipts.');
  if (!/^0x[\da-f]{64}$/i.test(hash)) throw new Error('Enter a 0x transaction hash with 64 hexadecimal digits.');
  const receipt = await client.getTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('This transaction reverted. It did not create a receipt.');
  const payment = getEvent(receipt, 'Checkout');
  const link = await read('getLink', [payment.linkId]);
  if (payment.commitment !== paymentCommitment(payment, link.recipients)) {
    throw new Error('The EVM payment does not match its receipt commitment.');
  }

  let native;
  let nativeError;
  try {
    const reply = decodeNativeReply(payment.nativeReply);
    if (!Number.isSafeInteger(reply.id) || reply.id < 1) throw new Error('The bridge returned an invalid Native receipt ID.');
    const path = btoa(JSON.stringify({ receipt: { id: reply.id } }));
    const response = await fetch(NATIVE_REST + '/cosmwasm/wasm/v1/contract/' + RECEIPTS + '/smart/' + encodeURIComponent(path), {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('The Native receipt could not be read from Diana.');
    const { data } = await response.json();
    const expectedSender = bech32.encode('qor', bech32.toWords(hexToBytes(address)));
    if (data.id !== reply.id || data.sender !== expectedSender ||
        data.note !== 'qoresplit:' + payment.commitment.slice(2) || BigInt(data.height) !== receipt.blockNumber) {
      throw new Error('The Native receipt differs from the EVM checkout evidence.');
    }
    native = data;
  } catch (error) {
    nativeError = error instanceof Error ? error.message : 'Native verification failed.';
  }
  return { receipt, payment, link, native, nativeError };
}
