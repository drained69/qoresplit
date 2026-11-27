import {
  BaseError, ContractFunctionRevertedError, createPublicClient, createWalletClient, custom, decodeAbiParameters,
  decodeEventLog, defineChain, formatEther, getAddress, hexToBytes, hexToString, http, isAddress, parseEther, zeroAddress,
} from 'viem';
import { bech32 } from '@scure/base';
import artifact from '../artifacts/Treaty.json';
import {
  DeliveryStatus, Kind, MAX_PARTIES, MAX_REVIEW, MAX_UNITS, MIN_REVIEW, Status, WEI_PER_UQOR, agreementCommitment, budgetOf,
  deliveryCommitment, deliveryNote, isService, parseSignedRequest, paymentCommitment, paymentNote, splitAmounts, termsHash,
  termsNote, windowProblem,
} from './protocol.js';

export { Status, paymentId as checkoutId, splitAmounts } from './protocol.js';

export const abi = artifact.abi;
// VITE_TREATY_RPC is only for local rehearsals against a chain that reports id 9800.
export const RPC = import.meta.env.VITE_TREATY_RPC?.trim() || 'https://evm-testnet.qore.host';
export const chain = defineChain({
  id: 9800, name: 'QoreChain Diana',
  nativeCurrency: { name: 'Test QOR', symbol: 'QOR', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});
let deploymentCheck;
const configuredAddress = import.meta.env.VITE_TREATY_ADDRESS?.trim();
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

function validateParties(title, price, recipientTexts, shareTexts, minimum, role) {
  const titleBytes = new TextEncoder().encode(title).length;
  if (titleBytes < 1 || titleBytes > 96) throw new Error('Enter a title between 1 and 96 UTF-8 bytes.');
  if (recipientTexts.length < minimum || recipientTexts.length > MAX_PARTIES || recipientTexts.length !== shareTexts.length) {
    throw new Error('A treaty needs ' + (minimum === 1 ? 'one' : 'two') + ' to ' + MAX_PARTIES + ' ' + role + 's.');
  }
  const recipients = recipientTexts.map((value) => {
    if (!isAddress(value)) throw new Error('Enter a valid 0x address for every ' + role + '.');
    const recipient = getAddress(value);
    if (recipient === zeroAddress || recipient === address) throw new Error('Use a wallet address for every ' + role + '.');
    return recipient;
  });
  if (new Set(recipients).size !== recipients.length) throw new Error('Each ' + role + ' needs a different address.');
  const shares = shareTexts.map(parseShare);
  if (shares.reduce((total, share) => total + share, 0) !== 10_000) throw new Error('The percentages must add up to 100%.');
  if (shares.some((share) => price / unit * BigInt(share) < 10_000n)) {
    throw new Error('Increase the price or share so each ' + role + ' receives at least 0.000001 QOR.');
  }
  return [recipients, shares];
}

/** Arguments for propose(): a revenue share between two to five parties. */
export function validateLink(title, priceText, recipientTexts, shareTexts) {
  const price = parsePrice(priceText);
  const [recipients, shares] = validateParties(title, price, recipientTexts, shareTexts, 2, 'party');
  return [title, price, recipients, shares];
}

/** Arguments for proposeService(): a client pays providers per delivered unit. */
export function validateService({ title, priceText, unitsText, deadline, reviewMinutesText, clientText, providerTexts, shareTexts }) {
  const price = parsePrice(priceText);
  if (!/^\d{1,4}$/.test(unitsText) || Number(unitsText) < 1 || Number(unitsText) > MAX_UNITS) {
    throw new Error('Allow between 1 and ' + MAX_UNITS + ' units.');
  }
  if (price * BigInt(unitsText) >= 2n ** 128n) throw new Error('The budget is above the contract limit.');
  const seconds = Math.floor(new Date(deadline).getTime() / 1000);
  if (!Number.isFinite(seconds) || seconds <= Date.now() / 1000 + 60) throw new Error('Choose a deadline in the future.');
  if (!/^\d{1,5}$/.test(reviewMinutesText)) throw new Error('Give the review period in whole minutes.');
  const review = Number(reviewMinutesText) * 60;
  if (review < MIN_REVIEW || review > MAX_REVIEW) throw new Error('The review period must be between 1 minute and 30 days.');
  if (!isAddress(clientText)) throw new Error('Enter the client’s 0x address.');
  const client = getAddress(clientText);
  const [providers, shares] = validateParties(title, price, providerTexts, shareTexts, 1, 'provider');
  if (providers.includes(client)) throw new Error('The client cannot also be a provider.');
  return [title, price, Number(unitsText), BigInt(seconds), review, client, providers, shares];
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
      throw new Error('Diana did not return the expected Treaty contract code.');
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

/** The account's Diana EVM window, and why it would refuse a call to Treaty carrying `valueWei`. */
export async function checkWindow(account, valueWei = 0n) {
  const qorAddress = qorAddressOf(account);
  const response = await fetch('/api/native/windows/' + qorAddress, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok && response.status !== 404) throw new Error('Could not read the EVM window.');
  const result = response.ok ? await response.json() : { found: false };
  const state = result.window ?? result.evm_window ?? result;
  const problem = address ? windowProblem(state, { contract: address, valueWei }) : undefined;
  return { active: state.live === true && result.found !== false, problem, qorAddress };
}

export async function transact(provider, account, functionName, args = [], value, onHash) {
  await assertDeployment();
  // A refused window is reported before the wallet prompt. If the window cannot be read, the send decides.
  const window = await checkWindow(account, value ?? 0n).catch(() => undefined);
  if (window?.problem) throw new Error(window.qorAddress + ' ' + window.problem + '. Open a Diana EVM window that allows it, then retry.');
  await switchToDiana(provider);
  const wallet = createWalletClient({ chain, transport: custom(provider) });
  const { request } = await client.simulateContract({ account, address, abi, functionName, args, value });
  const hash = await wallet.writeContract(request);
  onHash?.(hash);
  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 90_000 });
  if (receipt.status !== 'success') throw new Error('The transaction reverted. Nothing was recorded.');
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
  if (!optional) throw new Error('This transaction has no Treaty ' + eventName + ' event.');
}

const errorText = {
  AgreementNotFound: 'This treaty does not exist on this deployment.',
  NotActive: 'This treaty is not live. Every party must sign it first, and a replaced version takes no payments.',
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
  TransferFailed: 'The destination refused the payment. Nothing changed.',
  WrongKind: 'That action does not apply to this kind of treaty.',
  NotClient: 'Only the client, or the client’s owner, can lock this budget. Connect that wallet.',
  AlreadyFunded: 'This treaty’s budget is already locked.',
  NotFunded: 'The client has not locked the budget yet.',
  DeadlinePassed: 'The treaty’s deadline has passed.',
  DeadlineNotPassed: 'The unused budget returns only after the deadline.',
  NoUnitsLeft: 'Every unit of this treaty is delivered or waiting for review.',
  NotAProvider: 'That account is not a provider in this treaty.',
  DeliveryNotPending: 'That delivery is no longer waiting for review.',
  ReviewPeriodOver: 'The review period for that delivery is over.',
  ReviewPeriodNotOver: 'The client can still review that delivery.',
  NothingToRefund: 'There is no unused budget to return.',
  AgentNotAuthorized: 'That agent was switched off by its owner, or its mandate expired.',
  MandateLimitExceeded: 'This would go over the limits the agent’s owner set.',
  InvalidMandate: 'Those limits are invalid, or the agent already has a different owner.',
};

/** A readable reason for a failed call, including Treaty's own errors. */
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
  if (termsHash(agreement) !== agreement.termsHash) throw new Error('The treaty does not match its terms hash.');
  return {
    ...agreement, state: Status[agreement.status], kindName: Kind[agreement.kind], service: isService(agreement),
    budget: isService(agreement) ? budgetOf(agreement) : 0n,
  };
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
  const [clientOf, mandate, signer] = await Promise.all([
    read('treatiesAsClient', [account]), read('getMandate', [account]), read('withdrawalSigner', [account]),
  ]);
  return {
    earned, withdrawn, available, nonce, agreements, clientOf, signer,
    mandate: mandate.owner === zeroAddress ? undefined : mandate,
    consistent: fromAgreements === earned && earned - withdrawn === available,
  };
}

/** Withdrawals of `account`, from event logs. Public RPCs may limit log queries, so this can fail on its own. */
export async function getWithdrawals(account) {
  const fromBlock = await read('deployBlock');
  const logs = await client.getContractEvents({ address, abi, eventName: 'Withdrawn', args: { recipient: account }, fromBlock });
  return logs.map((log) => ({ ...log.args, hash: log.transactionHash, block: log.blockNumber }));
}

export const parseRequest = (text) => parseSignedRequest(text, { chainId: chain.id, contract: address });

/** A service treaty's deliveries, from contract state. */
export async function getDeliveries(id, count) {
  const list = await Promise.all(Array.from({ length: Number(count) }, (_, unit) => read('getDelivery', [id, BigInt(unit)])));
  return list.map((delivery, unit) => ({ ...delivery, unit: BigInt(unit), state: DeliveryStatus[delivery.status] }));
}

/** Payments of a service treaty, from event logs, each checked against its Native receipt. Can fail if the RPC limits logs. */
export async function getUnitPayments(id, agreement) {
  const fromBlock = await read('deployBlock');
  const logs = await client.getContractEvents({ address, abi, eventName: 'Paid', args: { id }, fromBlock });
  return Promise.all(logs.map(async (log) => {
    const delivery = await read('getDelivery', [id, log.args.unit]);
    const commitment = deliveryCommitment({
      chainId: chain.id, contract: address, id, unit: log.args.unit, deliverable: delivery.deliverable,
      recipients: agreement.recipients, credits: log.args.credits,
    });
    const native = commitment === log.args.commitment
      ? await checkNativeReceipt(log.args.nativeReply, deliveryNote(commitment), log.blockNumber)
      : { nativeError: 'The payment does not match its commitment.' };
    return { unit: log.args.unit, how: DeliveryStatus[log.args.how], hash: log.transactionHash, ...native };
  }));
}

let signingChainName;
/** The chain name Treaty's signatures use, as QoreX signs it (for example "qorechain-diana"). */
export async function getSigningChain() {
  signingChainName ??= await read('signingChain');
  return signingChainName;
}

export async function getRefundable(id) {
  return read('refundable', [id]);
}

/** The latest block time, for deadlines and review periods. */
export async function chainTime() {
  return (await client.getBlock()).timestamp;
}

/** The QoreChain explorer's (Cosmos) hash of an EVM transaction, or undefined if it cannot be found. */
export async function cosmosHashOf(hash) {
  try {
    const response = await fetch('/api/native/evm-tx/' + hash, { signal: AbortSignal.timeout(10_000) });
    return response.ok ? (await response.json()).cosmosTx : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Read a transaction from Diana and explain what it did in Treaty: its status, block and
 * time, each Treaty event, and the QoreChain Native receipt behind each agreement or payment.
 */
export async function describeTransaction(hash) {
  await assertDeployment();
  if (!/^0x[\da-f]{64}$/i.test(hash)) throw new Error('That is not a transaction hash.');
  const receipt = await client.getTransactionReceipt({ hash }).catch(() => {
    throw new Error('Diana has no transaction with this hash.');
  });
  const [block, transaction] = await Promise.all([
    client.getBlock({ blockNumber: receipt.blockNumber }), client.getTransaction({ hash }),
  ]);
  const events = [];
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== address.toLowerCase()) continue;
    let event;
    try { event = decodeEventLog({ abi, ...log }); } catch { continue; }
    const item = { name: event.eventName, args: event.args };
    try {
      if (event.eventName === 'Activated') {
        Object.assign(item, await verifyAgreement(event.args.id, await getAgreement(event.args.id)));
      } else if (event.eventName === 'Paid') {
        const agreement = await getAgreement(event.args.id);
        const delivery = await read('getDelivery', [event.args.id, event.args.unit]);
        const commitment = deliveryCommitment({
          chainId: chain.id, contract: address, id: event.args.id, unit: event.args.unit, deliverable: delivery.deliverable,
          recipients: agreement.recipients, credits: event.args.credits,
        });
        Object.assign(item, commitment === event.args.commitment
          ? await checkNativeReceipt(event.args.nativeReply, deliveryNote(commitment), receipt.blockNumber)
          : { nativeError: 'The payment does not match its commitment.' });
      } else if (event.eventName === 'Checkout') {
        Object.assign(item, await verifyReceipt(hash).then(({ native, nativeError }) => ({ native, nativeError })));
      }
    } catch (error) {
      item.nativeError = error?.message ?? 'Native verification failed.';
    }
    events.push(item);
  }
  return {
    receipt, transaction, events, time: new Date(Number(block.timestamp) * 1000),
    fee: receipt.gasUsed * receipt.effectiveGasPrice, isTreaty: receipt.to?.toLowerCase() === address.toLowerCase() || events.length > 0,
  };
}
