// Pure QoreSplit protocol helpers shared by the app, the signing CLI and the tests.
// Each function mirrors the contract byte for byte; the tests check that they agree.
import { concatHex, encodeAbiParameters, encodePacked, keccak256, stringToHex, toHex } from 'viem';

export const WEI_PER_UQOR = 10n ** 12n;
export const BPS = 10_000n;
export const MAX_RECIPIENTS = 5;
export const Status = Object.freeze(['None', 'Pending', 'Active', 'Superseded', 'Cancelled']);

const domain = (name) => keccak256(stringToHex(name));
export const TERMS_DOMAIN = domain('qoresplit.terms.v2');
export const AGREEMENT_DOMAIN = domain('qoresplit.agreement.v2');
export const RECEIPT_DOMAIN = domain('qoresplit.checkout.v2');
const params = (...types) => types.map((type) => ({ type }));

/** Whole uqor for every share but the last, which receives the remainder. */
export function splitAmounts(price, shares) {
  let remainder = BigInt(price);
  return shares.map((share, i) => {
    if (i === shares.length - 1) return remainder;
    const credit = (BigInt(price) / WEI_PER_UQOR * BigInt(share) / BPS) * WEI_PER_UQOR;
    remainder -= credit;
    return credit;
  });
}

export function termsHash({ title, price, recipients, shares, previous }) {
  return keccak256(encodeAbiParameters(
    params('bytes32', 'string', 'uint128', 'address[]', 'uint16[]', 'uint256'),
    [TERMS_DOMAIN, title, BigInt(price), recipients, shares.map(Number), BigInt(previous)],
  ));
}

/** The bytes a signer signs with ML-DSA-87 to accept agreement `id`. */
export function termsMessage({ chainId, contract, id, signer, hash }) {
  return concatHex([
    toHex('QoreSplit:terms:v2'),
    encodePacked(['uint256', 'address', 'uint256', 'address', 'bytes32'], [BigInt(chainId), contract, BigInt(id), signer, hash]),
  ]);
}

/** The bytes a recipient signs with ML-DSA-87 to send `amount` wei to `to`. */
export function withdrawalMessage({ chainId, contract, recipient, to, amount, nonce }) {
  return concatHex([
    toHex('QoreSplit:withdraw:v2'),
    encodePacked(
      ['uint256', 'address', 'address', 'address', 'uint256', 'uint256'],
      [BigInt(chainId), contract, recipient, to, BigInt(amount), BigInt(nonce)],
    ),
  ]);
}

export function agreementCommitment({ chainId, contract, id, hash, signers }) {
  return keccak256(encodeAbiParameters(
    params('bytes32', 'uint256', 'address', 'uint256', 'bytes32', 'address[]'),
    [AGREEMENT_DOMAIN, BigInt(chainId), contract, BigInt(id), hash, signers],
  ));
}

export function paymentId(id, payer, reference) {
  return keccak256(encodeAbiParameters(params('uint256', 'address', 'bytes32'), [BigInt(id), payer, reference]));
}

export function paymentCommitment({ chainId, contract, id, payer, paymentId: payment, total, recipients, credits }) {
  return keccak256(encodeAbiParameters(
    params('bytes32', 'uint256', 'address', 'uint256', 'address', 'bytes32', 'uint256', 'address[]', 'uint256[]'),
    [RECEIPT_DOMAIN, BigInt(chainId), contract, BigInt(id), payer, payment, BigInt(total), recipients, credits],
  ));
}

/** The Native receipt notes the contract writes. */
export const termsNote = (commitment) => 'qoresplit-terms:' + commitment.slice(2);
export const paymentNote = (commitment) => 'qoresplit:' + commitment.slice(2);

/** Everyone who must sign: the recipients, then anyone on the replaced version not already listed. */
export function requiredSigners(recipients, previousRecipients = []) {
  const lower = new Set(recipients.map((value) => value.toLowerCase()));
  return [...recipients, ...previousRecipients.filter((value) => !lower.has(value.toLowerCase()))];
}

/** A signed request travels as JSON between the signing tool and any wallet that relays it. */
export const REQUEST_KIND = 'qoresplit-signed-request';
const hexAddress = /^0x[\da-fA-F]{40}$/;
const decimal = /^\d{1,78}$/;

export function signedRequest(fields) {
  const request = { kind: REQUEST_KIND, version: 2, ...fields };
  return JSON.stringify(request, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2);
}

/**
 * Parse and check the shape of a pasted signed request. It authorises nothing by
 * itself: the contract checks the ML-DSA-87 signature against the signer's key.
 */
export function parseSignedRequest(text, { chainId, contract }) {
  let request;
  try { request = JSON.parse(text); } catch { throw new Error('Paste the JSON the signing tool saved.'); }
  if (request?.kind !== REQUEST_KIND || request.version !== 2) throw new Error('This is not a QoreSplit signed request.');
  if (request.chainId !== chainId) throw new Error('This request was signed for a different chain.');
  if (!hexAddress.test(request.contract ?? '') || request.contract.toLowerCase() !== contract?.toLowerCase()) {
    throw new Error('This request was signed for a different QoreSplit deployment.');
  }
  if (!/^0x[\da-fA-F]+$/.test(request.signature ?? '') || request.signature.length % 2) {
    throw new Error('The request has no valid signature.');
  }
  if (request.action === 'sign') {
    if (!decimal.test(String(request.id)) || !hexAddress.test(request.signer ?? '')) throw new Error('The signing request is incomplete.');
    return { action: 'sign', id: BigInt(request.id), signer: request.signer, signature: request.signature };
  }
  if (request.action === 'withdraw') {
    if (!hexAddress.test(request.recipient ?? '') || !hexAddress.test(request.to ?? '') ||
        !decimal.test(String(request.amount)) || BigInt(request.amount) === 0n) {
      throw new Error('The withdrawal request is incomplete.');
    }
    return {
      action: 'withdraw', recipient: request.recipient, to: request.to,
      amount: BigInt(request.amount), signature: request.signature,
    };
  }
  throw new Error('Unknown signed request action.');
}

/**
 * Why a Diana EVM window (as /qorechain/pqc/v1/evm_window returns it) would refuse a
 * transaction to `contract` carrying `valueWei`, or undefined when it allows it.
 * Windows can limit targets, transaction count and value (in uqor).
 */
export function windowProblem(state, { contract, valueWei = 0n }) {
  if (!state || state.found === false || state.live !== true) return 'has no live EVM window';
  if (state.native_only) return 'has a window for Native transactions only';
  const targets = (state.allowed_targets ?? []).map((target) => String(target).toLowerCase());
  if (targets.length && !targets.includes(contract.toLowerCase())) return 'has an EVM window that does not allow QoreSplit at ' + contract;
  if (state.remaining_txs !== undefined && BigInt(state.remaining_txs) < 1n) return 'has used every transaction its EVM window allows';
  const needed = (BigInt(valueWei) + WEI_PER_UQOR - 1n) / WEI_PER_UQOR;
  if (needed && state.remaining_value !== undefined && BigInt(state.remaining_value) < needed) {
    return 'has an EVM window with less value left than this payment';
  }
}
