import {
  BaseError, ContractFunctionRevertedError, createPublicClient, createWalletClient, custom, decodeAbiParameters,
  decodeEventLog, defineChain, formatEther, getAddress, hexToBytes, hexToString, http, isAddress, parseEther, zeroAddress,
} from 'viem';
import { bech32 } from '@scure/base';
import artifact from '../artifacts/QoreSplit.json';
import {
  MAX_RECIPIENTS, Status, WEI_PER_UQOR, agreementCommitment, parseSignedRequest, paymentCommitment, paymentNote,
  splitAmounts, termsHash, termsNote,
} from './protocol.js';

export { Status, paymentId as checkoutId, splitAmounts } from './protocol.js';

export const abi = artifact.abi;
// VITE_QORESPLIT_RPC is only for local rehearsals against a chain that reports id 9800.
export const RPC = import.meta.env.VITE_QORESPLIT_RPC?.trim() || 'https://evm-testnet.qore.host';
export const chain = defineChain({
  id: 9800, name: 'QoreChain Diana',
  nativeCurrency: { name: 'Test QOR', symbol: 'QOR', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});
let deploymentCheck;
const configuredAddress = import.meta.env.VITE_QORESPLIT_ADDRESS?.trim();
export const address = isAddress(configuredAddress ?? '') && configuredAddress !== zeroAddress
  ? getAddress(configuredAddress) : undefined;
export const client = createPublicClient({ chain, transport: http(RPC, { timeout: 12_000 }) });
const unit = WEI_PER_UQOR;
export const qorAddressOf = (account) => bech32.encode('qor', bech32.toWords(hexToBytes(account)));

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

export function validateLink(title, priceText, recipientTexts, shareTexts) {
  const titleBytes = new TextEncoder().encode(title).length;
  if (titleBytes < 1 || titleBytes > 96) throw new Error('Enter a title between 1 and 96 UTF-8 bytes.');
  if (recipientTexts.length < 2 || recipientTexts.length > MAX_RECIPIENTS || recipientTexts.length !== shareTexts.length) {
    throw new Error('A split needs two to ' + MAX_RECIPIENTS + ' recipients.');
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

const announcedWallets = new Map();
window.addEventListener('eip6963:announceProvider', ({ detail }) => {
  if (detail?.info?.rdns && typeof detail.provider?.request === 'function') {
    announcedWallets.set(detail.info.rdns, detail.provider);
  }
});
window.dispatchEvent(new Event('eip6963:requestProvider'));

export function selectWallet() {
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  const listed = window.ethereum?.providers ?? [window.ethereum];
  return announcedWallets.get('io.metamask') ??
    listed.find((provider) => provider?.isMetaMask && !provider?.isQoreX) ??
    [...announcedWallets].find(([rdns, provider]) => rdns !== 'network.qore.qorex' && !provider.isQoreX)?.[1] ??
    listed.find((provider) => typeof provider?.request === 'function' && !provider.isQoreX);
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

async function assertDeployment() {
  if (!address) throw new Error('Configure the Diana deployment to use live payments.');
  deploymentCheck ??= Promise.all([client.getChainId(), client.getCode({ address })]).then(([chainId, code]) => {
    if (chainId !== chain.id || code?.toLowerCase() !== artifact.runtime.toLowerCase()) {
      throw new Error('Diana did not return the expected QoreSplit contract code.');
    }
  }).catch((error) => {
    deploymentCheck = undefined;
    throw error;
  });
  await deploymentCheck;
}

export async function read(functionName, args = []) {
  await assertDeployment();
  return client.readContract({ address, abi, functionName, args });
}

export async function checkWindow(account) {
  const qorAddress = bech32.encode('qor', bech32.toWords(hexToBytes(account)));
  const response = await fetch('/api/native/windows/' + qorAddress, {
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
  await assertDeployment();
  await switchToDiana(provider);
  const wallet = createWalletClient({ chain, transport: custom(provider) });
  const { request } = await client.simulateContract({ account, address, abi, functionName, args, value });
  const hash = await wallet.writeContract(request);
  onHash?.(hash);
  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 90_000 });
  if (receipt.status !== 'success') throw new Error('The transaction reverted. No checkout or withdrawal was recorded.');
  return receipt;
}

export function getEvent(receipt, eventName, { optional = false } = {}) {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== address?.toLowerCase()) continue;
    try {
      const event = decodeEventLog({ abi, ...log });
      if (event.eventName === eventName) return event.args;
    } catch { /* Other logs are irrelevant to this event. */ }
  }
  if (!optional) throw new Error('This transaction has no QoreSplit ' + eventName + ' event.');
}

const errorText = {
  AgreementNotFound: 'This agreement does not exist on this deployment.',
  NotActive: 'This agreement is not live. Every collaborator must sign it first, and a replaced version takes no payments.',
  NotPending: 'This agreement is no longer waiting for signatures.',
  PreviousNotActive: 'The version this change replaces is no longer active.',
  NotASigner: 'That account is not one of the signers of this agreement.',
  AlreadySigned: 'That collaborator has already signed.',
  NotAuthorized: 'Only the proposer or a signer can cancel this proposal.',
  PqcKeyNotRegistered: 'That account has no ML-DSA-87 key registered on QoreChain.',
  PqcKeyNotProven: 'That account’s ML-DSA-87 key has no proof of possession on chain.',
  BadPqcSignature: 'The post-quantum signature does not match the signer’s registered key for these exact bytes.',
  IncorrectPayment: 'The payment must be exactly the agreed price.',
  AlreadyPaid: 'This payment was already made.',
  BridgeUnavailable: 'The Native receipt book did not answer, so nothing was recorded.',
  NativeReceiptRejected: 'QoreChain Native refused the receipt, so nothing was recorded.',
  InvalidTerms: 'These terms are invalid.',
  InvalidWithdrawal: 'Withdraw a positive amount to a wallet address.',
  InsufficientBalance: 'That is more than the available balance.',
  WithdrawalFailed: 'The destination refused the payment. The balance is unchanged.',
};

/** A readable reason for a failed call, including QoreSplit's own errors. */
export function explainError(error) {
  if (error instanceof BaseError) {
    const revert = error.walk((cause) => cause instanceof ContractFunctionRevertedError);
    const name = revert?.data?.errorName;
    if (name && errorText[name]) return errorText[name];
    return error.shortMessage;
  }
  return error?.message ?? 'Something went wrong.';
}

const pqcKeysAbi = [{
  type: 'function', name: 'pqcKeyStatus', stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [
    { name: 'registered', type: 'bool' }, { name: 'algorithmId', type: 'uint8' },
    { name: 'pubkey', type: 'bytes' }, { name: 'possessionProven', type: 'bool' },
  ],
}];

/** Whether `account` can sign: its ML-DSA-87 key as the chain's own registry reports it. */
export async function pqcKeyStatus(account) {
  const [registered, , pubkey, proven] = await client.readContract({
    address: '0x0000000000000000000000000000000000000a02', abi: pqcKeysAbi, functionName: 'pqcKeyStatus', args: [account],
  });
  return { registered: registered && pubkey.length > 2, proven };
}

export function decodeNativeReply(reply) {
  try {
    return JSON.parse(hexToString(reply));
  } catch {
    const [decoded] = decodeAbiParameters([{ type: 'bytes' }], reply);
    return JSON.parse(hexToString(decoded));
  }
}

/** Read the Native receipt the bridge reported and check it carries `note` from this contract at `height`. */
async function checkNativeReceipt(reply, note, height) {
  try {
    const { id } = decodeNativeReply(reply);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('The bridge returned an invalid Native receipt ID.');
    const response = await fetch('/api/native/receipts/' + id, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error('The Native receipt could not be read from Diana.');
    const { data } = await response.json();
    if (data.id !== id || data.sender !== qorAddressOf(address) || data.note !== note || BigInt(data.height) !== BigInt(height)) {
      throw new Error('The Native receipt differs from the EVM evidence.');
    }
    return { native: data };
  } catch (error) {
    return { nativeError: error instanceof Error ? error.message : 'Native verification failed.' };
  }
}

export async function getAgreement(id) {
  const agreement = await read('getAgreement', [id]);
  if (termsHash(agreement) !== agreement.termsHash) throw new Error('The agreement does not match its terms hash.');
  return { ...agreement, state: Status[agreement.status] };
}

/** Check an agreement's activation record on both VMs. */
export async function verifyAgreement(id, agreement) {
  if (!agreement.activatedAt) return {};
  const commitment = agreementCommitment({
    chainId: chain.id, contract: address, id, hash: agreement.termsHash, signers: agreement.signers,
  });
  if (commitment !== await read('agreementCommitment', [id])) return { nativeError: 'The agreement commitment does not match.' };
  return { commitment, ...await checkNativeReceipt(agreement.nativeReply, termsNote(commitment), agreement.activatedAt) };
}

export async function verifyReceipt(hash) {
  await assertDeployment();
  if (!/^0x[\da-f]{64}$/i.test(hash)) throw new Error('Enter a 0x transaction hash with 64 hexadecimal digits.');
  const receipt = await client.getTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('This transaction reverted. It did not create a receipt.');
  const payment = getEvent(receipt, 'Checkout');
  const agreement = await getAgreement(payment.id);
  const expectedCredits = splitAmounts(agreement.price, agreement.shares);
  const commitment = paymentCommitment({
    chainId: chain.id, contract: address, id: payment.id, payer: payment.payer, paymentId: payment.paymentId,
    total: payment.total, recipients: agreement.recipients, credits: payment.credits,
  });
  if (payment.total !== agreement.price || payment.credits.length !== expectedCredits.length ||
      payment.credits.some((credit, i) => credit !== expectedCredits[i]) || payment.commitment !== commitment) {
    throw new Error('The EVM payment does not match its receipt commitment.');
  }
  const native = await checkNativeReceipt(payment.nativeReply, paymentNote(commitment), receipt.blockNumber);
  return { receipt, payment, agreement, ...native };
}

/** Everything an address has earned and withdrawn, read from contract state. */
export async function getStatement(account) {
  const [earned, withdrawn, available, nonce, ids] = await Promise.all([
    read('earned', [account]), read('withdrawn', [account]), read('claimable', [account]),
    read('nonces', [account]), read('agreementsOf', [account]),
  ]);
  const agreements = await Promise.all(ids.map(async (id) => {
    const agreement = await getAgreement(id);
    const index = agreement.recipients.findIndex((recipient) => recipient.toLowerCase() === account.toLowerCase());
    const credit = splitAmounts(agreement.price, agreement.shares)[index];
    return { id, agreement, share: agreement.shares[index], credit, total: credit * agreement.sales };
  }));
  const fromAgreements = agreements.reduce((sum, row) => sum + row.total, 0n);
  return { earned, withdrawn, available, nonce, agreements, consistent: fromAgreements === earned && earned - withdrawn === available };
}

/** Withdrawals of `account`, from event logs. Public RPCs may limit log queries, so this can fail on its own. */
export async function getWithdrawals(account) {
  const fromBlock = await read('deployBlock');
  const logs = await client.getContractEvents({ address, abi, eventName: 'Withdrawn', args: { recipient: account }, fromBlock });
  return logs.map((log) => ({ ...log.args, hash: log.transactionHash, block: log.blockNumber }));
}

export const parseRequest = (text) => parseSignedRequest(text, { chainId: chain.id, contract: address });
